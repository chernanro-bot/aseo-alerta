const ical = require('node-ical')

/**
 * Parsea un calendario iCal desde una URL y retorna las reservas.
 * @param {string} url - URL del calendario .ics de Airbnb
 * @returns {Array} Lista de reservas { uid, checkin, checkout, guest_name, summary }
 */
async function parseICalFromUrl(url) {
  const events = await ical.async.fromURL(url)
  const reservations = []

  for (const [, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue

    // Airbnb usa VEVENT para las reservas. Excluir eventos de bloqueo.
    const summary = event.summary || ''
    if (summary.toLowerCase().includes('airbnb (not available)')) continue
    if (summary.toLowerCase().includes('bloqueado')) continue

    const checkin  = event.dtstart ? normalizeDate(event.dtstart)  : null
    const checkout = event.dtend   ? normalizeDate(event.dtend)    : null

    if (!checkin || !checkout) continue

    // Extraer nombre del huésped del resumen (ej: "Reservation - Juan Pérez")
    const guestName = extractGuestName(summary)

    reservations.push({
      uid:        event.uid || `${checkin}-${checkout}`,
      checkin:    checkin.toISOString(),
      checkout:   checkout.toISOString(),
      guest_name: guestName,
      summary:    summary,
    })
  }

  // Ordenar por check-in ascendente
  return reservations.sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
}

function normalizeDate(date) {
  if (!date) return null
  if (date instanceof Date) return date
  return new Date(date)
}

function extractGuestName(summary) {
  // Airbnb suele formatear como "Reservation" o con nombre del huésped
  if (!summary) return 'Huésped'
  const cleaned = summary
    .replace(/reservation/gi, '')
    .replace(/reserved/gi, '')
    .replace(/-/g, ' ')
    .trim()
  return cleaned || 'Huésped'
}

module.exports = { parseICalFromUrl }
