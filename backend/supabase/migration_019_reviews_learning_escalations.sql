-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 019 — Reviews IA · Aprendizaje IA · Escalaciones
-- · property_reviews     — reseñas de plataformas (TripAdvisor, Google, etc)
-- · waitlist_features    — lista de espera para features futuros
-- · learning_items       — items de aprendizaje del agente IA
-- · conversations.escalated/escalated_at/agent_paused — escalation flags
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente.
-- ═══════════════════════════════════════════════════════

-- ── property_reviews ──────────────────────────────────
CREATE TABLE IF NOT EXISTS property_reviews (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id              UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  platform                 TEXT         NOT NULL,
  external_review_id       TEXT,
  reviewer_name            TEXT,
  rating                   INTEGER      CHECK (rating BETWEEN 1 AND 5),
  title                    TEXT,
  review_text              TEXT,
  review_date              DATE,
  language                 TEXT         DEFAULT 'es',
  ai_response              TEXT,
  ai_response_generated_at TIMESTAMPTZ,
  status                   TEXT         DEFAULT 'pending'
                             CHECK (status IN ('pending','response_ready','published','ignored')),
  published_at             TIMESTAMPTZ,
  raw_data                 JSONB,
  created_at               TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (property_id, platform, external_review_id)
);

CREATE INDEX IF NOT EXISTS idx_property_reviews_property ON property_reviews(property_id, status);
CREATE INDEX IF NOT EXISTS idx_property_reviews_platform ON property_reviews(property_id, platform, review_date DESC);

ALTER TABLE property_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_reviews_service" ON property_reviews;
CREATE POLICY "property_reviews_service" ON property_reviews FOR ALL USING (auth.role() = 'service_role');

-- ── waitlist_features ─────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist_features (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT         NOT NULL,
  feature     TEXT         NOT NULL,
  property_id UUID,
  notes       TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_features_feature ON waitlist_features(feature);

ALTER TABLE waitlist_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_features_service" ON waitlist_features;
CREATE POLICY "waitlist_features_service" ON waitlist_features FOR ALL USING (auth.role() = 'service_role');

-- ── learning_items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_items (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID         REFERENCES properties(id) ON DELETE CASCADE,
  source            TEXT         CHECK (source IN ('ensayo','conversation','auto_detected','escalation')),
  original_question TEXT         NOT NULL,
  agent_response    TEXT,
  issue_type        TEXT         CHECK (issue_type IN ('no_answer','wrong_answer','incomplete','confusing','escalation')),
  suggested_fix     TEXT,
  status            TEXT         DEFAULT 'pending'
                      CHECK (status IN ('pending','applied','dismissed')),
  conversation_id   UUID,
  applied_at        TIMESTAMPTZ,
  applied_by        TEXT,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_items_property ON learning_items(property_id, status);

ALTER TABLE learning_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_items_service" ON learning_items;
CREATE POLICY "learning_items_service" ON learning_items FOR ALL USING (auth.role() = 'service_role');

-- ── conversations: columnas de escalación ─────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalated     BOOLEAN     DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalated_at  TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_paused  BOOLEAN     DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS resolved_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_escalated ON conversations(property_id, escalated, escalated_at DESC);

-- ── SEED Mística ──────────────────────────────────────

-- Instagram Business IDs reales
UPDATE property_channels
SET credentials = jsonb_build_object('instagram_business_id', '17841408302624207'),
    updated_at = NOW()
WHERE property_id = '67fbce21-1b88-449f-93e2-1226cda2a7fb' AND channel_key = 'instagram';

UPDATE property_channels
SET credentials = jsonb_build_object('instagram_business_id', '17841470351033945'),
    updated_at = NOW()
WHERE property_id = '148f7836-6fcf-4d06-8570-bd65fcc2ccf0' AND channel_key = 'instagram';

-- Descripción del grupo (group_description ya existe en migration_018b)
UPDATE tenants
SET group_description = 'Grupo de hostales en locaciones mágicas'
WHERE business_name ILIKE '%mistica%' OR business_name ILIKE '%mística%';

-- Perfiles OTA Isla Palma
UPDATE property_channels SET profile_url = 'https://www.booking.com/hotel/co/mistica-island-hostel.es.html'
WHERE property_id = '67fbce21-1b88-449f-93e2-1226cda2a7fb' AND channel_key = 'booking';

UPDATE property_channels SET profile_url = 'https://www.airbnb.com.co/users/profile/1463258604798382157'
WHERE property_id = '67fbce21-1b88-449f-93e2-1226cda2a7fb' AND channel_key = 'airbnb';

UPDATE property_channels SET profile_url = 'https://www.spanish.hostelworld.com/pwa/hosteldetails.php/Mistica-Island/Isla-Palma/291356'
WHERE property_id = '67fbce21-1b88-449f-93e2-1226cda2a7fb' AND channel_key = 'hostelworld';

-- Perfiles OTA Tayrona
UPDATE property_channels SET profile_url = 'https://www.booking.com/hotel/co/mistica-island-hostel.es.html'
WHERE property_id = '148f7836-6fcf-4d06-8570-bd65fcc2ccf0' AND channel_key = 'booking';

UPDATE property_channels SET profile_url = 'https://www.spanish.hostelworld.com/pwa/hosteldetails.php/MISTICA-HOSTEL-Tayrona/Santa-Marta/329732'
WHERE property_id = '148f7836-6fcf-4d06-8570-bd65fcc2ccf0' AND channel_key = 'hostelworld';

COMMENT ON TABLE property_reviews IS 'Reseñas de plataformas externas (TripAdvisor, Google, Booking, Airbnb) con respuesta IA';
COMMENT ON TABLE waitlist_features IS 'Lista de espera de clientes para features futuros (ej: mensajería OTAs)';
COMMENT ON TABLE learning_items IS 'Items de aprendizaje del agente IA (preguntas sin respuesta, escalaciones, etc)';
