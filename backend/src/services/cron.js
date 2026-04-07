const cron  = require('node-cron')
const { supabase }  = require('../lib/supabase')
const { syncProperty } = require('./sync')
const { sendWhatsApp, buildPreCheckoutMessage } = require('./whatsapp')

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
 * Detecta checkouts del día SIGUIENTE y envía WhatsApp
 */
function startPreCheckoutAlertJob() {
  cron.schedule('0 12 * * *', async () => {
    console.log('[Cron] Iniciando job de alertas pre-checkout...')
    try {
      // Calcular rango: mañana (en hora Chile)
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
          property:properties(id, name, whatsapp_phone, active)
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
        if (!property?.active)        continue
        if (!property.whatsapp_phone) continue

        // Verificar si ya se envió alerta para esta reserva
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('reservation_id', res.id)
          .eq('type', 'pre_checkout')
          .eq('status', 'sent')
          .single()

        if (existingAlert) {
          console.log(`[Cron] Alerta ya enviada para reserva ${res.id}`)
          continue
        }

        try {
          const message = buildPreCheckoutMessage({
            propertyName: property.name,
            checkout:     res.checkout,
            guestName:    res.guest_name,
            checkoutTime: '11:00',
          })

          await sendWhatsApp(property.whatsapp_phone, message)

          // Registrar alerta
          await supabase.from('alerts').insert({
            property_id:    property.id,
            reservation_id: res.id,
            type:           'pre_checkout',
            status:         'sent',
            message:        message,
            whatsapp_to:    property.whatsapp_phone,
            sent_at:        new Date().toISOString(),
          })

          console.log(`[Cron] ✅ Alerta pre-checkout enviada para ${property.name}`)
        } catch (err) {
          console.error(`[Cron] ❌ Error enviando alerta para ${property.name}:`, err.message)

          await supabase.from('alerts').insert({
            property_id:    property.id,
            reservation_id: res.id,
            type:           'pre_checkout',
            status:         'error',
            error_msg:      err.message,
            whatsapp_to:    property.whatsapp_phone,
          })
        }
      }

      console.log('[Cron] Job pre-checkout completado')
    } catch (err) {
      console.error('[Cron] Error en job pre-checkout:', err.message)
    }
  }, { timezone: 'America/Santiago' })

  console.log('[Cron] Job de alertas pre-checkout registrado (09:00 AM Chile)')
}

function startAllCronJobs() {
  startDailySyncJob()
  startPreCheckoutAlertJob()
  console.log('[Cron] Todos los jobs iniciados ✅')
}

module.exports = { startAllCronJobs }
