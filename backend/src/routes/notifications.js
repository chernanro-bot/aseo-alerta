const express = require('express')
const router  = express.Router()
const { supabase }    = require('../lib/supabase')
const { requireAuth } = require('../middleware/auth')
const { transitionNotification, logOwnerAction, logMessage } = require('../services/stateMachine')
const { sendWhatsApp } = require('../services/whatsapp')
const { notifyOwnerSent } = require('../services/ownerNotifier')
const templates = require('../services/messageTemplates')

router.use(requireAuth)

/**
 * GET /api/notifications
 * Listar todas las notificaciones del usuario (todas las propiedades).
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        property:properties!inner(id, name, user_id),
        reservation:reservations(id, checkin, checkout, guest_name),
        cleaner:cleaners(id, name, phone)
      `)
      .eq('property.user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('[Notifications] Error listing:', err.message)
    res.status(500).json({ error: 'Error al obtener notificaciones' })
  }
})

/**
 * GET /api/notifications/:id
 * Detalle de una notificación con su historial de mensajes.
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .select(`
        *,
        property:properties!inner(id, name, user_id, checkout_time),
        reservation:reservations(id, checkin, checkout, guest_name),
        cleaner:cleaners(id, name, phone)
      `)
      .eq('id', req.params.id)
      .eq('property.user_id', req.user.id)
      .single()

    if (error || !notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' })
    }

    // Obtener historial de mensajes
    const { data: messages } = await supabase
      .from('messages_log')
      .select('*')
      .eq('notification_id', req.params.id)
      .order('created_at', { ascending: true })

    // Obtener acciones del owner
    const { data: actions } = await supabase
      .from('owner_actions_log')
      .select('*')
      .eq('notification_id', req.params.id)
      .order('created_at', { ascending: true })

    res.json({
      ...notification,
      messages: messages || [],
      owner_actions: actions || [],
    })
  } catch (err) {
    console.error('[Notifications] Error getting detail:', err.message)
    res.status(500).json({ error: 'Error al obtener notificación' })
  }
})

/**
 * POST /api/notifications/:id/approve
 * Aprobar envío de mensaje (modo approval).
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const notification = await verifyOwnership(req.params.id, req.user.id)
    if (!notification) return res.status(404).json({ error: 'No encontrada' })

    if (notification.status !== 'pending_approval') {
      return res.status(400).json({ error: `Estado actual: ${notification.status}. Solo se puede aprobar desde pending_approval.` })
    }

    // Transicionar y enviar
    await transitionNotification(notification.id, 'pending_notification')

    await logOwnerAction({
      notificationId: notification.id,
      userId:         req.user.id,
      action:         'approved',
    })

    // Enviar mensaje al cleaner
    const ctx = await require('../services/ownerNotifier').getNotificationContext(notification.id)
    const msg = templates.buildCleanerNewReservation({
      propertyName: ctx.property.name,
      ownerName:    'el dueño',
      checkinDate:  templates.formatDate(ctx.reservation.checkin),
      checkinTime:  ctx.property.checkin_time,
      checkoutDate: templates.formatDate(ctx.reservation.checkout),
      checkoutTime: ctx.property.checkout_time,
      guestName:    ctx.reservation.guest_name,
    })

    const result = await sendWhatsApp(ctx.cleaner.phone, msg)

    await logMessage({
      notificationId: notification.id,
      kapsoMessageId: result?.messages?.[0]?.id || null,
      direction:      'outbound',
      content:        msg,
      phoneTo:        ctx.cleaner.phone,
      status:         'queued',
    })

    await transitionNotification(notification.id, 'notified', { message_text: msg })
    await notifyOwnerSent(notification.id)

    res.json({ success: true, status: 'notified' })
  } catch (err) {
    console.error('[Notifications] Error approving:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/notifications/:id/resolve
 * Marcar como resuelto manualmente.
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const notification = await verifyOwnership(req.params.id, req.user.id)
    if (!notification) return res.status(404).json({ error: 'No encontrada' })

    const allowedStatuses = ['notified', 'no_response', 'escalated', 'confirmed']
    if (!allowedStatuses.includes(notification.status)) {
      return res.status(400).json({ error: `No se puede resolver desde estado: ${notification.status}` })
    }

    // Si está en confirmed, resolver directamente
    if (notification.status === 'confirmed') {
      await transitionNotification(notification.id, 'resolved', { resolved_by: 'owner_manual' })
    } else {
      // Para otros estados, forzar resolución
      await supabase
        .from('notifications')
        .update({
          status:      'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'owner_manual',
        })
        .eq('id', notification.id)
    }

    await logOwnerAction({
      notificationId: notification.id,
      userId:         req.user.id,
      action:         'mark_resolved',
    })

    res.json({ success: true, status: 'resolved' })
  } catch (err) {
    console.error('[Notifications] Error resolving:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/notifications/:id/resend
 * Reenviar mensaje al cleaner.
 */
router.post('/:id/resend', async (req, res) => {
  try {
    const notification = await verifyOwnership(req.params.id, req.user.id)
    if (!notification) return res.status(404).json({ error: 'No encontrada' })

    if (!['notified', 'no_response', 'escalated'].includes(notification.status)) {
      return res.status(400).json({ error: `No se puede reenviar desde estado: ${notification.status}` })
    }

    const ctx = await require('../services/ownerNotifier').getNotificationContext(notification.id)
    const msg = templates.buildCleanerResend({
      propertyName: ctx.property.name,
      ownerName:    'el dueño',
      checkoutDate: templates.formatDate(ctx.reservation.checkout),
      checkoutTime: ctx.property.checkout_time,
      guestName:    ctx.reservation.guest_name,
    })

    const result = await sendWhatsApp(ctx.cleaner.phone, msg)

    await logMessage({
      notificationId: notification.id,
      kapsoMessageId: result?.messages?.[0]?.id || null,
      direction:      'outbound',
      content:        msg,
      phoneTo:        ctx.cleaner.phone,
      status:         'queued',
    })

    // Si estaba escalada, volver a notified
    if (notification.status === 'escalated') {
      await transitionNotification(notification.id, 'notified', {
        sent_at: new Date().toISOString(),
      })
    }

    await logOwnerAction({
      notificationId: notification.id,
      userId:         req.user.id,
      action:         'resend',
    })

    res.json({ success: true, status: 'resent' })
  } catch (err) {
    console.error('[Notifications] Error resending:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/notifications/:id/action
 * Registrar acción genérica del dueño.
 */
router.post('/:id/action', async (req, res) => {
  const { action, metadata } = req.body
  const validActions = ['will_call', 'change_cleaner', 'mark_resolved']

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `Acción inválida. Opciones: ${validActions.join(', ')}` })
  }

  try {
    const notification = await verifyOwnership(req.params.id, req.user.id)
    if (!notification) return res.status(404).json({ error: 'No encontrada' })

    await logOwnerAction({
      notificationId: notification.id,
      userId:         req.user.id,
      action,
      metadata,
    })

    if (action === 'will_call' || action === 'mark_resolved') {
      await supabase
        .from('notifications')
        .update({
          status:      'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: action === 'will_call' ? 'owner_call' : 'owner_manual',
        })
        .eq('id', notification.id)
    }

    res.json({ success: true, action })
  } catch (err) {
    console.error('[Notifications] Error action:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Utilidad ────────────────────────────────────────────────────────────────

async function verifyOwnership(notificationId, userId) {
  const { data } = await supabase
    .from('notifications')
    .select(`
      *,
      property:properties!inner(id, user_id)
    `)
    .eq('id', notificationId)
    .eq('property.user_id', userId)
    .single()
  return data
}

module.exports = router
