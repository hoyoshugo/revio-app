-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 017 — Channel Manager + Inbox Unificado
-- Crea las tablas del nuevo módulo Channel Manager:
--  · tenant_provider_selections — proveedor activo por categoría
--  · property_channels            — canales configurados por propiedad
--  · channel_manager_rates        — tarifas por canal (base)
--  · unified_inbox                — mensajes de todos los canales
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente — puede ejecutarse múltiples veces sin romper.
-- ═══════════════════════════════════════════════════════

-- ── 1A. TENANT_PROVIDER_SELECTIONS ─────────────────────
CREATE TABLE IF NOT EXISTS tenant_provider_selections (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category       TEXT        NOT NULL CHECK (category IN ('ai','payments','pms')),
  provider_key   TEXT        NOT NULL,
  is_active      BOOLEAN     DEFAULT true,
  configured_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, category)
);
CREATE INDEX IF NOT EXISTS idx_provider_selections_property ON tenant_provider_selections(property_id);

-- ── 1B. PROPERTY_CHANNELS ──────────────────────────────
CREATE TABLE IF NOT EXISTS property_channels (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel_key          TEXT        NOT NULL,
  channel_type         TEXT        NOT NULL CHECK (channel_type IN ('messaging','ota','review')),
  status               TEXT        DEFAULT 'not_configured'
                         CHECK (status IN ('connected','unchecked','error','not_configured')),
  credentials          JSONB       DEFAULT '{}',
  ical_url             TEXT,
  profile_url          TEXT,
  last_checked_at      TIMESTAMPTZ,
  last_sync_at         TIMESTAMPTZ,
  error_message        TEXT,
  can_receive_messages BOOLEAN     DEFAULT false,
  can_send_messages    BOOLEAN     DEFAULT false,
  can_reply_reviews    BOOLEAN     DEFAULT false,
  can_sync_calendar    BOOLEAN     DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, channel_key)
);
CREATE INDEX IF NOT EXISTS idx_property_channels_property ON property_channels(property_id, channel_type);

-- ── 1C. CHANNEL_MANAGER_RATES (estructura base) ────────
CREATE TABLE IF NOT EXISTS channel_manager_rates (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID           NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel_key     TEXT           NOT NULL,
  room_type       TEXT,
  base_rate       DECIMAL(10,2),
  markup_percent  DECIMAL(5,2)   DEFAULT 0,
  effective_date  DATE,
  created_at      TIMESTAMPTZ    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cm_rates_property ON channel_manager_rates(property_id, channel_key);

-- ── 1D. UNIFIED_INBOX ──────────────────────────────────
CREATE TABLE IF NOT EXISTS unified_inbox (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel_key         TEXT        NOT NULL,
  external_thread_id  TEXT,
  sender_name         TEXT,
  sender_id           TEXT,
  message_text        TEXT,
  direction           TEXT        DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  status              TEXT        DEFAULT 'unread' CHECK (status IN ('unread','read','replied','escalated')),
  raw_payload         JSONB,
  received_at         TIMESTAMPTZ DEFAULT NOW(),
  replied_at          TIMESTAMPTZ,
  replied_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_unified_inbox_property ON unified_inbox(property_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_inbox_thread   ON unified_inbox(external_thread_id);
CREATE INDEX IF NOT EXISTS idx_unified_inbox_status   ON unified_inbox(property_id, status);

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE tenant_provider_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_manager_rates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_inbox              ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_selections_service" ON tenant_provider_selections;
DROP POLICY IF EXISTS "property_channels_service"   ON property_channels;
DROP POLICY IF EXISTS "cm_rates_service"            ON channel_manager_rates;
DROP POLICY IF EXISTS "unified_inbox_service"       ON unified_inbox;

CREATE POLICY "provider_selections_service" ON tenant_provider_selections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "property_channels_service"   ON property_channels          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "cm_rates_service"            ON channel_manager_rates      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "unified_inbox_service"       ON unified_inbox              FOR ALL USING (auth.role() = 'service_role');

-- ── SEED tenant_provider_selections (demo tenants) ────
INSERT INTO tenant_provider_selections (property_id, category, provider_key, configured_at) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'ai',       'anthropic', NOW()),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'payments', 'wompi',     NOW()),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'pms',      'lobbypms',  NOW()),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'ai',       'anthropic', NOW()),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'payments', 'wompi',     NOW()),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'pms',      'lobbypms',  NOW())
ON CONFLICT (property_id, category) DO NOTHING;

-- ── SEED property_channels con capacidades reales ─────
INSERT INTO property_channels (property_id, channel_key, channel_type, can_receive_messages, can_send_messages, can_reply_reviews, can_sync_calendar) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','whatsapp',       'messaging', true,  true,  false, false),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','instagram',      'messaging', true,  true,  false, false),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','facebook',       'messaging', true,  true,  true,  false),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','google_business','messaging', true,  true,  true,  false),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','tripadvisor',    'review',    false, false, false, false),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','booking',        'ota',       false, false, false, true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','airbnb',         'ota',       false, false, false, true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','hostelworld',    'ota',       false, false, false, true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','expedia',        'ota',       false, false, false, true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','despegar',       'ota',       false, false, false, true),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','whatsapp',       'messaging', true,  true,  false, false),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','instagram',      'messaging', true,  true,  false, false),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','facebook',       'messaging', true,  true,  true,  false),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','google_business','messaging', true,  true,  true,  false),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','booking',        'ota',       false, false, false, true),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','airbnb',         'ota',       false, false, false, true)
ON CONFLICT (property_id, channel_key) DO NOTHING;

COMMENT ON TABLE tenant_provider_selections IS 'Proveedor activo por categoría (ai|payments|pms) por propiedad — una única selección activa por categoría';
COMMENT ON TABLE property_channels          IS 'Canales de comunicación configurados por propiedad (WhatsApp, IG, FB, OTAs, reviews)';
COMMENT ON TABLE channel_manager_rates      IS 'Tarifas base + markup por canal (estructura lista, lógica pendiente)';
COMMENT ON TABLE unified_inbox              IS 'Bandeja unificada de mensajes de todos los canales — alimentada por webhooks';
