const express = require('express')
const router  = express.Router()
const axios   = require('axios')
const { supabase }    = require('../lib/supabase')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

const TOKU_API_URL = 'https://api.toku.cl/v1'  // URL base de Toku (ajustar según docs)
const PLAN_PRICE   = 9990                        // CLP

/**
 * GET /api/subscription
 * Obtiene el estado de la suscripción del usuario.
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return res.json(null)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener suscripción' })
  }
})

/**
 * POST /api/subscription
 * Crea una nueva suscripción via Toku.
 * Retorna URL de checkout o activa directamente.
 *
 * NOTA: Ajustar el payload según la API real de Toku.
 * Docs: https://docs.toku.cl
 */
router.post('/', async (req, res) => {
  const { email } = req.body
  const tokuApiKey = process.env.TOKU_API_KEY
  const tokuPlanId = process.env.TOKU_PLAN_ID

  if (!tokuApiKey || !tokuPlanId) {
    // Modo desarrollo: activar suscripción sin pago real
    console.warn('[Subscription] Toku no configurado. Activando en modo dev.')
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id:    req.user.id,
        status:     'active',
        plan:       'launch',
        amount:     PLAN_PRICE,
        currency:   'CLP',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: 'Error al crear suscripción' })
    return res.json({ success: true, subscription: data, mode: 'dev' })
  }

  try {
    // Crear sesión de checkout en Toku
    const { data: tokuData } = await axios.post(
      `${TOKU_API_URL}/checkout/sessions`,
      {
        plan_id:     tokuPlanId,
        customer: {
          email:   email || req.user.email,
        },
        success_url: `${process.env.FRONTEND_URL}/suscripcion?success=true`,
        cancel_url:  `${process.env.FRONTEND_URL}/suscripcion?canceled=true`,
        metadata: {
          user_id: req.user.id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${tokuApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Guardar intento de suscripción pendiente
    await supabase.from('subscriptions').insert({
      user_id:             req.user.id,
      status:              'pending',
      plan:                'launch',
      amount:              PLAN_PRICE,
      currency:            'CLP',
      toku_session_id:     tokuData.id,
    })

    res.json({ checkout_url: tokuData.url })
  } catch (err) {
    console.error('[Subscription] Error Toku:', err.response?.data || err.message)
    res.status(500).json({ error: 'Error al crear sesión de pago. Intenta de nuevo.' })
  }
})

/**
 * DELETE /api/subscription
 * Cancela la suscripción activa.
 */
router.delete('/', async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single()

    if (!sub) return res.status(404).json({ error: 'Sin suscripción activa' })

    // Cancelar en Toku si hay ID externo
    if (sub.toku_subscription_id && process.env.TOKU_API_KEY) {
      try {
        await axios.delete(
          `${TOKU_API_URL}/subscriptions/${sub.toku_subscription_id}`,
          { headers: { Authorization: `Bearer ${process.env.TOKU_API_KEY}` } }
        )
      } catch (err) {
        console.error('[Subscription] Error cancelando en Toku:', err.message)
      }
    }

    // Actualizar estado en BD
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', sub.id)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar suscripción' })
  }
})

/**
 * POST /api/webhooks/toku
 * Webhook de Toku para confirmar pagos exitosos.
 * Registrar esta URL en el dashboard de Toku.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['toku-signature']
  const webhookSecret = process.env.TOKU_WEBHOOK_SECRET

  // Verificar firma del webhook (ajustar según docs de Toku)
  if (webhookSecret && signature) {
    const crypto = require('crypto')
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex')

    if (signature !== expected) {
      console.warn('[Webhook] Firma inválida de Toku')
      return res.status(400).json({ error: 'Firma inválida' })
    }
  }

  try {
    const event = JSON.parse(req.body.toString())
    console.log('[Webhook Toku] Evento recibido:', event.type)

    if (event.type === 'subscription.activated' || event.type === 'payment.succeeded') {
      const userId = event.data?.metadata?.user_id || event.data?.customer?.metadata?.user_id

      if (userId) {
        // Activar o actualizar suscripción
        await supabase
          .from('subscriptions')
          .upsert({
            user_id:               userId,
            status:                'active',
            plan:                  'launch',
            amount:                PLAN_PRICE,
            currency:              'CLP',
            toku_subscription_id:  event.data.subscription_id || event.data.id,
            current_period_end:    event.data.current_period_end,
            started_at:            new Date().toISOString(),
          }, { onConflict: 'toku_subscription_id' })

        console.log(`[Webhook] Suscripción activada para user ${userId}`)
      }
    }

    if (event.type === 'subscription.canceled' || event.type === 'subscription.expired') {
      const tokuSubId = event.data.id
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('toku_subscription_id', tokuSubId)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[Webhook] Error procesando evento Toku:', err.message)
    res.status(500).json({ error: 'Error procesando webhook' })
  }
})

module.exports = router
