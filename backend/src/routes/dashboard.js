const express = require('express')
const router  = express.Router()
const { supabase }    = require('../lib/supabase')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

/**
 * GET /api/dashboard/summary
 * Resumen del estado de notificaciones del usuario.
 */
router.get('/summary', async (req, res) => {
  try {
    // Obtener todas las notificaciones del usuario
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        id, status, type, created_at, sent_at, replied_at,
        property:properties!inner(id, name, user_id),
        reservation:reservations(checkout, guest_name),
        cleaner:cleaners(name)
      `)
      .eq('property.user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const notifs = notifications || []

    // Conteo por estado
    const statusCounts = {
      pending_approval:     0,
      pending_notification: 0,
      notified:             0,
      confirmed:            0,
      no_response:          0,
      escalated:            0,
      resolved:             0,
    }

    for (const n of notifs) {
      if (statusCounts[n.status] !== undefined) {
        statusCounts[n.status]++
      }
    }

    // Notificaciones que requieren atención
    const needsAttention = notifs.filter(n =>
      ['pending_approval', 'escalated', 'no_response'].includes(n.status)
    )

    // Notificaciones activas (no resueltas)
    const activeCount = notifs.filter(n => n.status !== 'resolved').length

    // Próximos checkouts con notificación
    const upcomingCheckouts = notifs
      .filter(n =>
        n.status !== 'resolved' &&
        n.reservation?.checkout &&
        new Date(n.reservation.checkout) >= new Date()
      )
      .sort((a, b) => new Date(a.reservation.checkout) - new Date(b.reservation.checkout))
      .slice(0, 5)

    res.json({
      total:             notifs.length,
      active:            activeCount,
      needs_attention:   needsAttention.length,
      status_counts:     statusCounts,
      attention_items:   needsAttention.slice(0, 10),
      upcoming_checkouts: upcomingCheckouts,
    })
  } catch (err) {
    console.error('[Dashboard] Error:', err.message)
    res.status(500).json({ error: 'Error al obtener resumen' })
  }
})

module.exports = router
