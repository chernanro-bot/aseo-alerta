const { supabase } = require('../lib/supabase')
const { parseICalFromUrl } = require('./ical')
const { sendWhatsApp, buildNewBookingMessage } = require('./whatsapp')

/**
 * Sincroniza el calendario iCal de una propiedad.
 * - Parsea las reservas del iCal
 * - Inserta las nuevas en la BD (upsert por uid)
 * - Envía WhatsApp para reservas nuevas detectadas
 *
 * @param {string} propertyId
 * @returns {Object} { added, total }
 */
async function syncProperty(propertyId) {
  // Obtener propiedad
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('*')
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

  // Enviar WhatsApp para reservas nuevas (si tiene teléfono configurado)
  if (newReservations.length > 0 && property.whatsapp_phone) {
    for (const res of newReservations) {
      try {
        const message = buildNewBookingMessage({
          propertyName: property.name,
          checkin:      res.checkin,
          checkout:     res.checkout,
          guestName:    res.guest_name,
        })

        await sendWhatsApp(property.whatsapp_phone, message)

        // Registrar alerta enviada
        await supabase.from('alerts').insert({
          property_id:    propertyId,
          type:           'new_booking',
          status:         'sent',
          message:        message,
          whatsapp_to:    property.whatsapp_phone,
          sent_at:        new Date().toISOString(),
        })

        console.log(`[Sync] WhatsApp enviado para reserva ${res.uid}`)
      } catch (err) {
        console.error(`[Sync] Error enviando WhatsApp para ${res.uid}:`, err.message)

        // Registrar error
        await supabase.from('alerts').insert({
          property_id:  propertyId,
          type:         'new_booking',
          status:       'error',
          error_msg:    err.message,
          whatsapp_to:  property.whatsapp_phone,
        })
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

module.exports = { syncProperty }
