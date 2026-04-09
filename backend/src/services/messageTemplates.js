/**
 * Plantillas de mensajes WhatsApp para Aseo Alerta
 * Todos los mensajes en español chileno, claros y directos.
 */

// ─── Mensajes al CLEANER ─────────────────────────────────────────────────────

/**
 * Nueva reserva detectada → aviso al cleaner
 */
function buildCleanerNewReservation({ propertyName, ownerName, checkinDate, checkinTime, checkoutDate, checkoutTime, guestName }) {
  return `🏠 *Aviso de limpieza — ${propertyName}*
De parte de ${ownerName || 'el dueño'}

📅 Check-in: ${checkinDate} a las ${checkinTime || '15:00'}
📅 Check-out: ${checkoutDate} a las ${checkoutTime || '11:00'}
👤 Huésped: ${guestName || 'Sin nombre'}

Por favor confirma que puedes encargarte respondiendo a este mensaje.

¡Gracias! 🙏`
}

/**
 * Recordatorio pre-checkout → cleaner
 */
function buildCleanerPreCheckout({ propertyName, ownerName, checkoutDate, checkoutTime, guestName, nextCheckinDate, nextCheckinTime }) {
  let msg = `🔔 *Recordatorio de limpieza — ${propertyName}*
De parte de ${ownerName || 'el dueño'}

⏰ Mañana ${checkoutDate} a las ${checkoutTime || '11:00'} es el checkout.

👤 Huésped actual: ${guestName || 'Sin nombre'}`

  if (nextCheckinDate) {
    msg += `\n📅 Próximo check-in: ${nextCheckinDate} a las ${nextCheckinTime || '15:00'}`
  }

  msg += `\n\nPor favor confirma que estás lista respondiendo a este mensaje. ¡Gracias!`
  return msg
}

/**
 * Reenvío de mensaje al cleaner (escalación)
 */
function buildCleanerResend({ propertyName, ownerName, checkoutDate, checkoutTime, guestName }) {
  return `🔄 *Recordatorio urgente — ${propertyName}*
De parte de ${ownerName || 'el dueño'}

📅 Checkout: ${checkoutDate} a las ${checkoutTime || '11:00'}
👤 Huésped: ${guestName || 'Sin nombre'}

⚠️ Este es un recordatorio. Por favor confirma que puedes encargarte del aseo.

Responde a este mensaje para confirmar. 🙏`
}

// ─── Mensajes al OWNER (dueño) ──────────────────────────────────────────────

/**
 * Notificación enviada al cleaner → confirmar al owner
 */
function buildOwnerNotificationSent({ cleanerName, propertyName, checkoutDate }) {
  return `✅ *Notificación enviada*
Se envió el aviso de limpieza a ${cleanerName} para ${propertyName}.

📅 Checkout: ${checkoutDate}
📱 Estado: Enviado

Te avisaremos cuando lo lea y responda.`
}

/**
 * El cleaner leyó el mensaje
 */
function buildOwnerMessageRead({ cleanerName, propertyName }) {
  return `👀 *Mensaje leído*
${cleanerName} leyó el aviso de limpieza para ${propertyName}.

Esperando su confirmación...`
}

/**
 * El cleaner confirmó
 */
function buildOwnerCleanerConfirmed({ cleanerName, propertyName, replyText, checkoutDate, checkoutTime }) {
  return `✅ *¡Confirmado!*
${cleanerName} confirmó la limpieza de ${propertyName}.

💬 Respondió: "${replyText}"

📅 Checkout: ${checkoutDate} a las ${checkoutTime || '11:00'}`
}

/**
 * Sin respuesta → escalación al owner
 */
function buildOwnerEscalation({ cleanerName, propertyName, checkoutDate, hours }) {
  return `⚠️ *Sin respuesta — ${propertyName}*

${cleanerName} no ha respondido al aviso de limpieza después de ${hours || 2}h.

📅 Checkout: ${checkoutDate}

¿Qué quieres hacer?
1️⃣ Reenviar mensaje
2️⃣ Yo la llamo directamente
3️⃣ Cambiar contacto de limpieza
4️⃣ Ya está resuelto

Responde con el número de tu opción.`
}

/**
 * Re-escalación (recordatorio de escalación)
 */
function buildOwnerReEscalation({ cleanerName, propertyName, checkoutDate, escalationCount }) {
  return `🔴 *Recordatorio urgente — ${propertyName}*

${cleanerName} sigue sin responder (intento #${escalationCount}).

📅 Checkout: ${checkoutDate}

Responde:
1️⃣ Reenviar mensaje
2️⃣ Yo la llamo
3️⃣ Cambiar contacto
4️⃣ Ya está resuelto`
}

/**
 * Acción del owner registrada
 */
function buildOwnerActionConfirmation({ action }) {
  const descriptions = {
    resend:          '📤 Se reenviará el mensaje al encargado de limpieza.',
    will_call:       '📞 Registrado. Tú te encargarás de contactar directamente.',
    change_cleaner:  '🔄 Cambio de contacto registrado. Se enviará aviso al nuevo encargado.',
    mark_resolved:   '✅ Marcado como resuelto.',
  }
  return `👍 *Acción registrada*
${descriptions[action] || 'Acción procesada.'}

Te mantendremos informado.`
}

/**
 * Modo approval: pedir aprobación al owner para enviar aviso
 */
function buildOwnerApprovalRequest({ propertyName, cleanerName, checkoutDate, checkoutTime, guestName }) {
  return `📋 *Nueva reserva detectada — ${propertyName}*

👤 Huésped: ${guestName || 'Sin nombre'}
📅 Checkout: ${checkoutDate} a las ${checkoutTime || '11:00'}
🧹 Encargada: ${cleanerName}

¿Envío el aviso de limpieza a ${cleanerName}?

1️⃣ Sí, enviar aviso
2️⃣ No, yo me encargo

Responde con 1 o 2.`
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Parsear respuesta del owner a escalación
 */
function parseOwnerEscalationReply(text) {
  const trimmed = text.trim()
  const map = {
    '1': 'resend',
    '2': 'will_call',
    '3': 'change_cleaner',
    '4': 'mark_resolved',
  }
  return map[trimmed] || null
}

/**
 * Parsear respuesta del owner a approval
 */
function parseOwnerApprovalReply(text) {
  const trimmed = text.trim()
  if (trimmed === '1') return 'approve'
  if (trimmed === '2') return 'reject'
  return null
}

/**
 * Formatear fecha para mensajes
 */
function formatDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('es-CL', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })
}

module.exports = {
  // Cleaner messages
  buildCleanerNewReservation,
  buildCleanerPreCheckout,
  buildCleanerResend,
  // Owner messages
  buildOwnerNotificationSent,
  buildOwnerMessageRead,
  buildOwnerCleanerConfirmed,
  buildOwnerEscalation,
  buildOwnerReEscalation,
  buildOwnerActionConfirmation,
  buildOwnerApprovalRequest,
  // Parsers
  parseOwnerEscalationReply,
  parseOwnerApprovalReply,
  // Utils
  formatDate,
}
