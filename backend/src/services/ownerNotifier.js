const { sendWhatsApp } = require('./whatsapp')
const { logMessage }   = require('./stateMachine')
const templates        = require('./messageTemplates')
const { supabase }     = require('../lib/supabase')

/**
 * Servicio para enviar notificaciones al dueño de la propiedad.
 * En MVP v1, se envían por WhatsApp al número owner_phone de la propiedad.
 */

/**
 * Obtener datos completos de una notificación para generar mensajes.
 */
async function getNotificationContext(notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      property:properties(id, name, owner_phone, checkout_time, checkin_time, user_id),
      reservation:reservations(id, checkin, checkout, guest_name),
      cleaner:cleaners(id, name, phone)
    `)
    .eq('id', notificationId)
    .single()

  if (error || !data) {
    throw new Error(`No se encontró contexto para notificación ${notificationId}`)
  }
  return data
}

/**
 * Notificar al owner que se envió el mensaje al cleaner
 */
async function notifyOwnerSent(notificationId) {
  try {
    const ctx = await getNotificationContext(notificationId)
    if (!ctx.property?.owner_phone) {
      console.log('[OwnerNotifier] Sin owner_phone, saltando notificación')
      return
    }

    const message = templates.buildOwnerNotificationSent({
      cleanerName:  ctx.cleaner.name,
      propertyName: ctx.property.name,
      checkoutDate: templates.formatDate(ctx.reservation.checkout),
    })

    const result = await sendWhatsApp(ctx.property.owner_phone, message)

    await logMessage({
      notificationId,
      kapsoMessageId: result?.messages?.[0]?.id || null,
      direction:      'outbound',
      content:        message,
      phoneTo:        ctx.property.owner_phone,
      status:         'sent',
    })

    console.log(`[OwnerNotifier] Notificación "enviado" al owner de ${ctx.property.name}`)
  } catch (err) {
    console.error('[OwnerNotifier] Error notificando envío:', err.message)
  }
}

/**
 * Notificar al owner que el cleaner leyó el mensaje
 */
async function notifyOwnerRead(notificationId) {
  try {
    const ctx = await getNotificationContext(notificationId)
    if (!ctx.property?.owner_phone) return

    const message = templates.buildOwnerMessageRead({
      cleanerName:  ctx.cleaner.name,
      propertyName: ctx.property.name,
    })

    await sendWhatsApp(ctx.property.owner_phone, message)
    console.log(`[OwnerNotifier] Notificación "leído" al owner de ${ctx.property.name}`)
  } catch (err) {
    console.error('[OwnerNotifier] Error notificando lectura:', err.message)
  }
}

/**
 * Notificar al owner que el cleaner confirmó
 */
async function notifyOwnerConfirmed(notificationId, replyText) {
  try {
    const ctx = await getNotificationContext(notificationId)
    if (!ctx.property?.owner_phone) return

    const message = templates.buildOwnerCleanerConfirmed({
      cleanerName:  ctx.cleaner.name,
      propertyName: ctx.property.name,
      replyText:    replyText || 'OK',
      checkoutDate: templates.formatDate(ctx.reservation.checkout),
      checkoutTime: ctx.property.checkout_time,
    })

    await sendWhatsApp(ctx.property.owner_phone, message)
    console.log(`[OwnerNotifier] Notificación "confirmado" al owner de ${ctx.property.name}`)
  } catch (err) {
    console.error('[OwnerNotifier] Error notificando confirmación:', err.message)
  }
}

/**
 * Enviar escalación al owner
 */
async function notifyOwnerEscalation(notificationId) {
  try {
    const ctx = await getNotificationContext(notificationId)
    if (!ctx.property?.owner_phone) {
      console.warn('[OwnerNotifier] Sin owner_phone para escalación')
      return
    }

    const hours = ctx.sent_at
      ? Math.round((Date.now() - new Date(ctx.sent_at).getTime()) / (1000 * 60 * 60))
      : 2

    const message = ctx.escalation_count > 1
      ? templates.buildOwnerReEscalation({
          cleanerName:     ctx.cleaner.name,
          propertyName:    ctx.property.name,
          checkoutDate:    templates.formatDate(ctx.reservation.checkout),
          escalationCount: ctx.escalation_count,
        })
      : templates.buildOwnerEscalation({
          cleanerName:  ctx.cleaner.name,
          propertyName: ctx.property.name,
          checkoutDate: templates.formatDate(ctx.reservation.checkout),
          hours,
        })

    const result = await sendWhatsApp(ctx.property.owner_phone, message)

    await logMessage({
      notificationId,
      kapsoMessageId: result?.messages?.[0]?.id || null,
      direction:      'outbound',
      content:        message,
      phoneTo:        ctx.property.owner_phone,
      status:         'sent',
    })

    console.log(`[OwnerNotifier] Escalación enviada al owner de ${ctx.property.name}`)
  } catch (err) {
    console.error('[OwnerNotifier] Error enviando escalación:', err.message)
  }
}

/**
 * Enviar solicitud de aprobación al owner
 */
async function notifyOwnerApprovalRequest(notificationId) {
  try {
    const ctx = await getNotificationContext(notificationId)
    if (!ctx.property?.owner_phone) {
      console.warn('[OwnerNotifier] Sin owner_phone para solicitud de aprobación')
      return
    }

    const message = templates.buildOwnerApprovalRequest({
      propertyName: ctx.property.name,
      cleanerName:  ctx.cleaner.name,
      checkoutDate: templates.formatDate(ctx.reservation.checkout),
      checkoutTime: ctx.property.checkout_time,
      guestName:    ctx.reservation.guest_name,
    })

    await sendWhatsApp(ctx.property.owner_phone, message)
    console.log(`[OwnerNotifier] Solicitud de aprobación al owner de ${ctx.property.name}`)
  } catch (err) {
    console.error('[OwnerNotifier] Error enviando solicitud de aprobación:', err.message)
  }
}

/**
 * Confirmar acción del owner
 */
async function notifyOwnerActionConfirmation(ownerPhone, action) {
  try {
    if (!ownerPhone) return
    const message = templates.buildOwnerActionConfirmation({ action })
    await sendWhatsApp(ownerPhone, message)
  } catch (err) {
    console.error('[OwnerNotifier] Error confirmando acción:', err.message)
  }
}

module.exports = {
  getNotificationContext,
  notifyOwnerSent,
  notifyOwnerRead,
  notifyOwnerConfirmed,
  notifyOwnerEscalation,
  notifyOwnerApprovalRequest,
  notifyOwnerActionConfirmation,
}
