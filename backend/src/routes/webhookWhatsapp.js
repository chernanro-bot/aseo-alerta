const express = require('express')
const router  = express.Router()
const { supabase }             = require('../lib/supabase')
const { verifyKapsoSignature } = require('../middleware/webhookAuth')
const { transitionNotification, logMessage, logOwnerAction } = require('../services/stateMachine')
const { notifyOwnerRead, notifyOwnerConfirmed, notifyOwnerActionConfirmation } = require('../services/ownerNotifier')
const { parseOwnerEscalationReply, parseOwnerApprovalReply } = require('../services/messageTemplates')
const { sendWhatsApp } = require('../services/whatsapp')

/**
 * GET /api/webhook/whatsapp
 * Verificación del webhook (challenge de Meta/Kapso).
 */
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const verifyToken = process.env.KAPSO_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Webhook] ✅ Verificación exitosa')
    return res.status(200).send(challenge)
  }

  // Kapso puede verificar sin hub.mode
  if (token === verifyToken && challenge) {
    console.log('[Webhook] ✅ Verificación exitosa (Kapso)')
    return res.status(200).send(challenge)
  }

  console.warn('[Webhook] ❌ Verificación fallida')
  return res.status(403).json({ error: 'Verificación fallida' })
})

/**
 * POST /api/webhook/whatsapp
 * Recibir webhooks de Kapso (status updates + incoming messages).
 *
 * Kapso envía dos tipos de webhook:
 * 1. Kapso nativo: headers X-Webhook-Event, X-Webhook-Signature
 * 2. Meta forward: payload estándar de WhatsApp Business API
 */
router.post('/', verifyKapsoSignature, async (req, res) => {
  // SIEMPRE responder 200 para evitar reintentos
  res.status(200).json({ status: 'ok' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const webhookEvent = req.headers['x-webhook-event']

    console.log(`[Webhook] Evento recibido: ${webhookEvent || 'meta-forward'}`)

    // Detectar formato: Kapso nativo vs Meta forward
    if (webhookEvent) {
      // Formato Kapso nativo
      await handleKapsoNativeWebhook(webhookEvent, body)
    } else if (body?.entry) {
      // Formato Meta forward (WhatsApp Business API estándar)
      await handleMetaForwardWebhook(body)
    } else {
      console.log('[Webhook] Formato no reconocido:', JSON.stringify(body).substring(0, 200))
    }
  } catch (err) {
    console.error('[Webhook] Error procesando:', err.message)
  }
})

// ─── Kapso Native Webhook Handler ────────────────────────────────────────────

async function handleKapsoNativeWebhook(event, body) {
  console.log(`[Webhook/Kapso] Evento: ${event}`)

  switch (event) {
    case 'whatsapp.message.received':
      // Mensaje entrante (respuesta del cleaner o owner)
      await handleIncomingMessage({
        from:    body.from || body.sender?.phone,
        text:    { body: body.text || body.message?.text || body.body || '' },
        id:      body.message_id || body.id,
        type:    body.type || 'text',
        context: body.context,
      })
      break

    case 'whatsapp.message.sent':
    case 'whatsapp.message.delivered':
    case 'whatsapp.message.read':
    case 'whatsapp.message.failed':
      // Status update de mensaje saliente
      const status = event.split('.').pop() // sent, delivered, read, failed
      await handleStatusUpdate({
        id:           body.message_id || body.id,
        status:       status,
        timestamp:    body.timestamp || String(Math.floor(Date.now() / 1000)),
        recipient_id: body.to || body.recipient?.phone,
        errors:       body.errors,
      })
      break

    default:
      console.log(`[Webhook/Kapso] Evento no manejado: ${event}`)
  }
}

// ─── Meta Forward Webhook Handler ────────────────────────────────────────────

async function handleMetaForwardWebhook(body) {
  const entry = body?.entry?.[0]
  const changes = entry?.changes?.[0]?.value

  if (!changes) {
    console.log('[Webhook/Meta] Payload sin cambios relevantes')
    return
  }

  // Tipo A: Status Updates (mensaje saliente)
  if (changes.statuses?.length > 0) {
    for (const statusUpdate of changes.statuses) {
      await handleStatusUpdate(statusUpdate)
    }
  }

  // Tipo B: Incoming Messages (respuesta)
  if (changes.messages?.length > 0) {
    for (const incomingMsg of changes.messages) {
      await handleIncomingMessage(incomingMsg)
    }
  }
}

// ─── Handlers compartidos ────────────────────────────────────────────────────

/**
 * Procesar status update de un mensaje saliente.
 */
async function handleStatusUpdate(statusUpdate) {
  const { id: waMessageId, status, timestamp, recipient_id } = statusUpdate

  console.log(`[Webhook] Status: ${waMessageId} → ${status}`)

  // Buscar en messages_log
  const { data: msgLog } = await supabase
    .from('messages_log')
    .select('id, notification_id, status as current_status')
    .or(`kapso_message_id.eq.${waMessageId},wa_message_id.eq.${waMessageId}`)
    .limit(1)
    .single()

  if (!msgLog) {
    console.log(`[Webhook] Message ID ${waMessageId} no encontrado en messages_log`)
    return
  }

  // Actualizar estado del mensaje
  const updates = { status, wa_message_id: waMessageId }
  const ts = timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString()

  if (status === 'sent')      updates.sent_at      = ts
  if (status === 'delivered') updates.delivered_at = ts
  if (status === 'read')      updates.read_at      = ts
  if (status === 'failed') {
    updates.error_code   = statusUpdate.errors?.[0]?.code || 'unknown'
    updates.error_detail = statusUpdate.errors?.[0]?.title || 'Error desconocido'
  }

  await supabase.from('messages_log').update(updates).eq('id', msgLog.id)

  // Actualizar timestamps en la notificación
  if (msgLog.notification_id) {
    const notifUpdates = {}
    if (status === 'delivered') notifUpdates.delivered_at = ts
    if (status === 'read')     notifUpdates.read_at      = ts

    if (Object.keys(notifUpdates).length > 0) {
      await supabase.from('notifications').update(notifUpdates).eq('id', msgLog.notification_id)
    }

    if (status === 'read') {
      await notifyOwnerRead(msgLog.notification_id)
    }
  }
}

/**
 * Procesar mensaje entrante (respuesta del cleaner o del owner).
 */
async function handleIncomingMessage(incomingMsg) {
  const phoneFrom   = String(incomingMsg.from || '').replace('+', '')
  const messageText = incomingMsg.text?.body || incomingMsg.text || ''

  console.log(`[Webhook] Mensaje de ${phoneFrom}: "${messageText.substring(0, 50)}..."`)

  // Buscar como cleaner (intentar con y sin +)
  const { data: cleaner } = await supabase
    .from('cleaners')
    .select('id, name, user_id')
    .or(`phone.eq.+${phoneFrom},phone.eq.${phoneFrom}`)
    .eq('active', true)
    .limit(1)
    .single()

  if (cleaner) {
    await handleCleanerReply(cleaner, messageText, phoneFrom, incomingMsg)
    return
  }

  // Buscar como owner
  const { data: ownerProperty } = await supabase
    .from('properties')
    .select('id, name, user_id, owner_phone')
    .or(`owner_phone.eq.+${phoneFrom},owner_phone.eq.${phoneFrom}`)
    .eq('active', true)
    .limit(1)
    .single()

  if (ownerProperty) {
    await handleOwnerReply(ownerProperty, messageText, phoneFrom, incomingMsg)
    return
  }

  console.log(`[Webhook] Número ${phoneFrom} no reconocido`)
}

/**
 * Procesar respuesta del cleaner → confirmar notificación
 */
async function handleCleanerReply(cleaner, messageText, phoneFrom, rawMsg) {
  const { data: notification } = await supabase
    .from('notifications')
    .select('id, status, property_id')
    .eq('cleaner_id', cleaner.id)
    .in('status', ['notified', 'no_response', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!notification) {
    console.log(`[Webhook] Sin notificación activa para cleaner ${cleaner.name}`)
    return
  }

  await logMessage({
    notificationId: notification.id,
    waMessageId:    rawMsg.id,
    direction:      'inbound',
    content:        messageText,
    phoneFrom:      '+' + phoneFrom,
    status:         'received',
  })

  if (['notified', 'no_response'].includes(notification.status)) {
    try {
      await transitionNotification(notification.id, 'confirmed', { reply_text: messageText })
      await notifyOwnerConfirmed(notification.id, messageText)
      console.log(`[Webhook] ✅ Cleaner ${cleaner.name} confirmó`)
    } catch (err) {
      console.error(`[Webhook] Error confirmando:`, err.message)
    }
  } else if (notification.status === 'escalated') {
    try {
      await supabase.from('notifications').update({
        status:      'confirmed',
        reply_text:  messageText,
        replied_at:  new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        resolved_by: 'cleaner_reply',
      }).eq('id', notification.id)

      await notifyOwnerConfirmed(notification.id, messageText)
      console.log(`[Webhook] ✅ Cleaner ${cleaner.name} respondió tarde (escalada → confirmada)`)
    } catch (err) {
      console.error(`[Webhook] Error resolviendo escalada:`, err.message)
    }
  }
}

/**
 * Procesar respuesta del owner (a escalaciones o aprobaciones)
 */
async function handleOwnerReply(ownerProperty, messageText, phoneFrom, rawMsg) {
  const { data: notification } = await supabase
    .from('notifications')
    .select('id, status, property_id, cleaner_id')
    .eq('property_id', ownerProperty.id)
    .in('status', ['escalated', 'pending_approval'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!notification) {
    console.log(`[Webhook] Sin notificación pendiente para owner de ${ownerProperty.name}`)
    return
  }

  await logMessage({
    notificationId: notification.id,
    waMessageId:    rawMsg.id,
    direction:      'inbound',
    content:        messageText,
    phoneFrom:      '+' + phoneFrom,
    status:         'received',
  })

  if (notification.status === 'escalated') {
    const action = parseOwnerEscalationReply(messageText)

    if (!action) {
      await sendWhatsApp('+' + phoneFrom, 'No entendí tu respuesta. Responde con 1, 2, 3 o 4.')
      return
    }

    await logOwnerAction({
      notificationId: notification.id,
      userId:         ownerProperty.user_id,
      action:         action === 'mark_resolved' ? 'mark_resolved' : action,
    })

    switch (action) {
      case 'resend': {
        await transitionNotification(notification.id, 'notified')
        const { data: cleanerData } = await supabase
          .from('cleaners').select('phone').eq('id', notification.cleaner_id).single()
        if (cleanerData) {
          const templates = require('../services/messageTemplates')
          const ownerNotifier = require('../services/ownerNotifier')
          const ctx = await ownerNotifier.getNotificationContext(notification.id)
          const msg = templates.buildCleanerResend({
            propertyName: ctx.property.name,
            ownerName:    'el dueño',
            checkoutDate: templates.formatDate(ctx.reservation.checkout),
            checkoutTime: ctx.property.checkout_time,
            guestName:    ctx.reservation.guest_name,
          })
          const result = await sendWhatsApp(cleanerData.phone, msg)
          await logMessage({
            notificationId: notification.id,
            kapsoMessageId: result?.messages?.[0]?.id || null,
            direction: 'outbound', content: msg,
            phoneTo: cleanerData.phone, status: 'queued',
          })
        }
        break
      }
      case 'will_call':
        await transitionNotification(notification.id, 'resolved', { resolved_by: 'owner_call' })
        break
      case 'change_cleaner':
        await sendWhatsApp('+' + phoneFrom, 'Para cambiar el contacto de limpieza, ingresa a la app web y actualiza la propiedad.')
        break
      case 'mark_resolved':
        await transitionNotification(notification.id, 'resolved', { resolved_by: 'owner_manual' })
        break
    }

    await notifyOwnerActionConfirmation('+' + phoneFrom, action)

  } else if (notification.status === 'pending_approval') {
    const approval = parseOwnerApprovalReply(messageText)

    if (!approval) {
      await sendWhatsApp('+' + phoneFrom, 'No entendí tu respuesta. Responde con 1 (enviar aviso) o 2 (yo me encargo).')
      return
    }

    await logOwnerAction({
      notificationId: notification.id,
      userId:         ownerProperty.user_id,
      action:         approval === 'approve' ? 'approved' : 'mark_resolved',
    })

    if (approval === 'approve') {
      await transitionNotification(notification.id, 'pending_notification')
      const templates = require('../services/messageTemplates')
      const ownerNotifier = require('../services/ownerNotifier')
      const ctx = await ownerNotifier.getNotificationContext(notification.id)
      const msg = templates.buildCleanerNewReservation({
        propertyName: ctx.property.name,
        ownerName:    'el dueño',
        checkinDate:  templates.formatDate(ctx.reservation.checkin),
        checkinTime:  ctx.property.checkin_time,
        checkoutDate: templates.formatDate(ctx.reservation.checkout),
        checkoutTime: ctx.property.checkout_time,
        guestName:    ctx.reservation.guest_name,
      })
      const { data: cleanerData } = await supabase
        .from('cleaners').select('phone').eq('id', notification.cleaner_id).single()

      if (cleanerData) {
        const result = await sendWhatsApp(cleanerData.phone, msg)
        await logMessage({
          notificationId: notification.id,
          kapsoMessageId: result?.messages?.[0]?.id || null,
          direction: 'outbound', content: msg,
          phoneTo: cleanerData.phone, status: 'queued',
        })
        await transitionNotification(notification.id, 'notified', { message_text: msg })
        await ownerNotifier.notifyOwnerSent(notification.id)
      }
      await sendWhatsApp('+' + phoneFrom, '✅ Aviso enviado al encargado de limpieza.')
    } else {
      await transitionNotification(notification.id, 'resolved', { resolved_by: 'owner_rejected' })
      await sendWhatsApp('+' + phoneFrom, '👍 Entendido. Tú te encargas de coordinar.')
    }
  }
}

module.exports = router
