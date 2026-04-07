const axios = require('axios')

/**
   * Envía un mensaje de WhatsApp via Kapso.ai
   * Docs: https://docs.kapso.ai
   *
   * Para configurar:
   * 1. Crea cuenta en kapso.ai
   * 2. Conecta tu número de WhatsApp Business
   * 3. Obtén KAPSO_API_KEY y KAPSO_PHONE_ID en el dashboard
   */
async function sendWhatsApp(to, message) {
    const apiKey   = process.env.KAPSO_API_KEY
    const phoneId  = process.env.KAPSO_PHONE_ID

  if (!apiKey || !phoneId) {
        console.warn('[WhatsApp] KAPSO_API_KEY o KAPSO_PHONE_ID no configurados. Modo simulación.')
        console.log(`[WhatsApp SIMULADO] Para: ${to}\nMensaje: ${message}`)
        return { simulated: true }
  }

  try {
        const response = await axios.post(
                `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneId}/messages`,
          {
                    messaging_product: 'whatsapp',
                    to:       formatPhone(to),
                    type:     'text',
                    text:     { body: message },
          },
          {
                    headers: {
                                'X-API-Key':    apiKey,
                                'Content-Type': 'application/json',
                    },
                    timeout: 10000,
          }
              )
        return response.data
  } catch (err) {
        console.error('[WhatsApp] Error al enviar:', err.response?.data || err.message)
        throw new Error(`Error WhatsApp: ${err.response?.data?.message || err.message}`)
  }
}

/**
 * Formatea el número al formato internacional E.164
 * Ej: "9 1234 5678" → "+56912345678"
 */
function formatPhone(phone) {
    // Limpiar todo excepto dígitos y +
  let cleaned = phone.replace(/[^\d+]/g, '')
    // Si empieza con 0, reemplazar por +56
  if (cleaned.startsWith('0')) cleaned = '+56' + cleaned.slice(1)
    // Si es chileno sin código de país
  if (cleaned.startsWith('9') && cleaned.length === 9) cleaned = '+56' + cleaned
    // Si no tiene +, agregar
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
    return cleaned
}

/**
 * Genera el mensaje de alerta de nueva reserva
 */
function buildNewBookingMessage({ propertyName, checkin, checkout, guestName }) {
    const checkinDate  = formatDate(checkin)
    const checkoutDate = formatDate(checkout)
    return `🎉 *¡Nueva reserva en ${propertyName}!*

    👤 Huésped: ${guestName || 'Sin nombre'}
    📅 Check-in: ${checkinDate}
    🚪 Checkout: ${checkoutDate}

    _Mensaje automático de Aseo Alerta_ 🧹`
}

/**
 * Genera el mensaje de alerta pre-checkout (día anterior)
 */
function buildPreCheckoutMessage({ propertyName, checkout, guestName, checkoutTime }) {
    const checkoutDate = formatDate(checkout)
    return `🔔 *Recordatorio de aseo — ${propertyName}*

    ¡Mañana hay checkout!

    👤 Huésped: ${guestName || 'Sin nombre'}
    📅 Fecha: ${checkoutDate}
    🕐 Hora de salida: ${checkoutTime || '11:00'}

    Por favor confirma que el aseo queda listo para el siguiente huésped. ✅

    _Mensaje automático de Aseo Alerta_ 🧹`
}

function formatDate(isoDate) {
    if (!isoDate) return '—'
    return new Date(isoDate).toLocaleDateString('es-CL', {
          weekday: 'long',
          day:     'numeric',
          month:   'long',
          year:    'numeric',
    })
}

module.exports = { sendWhatsApp, buildNewBookingMessage, buildPreCheckoutMessage }
