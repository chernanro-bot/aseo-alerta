const { supabase } = require('../lib/supabase')

/**
 * Middleware que verifica el JWT de Supabase.
 * Agrega req.user con los datos del usuario autenticado.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' })
    }

    const token = authHeader.split(' ')[1]

    // Verificar el JWT con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('[Auth] Error:', err.message)
    res.status(500).json({ error: 'Error de autenticación' })
  }
}

/**
 * Middleware que verifica suscripción activa.
 * Debe ir después de requireAuth.
 */
async function requireSubscription(req, res, next) {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single()

    if (!sub) {
      return res.status(402).json({
        error: 'Suscripción requerida',
        code: 'SUBSCRIPTION_REQUIRED'
      })
    }

    next()
  } catch (err) {
    console.error('[Auth] Error verificando suscripción:', err.message)
    res.status(500).json({ error: 'Error al verificar suscripción' })
  }
}

module.exports = { requireAuth, requireSubscription }
