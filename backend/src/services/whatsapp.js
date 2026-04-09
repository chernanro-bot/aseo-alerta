const axios = require('axios')

/**
 * Envía un mensaje de WhatsApp via Kapso.ai
 * Retorna el response completo de Kapso incluyendo message_id para tracking.
 *
 * Kapso usa la API de WhatsApp Business de Meta.
 * Docs: https://kapso.ai/docs
 */
async function sendWhatsApp(to, message) {
  const apiKey   = process.env.KAPSO_API_KEY
  const phoneId  = process.env.KAPSO_PHONE_ID

  if (!apiKey || !phoneId) {
    console.warn('[WhatsApp] KAPSO_API_KEY o KAPSO_PHONE_ID no configurados. Modo simulación.')
    console.log(`[WhatsApp SIMULADO] Para: ${to}\nMensaje: ${message}`)
    return {
      simulated: true,
      messages: [{ id: `sim_${Date.now()}` }],
    }
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

    console.log(`[WhatsApp] ✅ Mensaje enviado a ${formatPhone(to)} | ID: ${response.data?.messages?.[0]?.id || 'N/A'}`)
    return response.data
  } catch (err) {
    console.error('[WhatsApp] Error al enviar:', err.response?.data || err.message)
    throw new Error(`Error WhatsApp: ${err.response?.data?.message || err.message}`)
  }
}

/**
 * Envía un mensaje de WhatsApp con template (para mensajes proactivos).
 * Algunos mensajes requieren templates aprobados por Meta.
 * Por ahora usamos mensajes de texto simples (sesión de 24h).
 */
async function sendWhatsAppTemplate(to, templateName, parameters) {
  const apiKey   = process.env.KAPSO_API_KEY
  const phoneId  = process.env.KAPSO_PHONE_ID

  if (!apiKey || !phoneId) {
    console.warn('[WhatsApp] Modo simulación (template)')
    return { simulated: true, messages: [{ id: `sim_tpl_${Date.now()}` }] }
  }

  try {
    const response = await axios.post(
      `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to:       formatPhone(to),
        type:     'template',
        template: {
          name:     templateName,
          language: { code: 'es' },
          components: parameters ? [{ type: 'body', parameters }] : [],
        },
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
    console.error('[WhatsApp] Error template:', err.response?.data || err.message)
    // Fallback a mensaje de texto simple
    console.log('[WhatsApp] Intentando fallback a mensaje de texto...')
    throw err
  }
}

/**
 * Formatea el número al formato internacional E.164
 * Ej: "9 1234 5678" → "+56912345678"
 */
function formatPhone(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('0')) cleaned = '+56' + cleaned.slice(1)
  if (cleaned.startsWith('9') && cleaned.length === 9) cleaned = '+56' + cleaned
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  return cleaned
}

module.exports = { sendWhatsApp, sendWhatsAppTemplate, formatPhone }
