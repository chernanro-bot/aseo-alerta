-- ============================================================================
-- MIGRATION 003: WhatsApp Coordination System
-- ============================================================================
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ─── NUEVA TABLA: cleaners ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cleaners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,          -- E.164: +56912345678
    notes           TEXT,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaners_user ON cleaners(user_id);

-- ─── MODIFICAR TABLA: properties ───────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='cleaner_id') THEN
        ALTER TABLE properties ADD COLUMN cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='notification_mode') THEN
        ALTER TABLE properties ADD COLUMN notification_mode TEXT DEFAULT 'auto' CHECK (notification_mode IN ('auto', 'approval'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='checkout_time') THEN
        ALTER TABLE properties ADD COLUMN checkout_time TEXT DEFAULT '11:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='checkin_time') THEN
        ALTER TABLE properties ADD COLUMN checkin_time TEXT DEFAULT '15:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='owner_phone') THEN
        ALTER TABLE properties ADD COLUMN owner_phone TEXT;
    END IF;
END $$;

COMMENT ON COLUMN properties.notification_mode IS
    'auto = enviar WhatsApp inmediatamente al detectar reserva; approval = esperar confirmación del dueño';

-- ─── NUEVA TABLA: notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    cleaner_id      UUID NOT NULL REFERENCES cleaners(id) ON DELETE RESTRICT,

    type            TEXT NOT NULL CHECK (type IN (
                        'new_reservation',
                        'pre_checkout_reminder',
                        'manual_resend'
                    )),
    status          TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
                        'pending_approval',
                        'pending_notification',
                        'notified',
                        'confirmed',
                        'no_response',
                        'escalated',
                        'resolved'
                    )),

    message_text    TEXT,
    reply_text      TEXT,

    escalation_count INT DEFAULT 0,
    escalated_at    TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,

    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    replied_at      TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_property ON notifications(property_id);
CREATE INDEX IF NOT EXISTS idx_notifications_reservation ON notifications(reservation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(status, sent_at)
    WHERE status IN ('notified', 'no_response');

-- ─── NUEVA TABLA: messages_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,

    kapso_message_id TEXT,
    wa_message_id    TEXT,

    direction       TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN (
                        'text', 'template', 'interactive', 'reaction'
                    )),
    content         TEXT NOT NULL,

    phone_from      TEXT,
    phone_to        TEXT,

    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                        'queued',
                        'sent',
                        'delivered',
                        'read',
                        'failed',
                        'received'
                    )),
    error_code      TEXT,
    error_detail    TEXT,

    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_notification ON messages_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_messages_kapso_id ON messages_log(kapso_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages_log(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages_log(phone_from);

-- ─── NUEVA TABLA: owner_actions_log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owner_actions_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    action          TEXT NOT NULL CHECK (action IN (
                        'approved',
                        'resend',
                        'will_call',
                        'change_cleaner',
                        'mark_resolved'
                    )),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_actions_notification ON owner_actions_log(notification_id);

-- ─── RLS POLICIES ──────────────────────────────────────────────────────────

ALTER TABLE cleaners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Users manage own cleaners" ON cleaners
        FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Users see own notifications" ON notifications
        FOR ALL USING (
            property_id IN (SELECT id FROM properties WHERE user_id = auth.uid())
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE messages_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Users see own messages" ON messages_log
        FOR ALL USING (
            notification_id IN (
                SELECT n.id FROM notifications n
                JOIN properties p ON p.id = n.property_id
                WHERE p.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE owner_actions_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Users see own actions" ON owner_actions_log
        FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── TRIGGERS ──────────────────────────────────────────────────────────────

-- Asegurar que la función update_updated_at existe
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_cleaners ON cleaners;
CREATE TRIGGER set_updated_at_cleaners
    BEFORE UPDATE ON cleaners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_notifications ON notifications;
CREATE TRIGGER set_updated_at_notifications
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FIN DE MIGRACIÓN 003
-- ============================================================================
