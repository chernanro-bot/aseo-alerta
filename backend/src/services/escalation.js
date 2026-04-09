const { supabase } = require('../lib/supabase')
const { transitionNotification } = require('./stateMachine')
const { notifyOwnerEscalation }  = require('./ownerNotifier')

/**
 * Servicio de escalación automática.
 * Detecta notificaciones sin respuesta y escala al dueño.
 */

/**
 * Verificar notificaciones sin respuesta después de 2 horas.
 * Llamado por el cron job cada 30 minutos.
 */
async function checkEscalations() {
  console.log('[Escalation] Verificando notificaciones sin respuesta...')

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Buscar notificaciones enviadas hace más de 2h sin respuesta
    const { data: staleNotifs, error } = await supabase
      .from('notifications')
      .select(`
        id, status, sent_at, read_at, replied_at,
        property:properties(id, name, owner_phone),
        cleaner:cleaners(id, name)
      `)
      .eq('status', 'notified')
      .lt('sent_at', twoHoursAgo)
      .is('replied_at', null)

    if (error) throw error
    if (!staleNotifs?.length) {
      console.log('[Escalation] Sin notificaciones pendientes de escalación')
      return { escalated: 0 }
    }

    console.log(`[Escalation] ${staleNotifs.length} notificación(es) sin respuesta`)

    let escalated = 0
    for (const notif of staleNotifs) {
      try {
        // Transicionar: notified → no_response → escalated
        await transitionNotification(notif.id, 'no_response')
        await transitionNotification(notif.id, 'escalated')

        // Enviar escalación al owner
        await notifyOwnerEscalation(notif.id)

        escalated++
        console.log(`[Escalation] ✅ Escalada: ${notif.property?.name} (cleaner: ${notif.cleaner?.name})`)
      } catch (err) {
        console.error(`[Escalation] ❌ Error escalando ${notif.id}:`, err.message)
      }
    }

    console.log(`[Escalation] Completado: ${escalated}/${staleNotifs.length} escaladas`)
    return { escalated }
  } catch (err) {
    console.error('[Escalation] Error general:', err.message)
    return { escalated: 0, error: err.message }
  }
}

/**
 * Re-escalar notificaciones que ya fueron escaladas pero el owner no respondió.
 * Llamado cada 4 horas. Max 3 re-escalaciones.
 */
async function checkReEscalations() {
  console.log('[Escalation] Verificando re-escalaciones...')

  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

    const { data: escalatedNotifs, error } = await supabase
      .from('notifications')
      .select(`
        id, escalation_count, escalated_at,
        property:properties(id, name, owner_phone),
        cleaner:cleaners(id, name)
      `)
      .eq('status', 'escalated')
      .lt('escalated_at', fourHoursAgo)
      .lt('escalation_count', 3)

    if (error) throw error
    if (!escalatedNotifs?.length) {
      console.log('[Escalation] Sin re-escalaciones pendientes')
      return { reEscalated: 0 }
    }

    let reEscalated = 0
    for (const notif of escalatedNotifs) {
      try {
        // Incrementar contador y re-enviar
        await supabase
          .from('notifications')
          .update({
            escalation_count: (notif.escalation_count || 0) + 1,
            escalated_at:     new Date().toISOString(),
          })
          .eq('id', notif.id)

        await notifyOwnerEscalation(notif.id)
        reEscalated++
        console.log(`[Escalation] 🔄 Re-escalada: ${notif.property?.name} (intento #${notif.escalation_count + 1})`)
      } catch (err) {
        console.error(`[Escalation] Error re-escalando ${notif.id}:`, err.message)
      }
    }

    return { reEscalated }
  } catch (err) {
    console.error('[Escalation] Error en re-escalación:', err.message)
    return { reEscalated: 0 }
  }
}

/**
 * Auto-resolver notificaciones donde el checkout ya pasó.
 * Llamado una vez al día (nocturno).
 */
async function cleanupStaleNotifications() {
  console.log('[Escalation] Limpiando notificaciones vencidas...')

  try {
    const now = new Date().toISOString()

    // Buscar notificaciones activas donde el checkout ya pasó
    const { data: stale, error } = await supabase
      .from('notifications')
      .select(`
        id, status,
        reservation:reservations(checkout)
      `)
      .in('status', ['pending_approval', 'pending_notification', 'notified', 'no_response', 'escalated'])

    if (error) throw error
    if (!stale?.length) {
      console.log('[Escalation] Sin notificaciones vencidas')
      return { cleaned: 0 }
    }

    let cleaned = 0
    for (const notif of stale) {
      // Si el checkout ya pasó
      if (notif.reservation?.checkout && new Date(notif.reservation.checkout) < new Date(now)) {
        try {
          await supabase
            .from('notifications')
            .update({
              status:      'resolved',
              resolved_at: now,
              resolved_by: 'auto_expired',
            })
            .eq('id', notif.id)

          cleaned++
        } catch (err) {
          console.error(`[Escalation] Error limpiando ${notif.id}:`, err.message)
        }
      }
    }

    console.log(`[Escalation] ${cleaned} notificación(es) auto-resueltas`)
    return { cleaned }
  } catch (err) {
    console.error('[Escalation] Error en cleanup:', err.message)
    return { cleaned: 0 }
  }
}

module.exports = {
  checkEscalations,
  checkReEscalations,
  cleanupStaleNotifications,
}
