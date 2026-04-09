const { supabase } = require('../lib/supabase')

/**
 * State Machine para notificaciones de Aseo Alerta.
 *
 * Estados posibles:
 *   pending_approval → pending_notification → notified → confirmed → resolved
 *                                                     → no_response → escalated → resolved
 */

const VALID_TRANSITIONS = {
  pending_approval:     ['pending_notification', 'resolved'],
  pending_notification: ['notified'],
  notified:             ['confirmed', 'no_response', 'resolved'],
  no_response:          ['escalated'],
  escalated:            ['notified', 'resolved', 'pending_notification'],
  confirmed:            ['resolved'],
}

/**
 * Transicionar una notificación a un nuevo estado.
 * Valida la transición y actualiza timestamps según corresponda.
 *
 * @param {string} notificationId - UUID de la notificación
 * @param {string} newStatus - Nuevo estado
 * @param {Object} metadata - Datos adicionales (reply_text, resolved_by, etc.)
 * @returns {Object} La notificación actualizada
 */
async function transitionNotification(notificationId, newStatus, metadata = {}) {
  // 1. Obtener notificación actual
  const { data: notification, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single()

  if (fetchError || !notification) {
    throw new Error(`Notificación no encontrada: ${notificationId}`)
  }

  // 2. Validar transición
  const allowed = VALID_TRANSITIONS[notification.status]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Transición inválida: ${notification.status} → ${newStatus} (permitidas: ${allowed?.join(', ') || 'ninguna'})`
    )
  }

  // 3. Preparar updates según el nuevo estado
  const updates = { status: newStatus, ...metadata }

  switch (newStatus) {
    case 'notified':
      updates.sent_at = updates.sent_at || new Date().toISOString()
      break
    case 'confirmed':
      updates.replied_at = updates.replied_at || new Date().toISOString()
      break
    case 'no_response':
      // No timestamp especial, solo el cambio de estado
      break
    case 'escalated':
      updates.escalated_at = new Date().toISOString()
      updates.escalation_count = (notification.escalation_count || 0) + 1
      break
    case 'resolved':
      updates.resolved_at = new Date().toISOString()
      break
  }

  // 4. Actualizar en BD
  const { data: updated, error: updateError } = await supabase
    .from('notifications')
    .update(updates)
    .eq('id', notificationId)
    .select('*')
    .single()

  if (updateError) {
    throw new Error(`Error actualizando notificación: ${updateError.message}`)
  }

  console.log(`[StateMachine] ${notification.status} → ${newStatus} (notif: ${notificationId})`)
  return updated
}

/**
 * Crear una nueva notificación
 */
async function createNotification({ propertyId, reservationId, cleanerId, type, status, messageText }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      property_id:    propertyId,
      reservation_id: reservationId,
      cleaner_id:     cleanerId,
      type:           type,
      status:         status || 'pending_approval',
      message_text:   messageText,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Error creando notificación: ${error.message}`)
  }

  console.log(`[StateMachine] Nueva notificación creada: ${data.id} (${type}, ${data.status})`)
  return data
}

/**
 * Registrar un mensaje en messages_log
 */
async function logMessage({
  notificationId,
  kapsoMessageId,
  waMessageId,
  direction,
  messageType = 'text',
  content,
  phoneFrom,
  phoneTo,
  status = 'queued',
}) {
  const { data, error } = await supabase
    .from('messages_log')
    .insert({
      notification_id:  notificationId,
      kapso_message_id: kapsoMessageId,
      wa_message_id:    waMessageId,
      direction,
      message_type:     messageType,
      content,
      phone_from:       phoneFrom,
      phone_to:         phoneTo,
      status,
    })
    .select('*')
    .single()

  if (error) {
    console.error(`[StateMachine] Error logging message:`, error.message)
    return null
  }

  return data
}

/**
 * Registrar acción del owner
 */
async function logOwnerAction({ notificationId, userId, action, metadata }) {
  const { data, error } = await supabase
    .from('owner_actions_log')
    .insert({
      notification_id: notificationId,
      user_id:         userId,
      action,
      metadata:        metadata || null,
    })
    .select('*')
    .single()

  if (error) {
    console.error(`[StateMachine] Error logging owner action:`, error.message)
    return null
  }

  return data
}

module.exports = {
  VALID_TRANSITIONS,
  transitionNotification,
  createNotification,
  logMessage,
  logOwnerAction,
}
