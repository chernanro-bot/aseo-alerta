const crypto = require('crypto')

/**
 * Middleware para verificar la firma de los webhooks de Kapso.
 *
 * Kapso usa el header X-Webhook-Signature para firmar los webhooks.
 * También incluye X-Webhook-Event y X-Idempotency-Key.
 *
 * Soporta tanto webhooks nativos de Kapso como Meta forward webhooks.
 */
function verifyKapsoSignature(req, res, next) {
  const signature = req.headers['x-webhook-signature']
  const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET

  // En desarrollo sin secret configurado, permitir pasar
  if (!webhookSecret) {
    console.warn('[WebhookAuth] KAPSO_WEBHOOK_SECRET no configurado. Saltando verificación de firma.')
    return next()
  }

  if (!signature) {
    console.warn('[WebhookAuth] Request sin firma X-Webhook-Signature')
    return res.status(401).json({ error: 'Firma requerida' })
  }

  try {
    const payload = req.rawBody || JSON.stringify(req.body)

    // Kapso puede usar HMAC-SHA256 para firmar
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')

    // Comparar — la firma puede venir con o sin prefijo "sha256="
    const cleanSignature = signature.replace('sha256=', '')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(cleanSignature),
      Buffer.from(expectedSig)
    )

    if (!isValid) {
      console.warn('[WebhookAuth] Firma inválida')
      return res.status(401).json({ error: 'Firma inválida' })
    }

    next()
  } catch (err) {
    console.error('[WebhookAuth] Error verificando firma:', err.message)
    // Si hay error en la verificación, dejarlo pasar en dev
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[WebhookAuth] Modo desarrollo: dejando pasar request sin verificar')
      return next()
    }
    return res.status(500).json({ error: 'Error de verificación' })
  }
}

module.exports = { verifyKapsoSignature }
