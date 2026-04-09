const express = require('express')
const router  = express.Router()
const { supabase }    = require('../lib/supabase')
const { requireAuth } = require('../middleware/auth')
const { syncProperty } = require('../services/sync')

// Todas las rutas requieren auth
router.use(requireAuth)

/**
 * GET /api/properties
 * Lista todas las propiedades del usuario autenticado.
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        reservations(checkout),
        cleaner:cleaners(id, name, phone)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calcular próximo checkout
    const properties = (data || []).map(p => {
      const upcoming = (p.reservations || [])
        .filter(r => new Date(r.checkout) >= new Date())
        .sort((a, b) => new Date(a.checkout) - new Date(b.checkout))

      return {
        ...p,
        reservations:   undefined,
        next_checkout: upcoming[0]?.checkout || null,
      }
    })

    res.json(properties)
  } catch (err) {
    console.error('[Properties] Error listing:', err.message)
    res.status(500).json({ error: 'Error al obtener propiedades' })
  }
})

/**
 * GET /api/properties/:id
 * Detalle de una propiedad.
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Propiedad no encontrada' })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener propiedad' })
  }
})

/**
 * POST /api/properties
 * Crea una nueva propiedad.
 */
router.post('/', async (req, res) => {
  const {
    name, ical_url, whatsapp_phone,
    notify_on_reservation, notify_before_checkout,
    cleaner_id, notification_mode, checkout_time, checkin_time, owner_phone
  } = req.body

  if (!name?.trim())         return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!ical_url?.trim())     return res.status(400).json({ error: 'La URL del calendario es obligatoria' })
  if (!ical_url.startsWith('http')) return res.status(400).json({ error: 'URL de calendario inválida' })

  // Validar cleaner_id si se proporciona
  if (cleaner_id) {
    const { data: cleaner } = await supabase
      .from('cleaners')
      .select('id')
      .eq('id', cleaner_id)
      .eq('user_id', req.user.id)
      .single()
    if (!cleaner) return res.status(400).json({ error: 'Contacto de limpieza no encontrado' })
  }

  try {
    const insertData = {
      user_id:                req.user.id,
      name:                   name.trim(),
      ical_url:               ical_url.trim(),
      active:                 true,
      notify_on_reservation:  notify_on_reservation !== false,
      notify_before_checkout: notify_before_checkout !== false,
    }
    // Campos opcionales
    if (whatsapp_phone?.trim()) insertData.whatsapp_phone    = whatsapp_phone.trim()
    if (cleaner_id)             insertData.cleaner_id        = cleaner_id
    if (notification_mode)      insertData.notification_mode = notification_mode
    if (checkout_time)          insertData.checkout_time     = checkout_time
    if (checkin_time)           insertData.checkin_time      = checkin_time
    if (owner_phone?.trim())    insertData.owner_phone       = owner_phone.trim()

    const { data, error } = await supabase
      .from('properties')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    // Sincronizar calendario en segundo plano (no bloquear la respuesta)
    syncProperty(data.id).catch(err =>
      console.error(`[Properties] Error sync inicial ${data.id}:`, err.message)
    )

    res.status(201).json(data)
  } catch (err) {
    console.error('[Properties] Error creating:', err.message)
    res.status(500).json({ error: 'Error al crear la propiedad' })
  }
})

/**
 * PATCH /api/properties/:id
 * Actualiza una propiedad.
 */
router.patch('/:id', async (req, res) => {
  const {
    name, ical_url, whatsapp_phone, active,
    notify_on_reservation, notify_before_checkout,
    cleaner_id, notification_mode, checkout_time, checkin_time, owner_phone
  } = req.body

  // Verificar que la propiedad pertenece al usuario
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!existing) return res.status(404).json({ error: 'Propiedad no encontrada' })

  // Validar cleaner_id si se proporciona
  if (cleaner_id) {
    const { data: cleaner } = await supabase
      .from('cleaners')
      .select('id')
      .eq('id', cleaner_id)
      .eq('user_id', req.user.id)
      .single()
    if (!cleaner) return res.status(400).json({ error: 'Contacto de limpieza no encontrado' })
  }

  const updates = {}
  if (name !== undefined)                   updates.name                   = name.trim()
  if (ical_url !== undefined)               updates.ical_url               = ical_url.trim()
  if (whatsapp_phone !== undefined)         updates.whatsapp_phone         = whatsapp_phone.trim()
  if (active !== undefined)                 updates.active                 = active
  if (notify_on_reservation !== undefined)  updates.notify_on_reservation  = notify_on_reservation
  if (notify_before_checkout !== undefined) updates.notify_before_checkout = notify_before_checkout
  if (cleaner_id !== undefined)             updates.cleaner_id             = cleaner_id || null
  if (notification_mode !== undefined)      updates.notification_mode      = notification_mode
  if (checkout_time !== undefined)          updates.checkout_time          = checkout_time
  if (checkin_time !== undefined)           updates.checkin_time           = checkin_time
  if (owner_phone !== undefined)            updates.owner_phone            = owner_phone?.trim() || null

  try {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' })
  }
})

/**
 * DELETE /api/properties/:id
 * Elimina una propiedad y sus datos.
 */
router.delete('/:id', async (req, res) => {
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!existing) return res.status(404).json({ error: 'Propiedad no encontrada' })

  try {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' })
  }
})

/**
 * POST /api/properties/:id/sync
 * Sincroniza manualmente el calendario de una propiedad.
 */
router.post('/:id/sync', async (req, res) => {
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!existing) return res.status(404).json({ error: 'Propiedad no encontrada' })

  try {
    const result = await syncProperty(req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[Properties] Error sync manual:', err.message)
    res.status(500).json({ error: err.message || 'Error al sincronizar' })
  }
})

/**
 * GET /api/properties/:id/reservations
 */
router.get('/:id/reservations', async (req, res) => {
  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' })

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('property_id', req.params.id)
    .order('checkout', { ascending: true })

  if (error) return res.status(500).json({ error: 'Error al obtener reservas' })
  res.json(data || [])
})

/**
 * GET /api/properties/:id/notifications
 * Listar notificaciones de una propiedad.
 */
router.get('/:id/notifications', async (req, res) => {
  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' })

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      reservation:reservations(id, checkin, checkout, guest_name),
      cleaner:cleaners(id, name, phone)
    `)
    .eq('property_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: 'Error al obtener notificaciones' })
  res.json(data || [])
})

/**
 * GET /api/properties/:id/alerts
 * DEPRECADO — usar /:id/notifications
 */
router.get('/:id/alerts', async (req, res) => {
  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' })

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('property_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: 'Error al obtener alertas' })
  res.json(data || [])
})

module.exports = router
