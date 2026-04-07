-- ============================================================
-- ASEO ALERTA — Schema inicial de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- TABLA: properties
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  ical_url        TEXT NOT NULL,
  whatsapp_phone  TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index: buscar propiedades por usuario
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);

-- ─────────────────────────────────────────────────────────────
-- TABLA: reservations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  uid          TEXT NOT NULL,          -- UID único del evento iCal
  checkin      TIMESTAMPTZ NOT NULL,
  checkout     TIMESTAMPTZ NOT NULL,
  guest_name   TEXT,
  summary      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Evitar duplicados por propiedad + uid de evento
  UNIQUE(property_id, uid)
);

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON public.reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_checkout    ON public.reservations(checkout);

-- ─────────────────────────────────────────────────────────────
-- TABLA: alerts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reservation_id  UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('new_booking', 'pre_checkout')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
  message         TEXT,
  whatsapp_to     TEXT,
  error_msg       TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_property_id ON public.alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status      ON public.alerts(status);

-- ─────────────────────────────────────────────────────────────
-- TABLA: subscriptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'canceled', 'expired', 'past_due')),
  plan                  TEXT NOT NULL DEFAULT 'launch',
  amount                INTEGER NOT NULL DEFAULT 9990,  -- en CLP
  currency              TEXT NOT NULL DEFAULT 'CLP',
  toku_subscription_id  TEXT UNIQUE,
  toku_session_id       TEXT,
  current_period_end    BIGINT,         -- Unix timestamp de fin de período
  started_at            TIMESTAMPTZ,
  canceled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON public.subscriptions(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Garantiza que cada usuario solo vea SUS datos
-- ============================================================

ALTER TABLE public.properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── Policies: properties ────────────────────────────────────
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "properties_insert" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties_update" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "properties_delete" ON public.properties
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Policies: reservations (a través de la propiedad) ───────
CREATE POLICY "reservations_select" ON public.reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "reservations_insert" ON public.reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.user_id = auth.uid()
    )
  );

-- El backend con service_role key puede hacer todo.
-- Solo el service_role puede actualizar/borrar reservas.

-- ─── Policies: alerts ────────────────────────────────────────
CREATE POLICY "alerts_select" ON public.alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.user_id = auth.uid()
    )
  );

-- ─── Policies: subscriptions ─────────────────────────────────
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- VISTA: propiedades con próximo checkout (útil para el dashboard)
-- ============================================================
CREATE OR REPLACE VIEW public.properties_with_next_checkout AS
SELECT
  p.*,
  (
    SELECT r.checkout
    FROM public.reservations r
    WHERE r.property_id = p.id
      AND r.checkout >= NOW()
    ORDER BY r.checkout ASC
    LIMIT 1
  ) AS next_checkout
FROM public.properties p;

-- ============================================================
-- Comentarios de documentación
-- ============================================================
COMMENT ON TABLE public.properties   IS 'Propiedades de Airbnb de cada usuario';
COMMENT ON TABLE public.reservations IS 'Reservas sincronizadas desde el iCal de Airbnb';
COMMENT ON TABLE public.alerts       IS 'Registro de alertas WhatsApp enviadas';
COMMENT ON TABLE public.subscriptions IS 'Suscripciones de pago via Toku';
