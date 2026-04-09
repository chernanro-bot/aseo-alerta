const express = require('express')
const router  = express.Router()
const { supabase }    = require('../lib/supabase')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

/**
 * GET /api/cleaners
 * Lista todos los contactos de limpieza del usuario.
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('[Cleaners] Error listing:', err.message)
    res.status(500).json({ error: 'Error al obtener contactos' })
  }
})

/**
 * GET /api/cleaners/:id
 * Detalle de un cleaner.
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Contacto no encontrado' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener contacto' })
  }
})

/**
 * POST /api/cleaners
 * Crear un nuevo contacto de limpieza.
 */
router.post('/', async (req, res) => {
  const { name, phone, notes } = req.body

  if (!name?.trim())  return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!phone?.trim()) return res.status(400).json({ error: 'El teléfono es obligatorio' })

  // Validar formato E.164 básico
  const cleanedPhone = formatPhoneE164(phone)
  if (!cleanedPhone) {
    return res.status(400).json({ error: 'Formato de teléfono inválido. Use formato +56912345678' })
  }

  try {
    const { data, error } = await supabase
      .from('cleaners')
      .insert({
        user_id: req.user.id,
        name:    name.trim(),
        phone:   cleanedPhone,
        notes:   notes?.trim() || null,
        active:  true,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('[Cleaners] Error creating:', err.message)
    res.status(500).json({ error: 'Error al crear contacto' })
  }
})

/**
 * PATCH /api/cleaners/:id
 * Actualizar un contacto de limpieza.
 */
router.patch('/:id', async (req, res) => {
  const { data: existing } = await supabase
    .from('cleaners')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!existing) return res.status(404).json({ error: 'Contacto no encontrado' })

  const { name, phone, notes, active } = req.body
  const updates = {}

  if (name !== undefined)   updates.name   = name.trim()
  if (notes !== undefined)  updates.notes  = notes?.trim() || null
  if (active !== undefined) updates.active = active

  if (phone !== undefined) {
    const cleanedPhone = formatPhoneE164(phone)
    if (!cleanedPhone) {
      return res.status(400).json({ error: 'Formato de teléfono inválido' })
    }
    updates.phone = cleanedPhone
  }

  try {
    const { data, error } = await supabase
      .from('cleaners')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar contacto' })
  }
})

/**
 * DELETE /api/cleaners/:id
 * Eliminar un contacto de limpieza.
 * No permite eliminar si tiene notificaciones activas.
 */
router.delete('/:id', async (req, res) => {
  const { data: existing } = await supabase
    .from('cleaners')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!existing) return res.status(404).json({ error: 'Contacto no encontrado' })

  // Verificar si tiene notificaciones activas
  const { data: activeNotifs } = await supabase
    .from('notifications')
    .select('id')
    .eq('cleaner_id', req.params.id)
    .in('status', ['pending_approval', 'pending_notification', 'notified', 'escalated'])
    .limit(1)

  if (activeNotifs?.length > 0) {
    return res.status(409).json({
      error: 'No se puede eliminar: tiene notificaciones activas. Resuelve las notificaciones primero.'
    })
  }

  try {
    const { error } = await supabase
      .from('cleaners')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar contacto' })
  }
})

// ─── Utilidad ────────────────────────────────────────────────────────────────

function formatPhoneE164(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('0')) cleaned = '+56' + cleaned.slice(1)
  if (cleaned.startsWith('9') && cleaned.length === 9) cleaned = '+56' + cleaned
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned
  // Validación básica: al menos 10 dígitos después del +
  if (cleaned.length < 11) return null
  return cleaned
}

module.exports = router
