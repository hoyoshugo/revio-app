-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 013 — Advanced Features (consolidada, idempotente)
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- ═══════════════════════════════════════════════════════════
-- Esta migración crea las 6 tablas que las sesiones previas
-- creyeron haber ejecutado pero nunca se aplicaron en BD.
-- Es 100% idempotente — se puede correr múltiples veces sin romper.

-- ── CONTACTS (CRM básico multi-tenant) ──────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  VARCHAR(200),
  email                 VARCHAR(200),
  phone                 VARCHAR(50),
  nationality           VARCHAR(100),
  language              VARCHAR(10)  DEFAULT 'es',
  source                VARCHAR(50),
  first_contact_at      TIMESTAMPTZ  DEFAULT NOW(),
  last_contact_at       TIMESTAMPTZ  DEFAULT NOW(),
  tags                  TEXT[],
  notes                 TEXT,
  total_reservations    INTEGER      DEFAULT 0,
  total_spent_cop       BIGINT       DEFAULT 0,
  marketing_consent     BOOLEAN      DEFAULT false,
  created_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_email ON contacts(tenant_id, email) WHERE email IS NOT NULL;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_service_all" ON contacts;
CREATE POLICY "contacts_service_all" ON contacts FOR ALL USING (auth.role() = 'service_role');

-- ── AUTOMATED_MESSAGES (mensajes automáticos configurables) ─
CREATE TABLE IF NOT EXISTS automated_messages (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id           UUID         REFERENCES properties(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  trigger_type          VARCHAR(50)  NOT NULL,
  trigger_hours_offset  INTEGER      DEFAULT 0,
  channel               VARCHAR(20)  DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email','both')),
  message_template      TEXT         NOT NULL,
  is_active             BOOLEAN      DEFAULT true,
  created_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automated_messages_tenant ON automated_messages(tenant_id, trigger_type, is_active);

ALTER TABLE automated_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automated_messages_service_all" ON automated_messages;
CREATE POLICY "automated_messages_service_all" ON automated_messages FOR ALL USING (auth.role() = 'service_role');

-- ── CANCELLATION_CASES (gestión profesional con case number) ─
CREATE TABLE IF NOT EXISTS cancellation_cases (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number               VARCHAR(20)  NOT NULL UNIQUE,
  tenant_id                 UUID         NOT NULL REFERENCES tenants(id),
  property_id               UUID         REFERENCES properties(id),
  reservation_id            VARCHAR(100),
  contact_id                UUID         REFERENCES contacts(id),
  guest_name                VARCHAR(200),
  guest_email               VARCHAR(200),
  guest_phone               VARCHAR(50),
  cancellation_reason       TEXT,
  policy_applied            TEXT,
  refund_amount_cop         BIGINT       DEFAULT 0,
  refund_status             VARCHAR(20)  DEFAULT 'pending' CHECK (refund_status IN ('pending','approved','processing','completed','denied')),
  refund_method             VARCHAR(50),
  payment_gateway_refund_id VARCHAR(200),
  approved_by               VARCHAR(200),
  approval_note             TEXT,
  approved_at               TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ  DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_cases_tenant ON cancellation_cases(tenant_id, refund_status);
CREATE INDEX IF NOT EXISTS idx_cancellation_cases_property ON cancellation_cases(property_id, created_at DESC);

ALTER TABLE cancellation_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cancellation_cases_service_all" ON cancellation_cases;
CREATE POLICY "cancellation_cases_service_all" ON cancellation_cases FOR ALL USING (auth.role() = 'service_role');

-- ── APPROVAL_REQUESTS (upgrades, descuentos, facturas) ──────
CREATE TABLE IF NOT EXISTS approval_requests (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id),
  property_id       UUID         REFERENCES properties(id),
  type              VARCHAR(50)  NOT NULL,
  description       TEXT         NOT NULL,
  requested_by      VARCHAR(200),
  guest_name        VARCHAR(200),
  guest_contact     VARCHAR(200),
  amount_cop        BIGINT,
  details           JSONB        DEFAULT '{}',
  status            VARCHAR(20)  DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  approved_by       VARCHAR(200),
  approval_note     TEXT,
  approved_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  notify_phone      VARCHAR(50),
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant ON approval_requests(tenant_id, status, created_at DESC);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_requests_service_all" ON approval_requests;
CREATE POLICY "approval_requests_service_all" ON approval_requests FOR ALL USING (auth.role() = 'service_role');

-- ── PLATFORM_AUDITS (auditoría periódica con sentiment IA) ──
CREATE TABLE IF NOT EXISTS platform_audits (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id),
  property_id         UUID         REFERENCES properties(id),
  platform            VARCHAR(50)  NOT NULL,
  audit_type          VARCHAR(20)  DEFAULT 'weekly',
  total_reviews       INTEGER      DEFAULT 0,
  avg_rating          DECIMAL(3,2),
  new_reviews         INTEGER      DEFAULT 0,
  pending_responses   INTEGER      DEFAULT 0,
  sentiment_positive  INTEGER      DEFAULT 0,
  sentiment_neutral   INTEGER      DEFAULT 0,
  sentiment_negative  INTEGER      DEFAULT 0,
  key_issues          TEXT[],
  recommendations     TEXT[],
  raw_data            JSONB        DEFAULT '{}',
  audited_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audits_tenant ON platform_audits(tenant_id, platform, audited_at DESC);

ALTER TABLE platform_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_audits_service_all" ON platform_audits;
CREATE POLICY "platform_audits_service_all" ON platform_audits FOR ALL USING (auth.role() = 'service_role');

-- ── SCHEDULED_REPORTS (reportes diarios por WhatsApp) ───────
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id),
  property_id       UUID         REFERENCES properties(id),
  name              VARCHAR(200) NOT NULL,
  frequency         VARCHAR(20)  DEFAULT 'daily',
  send_time         TIME         DEFAULT '08:00',
  notify_phones     TEXT[],
  report_type       VARCHAR(50)  DEFAULT 'reservations',
  include_fields    TEXT[],
  is_active         BOOLEAN      DEFAULT true,
  last_sent_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id, is_active);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_reports_service_all" ON scheduled_reports;
CREATE POLICY "scheduled_reports_service_all" ON scheduled_reports FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════
-- SEED: plantillas de mensajes automáticos para Mística
-- ═══════════════════════════════════════

INSERT INTO automated_messages (tenant_id, property_id, name, trigger_type, trigger_hours_offset, channel, message_template, is_active)
SELECT
  t.id AS tenant_id,
  p.id AS property_id,
  msg.name,
  msg.trigger_type,
  msg.offset_hours,
  'both',
  msg.tpl,
  true
FROM tenants t
CROSS JOIN properties p
CROSS JOIN (VALUES
  ('Confirmación reserva + link pago', 'booking_confirmed', 0,
   E'¡Hola {{guest_name}}! 🌴 Tu reserva en {{property_name}} quedó confirmada.\n\n📅 Llegada: {{check_in}}\n📅 Salida: {{check_out}}\n👥 Personas: {{guests}}\n🏠 Tipo: {{room_type}}\n\n💳 Para asegurar tu espacio, completa el pago aquí:\n{{payment_link}}\n\n¿Alguna pregunta? Escríbenos. ✨'),
  ('Recordatorio 1 día antes', 'pre_arrival', -24,
   E'¡{{guest_name}}! 🌴 Mañana te esperamos en {{property_name}}.\n\n⏰ Check-in desde las 2:00 PM\n📋 Haz tu check-in online: {{checkin_link}}\n🚤 ¿Ya coordinaste tu transporte?\n\n¿Confirmas tu llegada y tipo de transporte?'),
  ('Día de llegada', 'check_in_day', 0,
   E'🎉 ¡{{guest_name}}, hoy es el día!\n\nTe esperamos desde las 2:00 PM en {{property_name}}.\n📍 {{arrival_instructions}}\n\nSi ya estás en camino, avísanos. 🌴'),
  ('Seguimiento durante estadía', 'during_stay', 48,
   E'{{guest_name}}, ¿cómo van disfrutando {{property_name}}? 🌊\n\nActividades hoy:\n{{available_activities}}\n\n¿Te ayudamos con alguna reserva?'),
  ('Check-out + recordatorio', 'check_out_day', 0,
   E'🌅 ¡{{guest_name}}, hoy nos despedimos!\n\nCheck-out antes de las 11:00 AM. ¿Transporte de regreso coordinado?\n\n🙏 Ha sido un placer tenerte aquí.'),
  ('Post-estadía reseña', 'post_stay', 24,
   E'{{guest_name}}, esperamos que hayas disfrutado {{property_name}} 🌴\n\nTu reseña nos ayuda mucho:\n⭐ Google: {{google_review_link}}\n⭐ TripAdvisor: {{tripadvisor_link}}\n\n¡Gracias! 💙')
) AS msg(name, trigger_type, offset_hours, tpl)
WHERE t.contact_email = 'admin@misticahostels.com'
  AND p.tenant_id = t.id
ON CONFLICT DO NOTHING;

COMMENT ON TABLE contacts            IS 'CRM multi-tenant: contactos de todos los canales con dedupe por phone+email';
COMMENT ON TABLE automated_messages  IS 'Plantillas de mensajes automáticos disparados por triggers (booking_confirmed, pre_arrival, etc)';
COMMENT ON TABLE cancellation_cases  IS 'Casos de cancelación con case number CAN-YYYY-XXXX y flujo profesional';
COMMENT ON TABLE approval_requests   IS 'Solicitudes de aprobación del gerente para upgrades, descuentos, facturas';
COMMENT ON TABLE platform_audits     IS 'Auditoría automática semanal de reviews con análisis de sentiment por Claude';
COMMENT ON TABLE scheduled_reports   IS 'Reportes programados por WhatsApp/email (diarios, semanales, mensuales)';
