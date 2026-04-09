const { supabase } = require('../lib/supabase')
const { parseICalFromUrl } = require('./ical')
const { sendWhatsApp }     = require('./whatsapp')
const { createNotification, transitionNotification, logMessage } = require('./stateMachine')
const { notifyOwnerSent, notifyOwnerApprovalRequest } = require('./ownerNotifier')
const templates = require('./messageTemplates')

/**
 * Sincroniza el calendario iCal de una propiedad.
 * - Parsea las reservas del iCal
 * - Inserta las nuevas en la BD (upsert por uid)
 * - Crea notificaciones para reservas nuevas
 * - Envía WhatsApp según notification_mode (auto/approval)
 *
 * @param {string} propertyId
 * @returns {Object} { added, total }
 */
async function syncProperty(propertyId) {
  // Obtener propiedad con cleaner
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(`
      *,
      cleaner:cleaners(id, name, phone)
    `)
    .eq('id', propertyId)
    .single()

  if (propError || !property) throw new Error('Propiedad no encontrada')
  if (!property.ical_url)     throw new Error('La propiedad no tiene URL de calendario')

  console.log(`[Sync] Sincronizando propiedad: ${property.name}`)

  // Parsear iCal
  const parsed = await parseICalFromUrl(property.ical_url)
  console.log(`[Sync] ${parsed.length} eventos en el iCal`)

  // Obtener reservas existentes
  const { data: existing } = await supabase
    .from('reservations')
    .select('uid')
    .eq('property_id', propertyId)

  const existingUids = new Set((existing || []).map(r => r.uid))

  // Separar nuevas de existentes
  const newReservations = parsed.filter(r => !existingUids.has(r.uid))
  const allReservations = parsed.map(r => ({
    property_id: propertyId,
    uid:         r.uid,
    checkin:     r.checkin,
    checkout:    r.checkout,
    guest_name:  r.guest_name,
    summary:     r.summary,
  }))

  // Upsert todas las reservas
  if (allReservations.length > 0) {
    const { error: upsertError } = await supabase
      .from('reservations')
      .upsert(allReservations, { onConflict: 'uid,property_id' })

    if (upsertError) {
      console.error('[Sync] Error en upsert:', upsertError)
      throw new Error('Error al guardar reservas')
    }
  }

  // ─── NUEVO: Crear notificaciones para reservas nuevas ───────────────────
  if (newReservations.length > 0 && property.cleaner) {
    for (const res of newReservations) {
      try {
        // Obtener la reserva insertada (necesitamos el ID de BD)
        const { data: dbReservation } = await supabase
          .from('reservations')
          .select('id')
          .eq('uid', res.uid)
          .eq('property_id', propertyId)
          .single()

        if (!dbReservation) continue

        // Verificar si ya existe una notificación para esta reserva
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('reservation_id', dbReservation.id)
          .eq('type', 'new_reservation')
          .limit(1)

        if (existingNotif?.length > 0) {
          console.log(`[Sync] Notificación ya existe para reserva ${res.uid}`)
          continue
        }

        // Determinar estado inicial según notification_mode
        const initialStatus = property.notification_mode === 'auto'
          ? 'pending_notification'
          : 'pending_approval'

        // Crear notificación
        const notification = await createNotification({
          propertyId:    propertyId,
          reservationId: dbReservation.id,
          cleanerId:     property.cleaner.id,
          type:          'new_reservation',
          status:        initialStatus,
        })

        if (property.notification_mode === 'auto') {
          // Modo auto: enviar inmediatamente
          await sendCleanerNotification(notification, property, res)
        } else {
          // Modo approval: avisar al owner para que apruebe
          await notifyOwnerApprovalRequest(notification.id)
          console.log(`[Sync] Solicitud de aprobación creada para ${property.name}`)
        }
      } catch (err) {
        console.error(`[Sync] Error procesando reserva ${res.uid}:`, err.message)
      }
    }
  } else if (newReservations.length > 0 && !property.cleaner) {
    console.log(`[Sync] ${property.name} tiene reservas nuevas pero no tiene cleaner asignado`)

    // Fallback: enviar alerta al viejo sistema si hay whatsapp_phone
    if (property.whatsapp_phone) {
      for (const res of newReservations) {
        try {
          const message = templates.buildCleanerNewReservation({
            propertyName: property.name,
            ownerName:    'Aseo Alerta',
            checkinDate:  templates.formatDate(res.checkin),
            checkinTime:  property.checkin_time,
            checkoutDate: templates.formatDate(res.checkout),
            checkoutTime: property.checkout_time,
            guestName:    res.guest_name,
          })

          await sendWhatsApp(property.whatsapp_phone, message)
          console.log(`[Sync] WhatsApp enviado (fallback) para reserva ${res.uid}`)
        } catch (err) {
          console.error(`[Sync] Error enviando WhatsApp fallback:`, err.message)
        }
      }
    }
  }

  // Actualizar timestamp de sync
  await supabase
    .from('properties')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', propertyId)

  console.log(`[Sync] Completado: ${newReservations.length} nuevas, ${parsed.length} total`)

  return {
    added:        newReservations.length,
    total:        parsed.length,
    newBookings:  newReservations,
  }
}

/**
 * Enviar mensaje de notificación al cleaner y transicionar a 'notified'
 */
async function sendCleanerNotification(notification, property, reservation) {
  const message = templates.buildCleanerNewReservation({
    propertyName: property.name,
    ownerName:    'el dueño',
    checkinDate:  templates.formatDate(reservation.checkin),
    checkinTime:  property.checkin_time,
    checkoutDate: templates.formatDate(reservation.checkout),
    checkoutTime: property.checkout_time,
    guestName:    reservation.guest_name,
  })

  const result = await sendWhatsApp(property.cleaner.phone, message)

  // Registrar en messages_log
  await logMessage({
    notificationId: notification.id,
    kapsoMessageId: result?.messages?.[0]?.id || null,
    direction:      'outbound',
    content:        message,
    phoneTo:        property.cleaner.phone,
    status:         'queued',
  })

  // Transicionar a 'notified'
  await transitionNotification(notification.id, 'notified', {
    message_text: message,
  })

  // Avisar al owner que se envió
  await notifyOwnerSent(notification.id)

  console.log(`[Sync] ✅ Notificación enviada a ${property.cleaner.name} para ${property.name}`)
}

module.exports = { syncProperty }
