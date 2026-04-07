require('dotenv').config()
const express     = require('express')
const helmet      = require('helmet')
const cors        = require('cors')
const rateLimit   = require('express-rate-limit')
const { startAllCronJobs } = require('./services/cron')

const app  = express()
const PORT = process.env.PORT || 4000

// ─── Seguridad ────────────────────────────────────────────────────────────────

// Headers de seguridad HTTP
app.use(helmet())

// CORS: solo permitir el frontend autorizado
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://lighthearted-lolly-9248da.netlify.app',
  'https://www.aseoalerta.cl',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origen no permitido → ${origin}`))
    }
  },
  credentials: true,
}))

// Rate limiting global: 100 req/15min por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders:   false,
})
app.use('/api', limiter)

// Rate limiting estricto para sincronización manual
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      5,
  message:  { error: 'Demasiadas sincronizaciones. Espera un minuto.' },
})
app.use('/api/properties/:id/sync', syncLimiter)

// ─── Body parsers ─────────────────────────────────────────────────────────────
// Nota: el webhook de Toku necesita raw body, por eso va antes del json()
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/properties',   require('./routes/properties'))
app.use('/api/subscription', require('./routes/subscription'))

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aseo-alerta-api',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
})

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use((err, req, res, _next) => {
  console.error('[Server] Error no manejado:', err.message)
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message })
  }
  res.status(500).json({ error: 'Error interno del servidor' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
🧹 Aseo Alerta API iniciada
─────────────────────────────
🌐 Puerto:   ${PORT}
📦 Entorno:  ${process.env.NODE_ENV || 'development'}
🔗 Health:   http://localhost:${PORT}/health
─────────────────────────────
  `)

  // Iniciar cron jobs (solo en producción o si están habilitados)
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    startAllCronJobs()
  } else {
    console.log('[Cron] Jobs deshabilitados en desarrollo. Set ENABLE_CRON=true para activar.')
  }
})

module.exports = app
