const cron  = require('node-cron')
const { supabase }     = require('../lib/supabase')
const { syncProperty } = require('./sync')
const { sendWhatsApp }       = require('./whatsapp')
const { createNotification, transitionNotification, logMessage } = require('./stateMachine')
const { notifyOwnerSent, notifyOwnerApprovalRequest } = require('./ownerNotifier')
const { checkEscalations, checkReEscalations, cleanupStaleNotifications, processPendingNotifications } = require('./escalation')
const templates = require('./messageTemplates')

/**
 * CRON JOB 1: Sincronización diaria de todos los calendarios
 * Se ejecuta cada día a las 06:00 AM (hora Chile, UTC-3)
 * → Equivale a las 09:00 UTC
 */
function startDailySyncJob() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Iniciando sincronización diaria de calendarios...')
    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('id, name')
        .eq('active', true)

      if (error) throw error
      if (!properties?.length) {
        console.log('[Cron] Sin propiedades activas')
        return
      }

      console.log(`[Cron] Sincronizando ${properties.length} propiedad(es)...`)

      for (const prop of properties) {
        try {
          const result = await syncProperty(prop.id)
          console.log(`[Cron] ${prop.name}: +${result.added} nuevas reservas`)
        } catch (err) {
          console.error(`[Cron] Error sync ${prop.name}:`, err.message)
        }
      }

      console.log('[Cron] Sincronización diaria completada')
    } catch (err) {
      console.error('[Cron] Error en sincronización diaria:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de sincronización diaria registrado (06:00 AM Chile)')
}

/**
 * CRON JOB 2: Alertas de pre-checkout
 * Se ejecuta cada día a las 09:00 AM (hora Chile)
 * Detecta checkouts del día SIGUIENTE y envía WhatsApp al cleaner.
 * Usa el nuevo sistema de notifications.
 */
function startPreCheckoutAlertJob() {
  cron.schedule('0 12 * * *', async () => {
    console.log('[Cron] Iniciando job de alertas pre-checkout...')
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStart = new Date(tomorrow)
      tomorrowStart.setHours(0, 0, 0, 0)
      const tomorrowEnd = new Date(tomorrow)
      tomorrowEnd.setHours(23, 59, 59, 999)

      // Buscar reservas con checkout mañana
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select(`
          *,
          property:properties(
            id, name, active, notification_mode, checkout_time, checkin_time,
            owner_phone, cleaner_id,
            cleaner:cleaners(id, name, phone)
          )
        `)
        .gte('checkout', tomorrowStart.toISOString())
        .lte('checkout', tomorrowEnd.toISOString())

      if (error) throw error
      if (!reservations?.length) {
        console.log('[Cron] Sin checkouts mañana')
        return
      }

      console.log(`[Cron] ${reservations.length} checkout(s) mañana`)

      for (const res of reservations) {
        const property = res.property
        if (!property?.active) continue
        if (!property.cleaner) {
          console.log(`[Cron] ${property.name}: sin cleaner asignado, saltando`)
          continue
        }

        // Verificar si ya se envió notificación pre-checkout para esta reserva
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('reservation_id', res.id)
          .eq('type', 'pre_checkout_reminder')
          .limit(1)

        if (existingNotif?.length > 0) {
          console.log(`[Cron] Notificación pre-checkout ya existe para reserva ${res.id}`)
          continue
        }

        try {
          // Buscar próximo checkin
          const { data: nextReservation } = await supabase
            .from('reservations')
            .select('checkin')
            .eq('property_id', property.id)
            .gt('checkin', res.checkout)
            .order('checkin', { ascending: true })
            .limit(1)
            .single()

          const initialStatus = property.notification_mode === 'auto'
            ? 'pending_notification'
            : 'pending_approval'

          // Crear notificación
          const notification = await createNotification({
            propertyId:    property.id,
            reservationId: res.id,
            cleanerId:     property.cleaner.id,
            type:          'pre_checkout_reminder',
            status:        initialStatus,
          })

          if (property.notification_mode === 'auto') {
            // Enviar directamente al cleaner
            const message = templates.buildCleanerPreCheckout({
              propertyName:    property.name,
              ownerName:       'el dueño',
              checkoutDate:    templates.formatDate(res.checkout),
              checkoutTime:    property.checkout_time,
              guestName:       res.guest_name,
              nextCheckinDate: nextReservation ? templates.formatDate(nextReservation.checkin) : null,
              nextCheckinTime: property.checkin_time,
            })

            const result = await sendWhatsApp(property.cleaner.phone, message)

            await logMessage({
              notificationId: notification.id,
              kapsoMessageId: result?.messages?.[0]?.id || null,
              direction:      'outbound',
              content:        message,
              phoneTo:        property.cleaner.phone,
              status:         'queued',
            })

            await transitionNotification(notification.id, 'notified', {
              message_text: message,
            })

            await notifyOwnerSent(notification.id)
            console.log(`[Cron] ✅ Pre-checkout enviado a ${property.cleaner.name} para ${property.name}`)
          } else {
            // Modo approval: pedir aprobación al owner
            await notifyOwnerApprovalRequest(notification.id)
            console.log(`[Cron] Solicitud de aprobación pre-checkout para ${property.name}`)
          }
        } catch (err) {
          console.error(`[Cron] ❌ Error en pre-checkout para ${property.name}:`, err.message)
        }
      }

      console.log('[Cron] Job pre-checkout completado')
    } catch (err) {
      console.error('[Cron] Error en job pre-checkout:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de alertas pre-checkout registrado (09:00 AM Chile)')
}

/**
 * CRON JOB 3: Verificación de escalaciones
 * Cada 30 minutos — busca notificaciones sin respuesta después de 2h
 */
function startEscalationCheckerJob() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      // Primero: procesar notificaciones pendientes de envío
      await processPendingNotifications()
      // Luego: verificar escalaciones
      await checkEscalations()
    } catch (err) {
      console.error('[Cron] Error en escalation checker:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de escalación registrado (cada 30 min)')
}

/**
 * CRON JOB 4: Re-escalación
 * Cada 4 horas — reenvía recordatorio de escalación
 */
function startReEscalationJob() {
  cron.schedule('0 */4 * * *', async () => {
    try {
      await checkReEscalations()
    } catch (err) {
      console.error('[Cron] Error en re-escalation:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de re-escalación registrado (cada 4h)')
}

/**
 * CRON JOB 5: Limpieza de notificaciones vencidas
 * Cada día a las 00:00 Chile — auto-resuelve notificaciones con checkout pasado
 */
function startStaleCleanupJob() {
  cron.schedule('0 3 * * *', async () => {
    try {
      await cleanupStaleNotifications()
    } catch (err) {
      console.error('[Cron] Error en stale cleanup:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de limpieza nocturna registrado (00:00 Chile)')
}

function startAllCronJobs() {
  startDailySyncJob()
  startPreCheckoutAlertJob()
  startEscalationCheckerJob()
  startReEscalationJob()
  startStaleCleanupJob()
  console.log('[Cron] Todos los jobs iniciados ✅')
}

module.exports = { startAllCronJobs }
