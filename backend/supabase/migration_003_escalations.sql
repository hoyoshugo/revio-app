-- ============================================================
-- MIGRACIÓN 003: Fase 3 — Tablas completas
-- Ejecutar DESPUÉS de schema.sql y migration_002
--
-- Crea:
--   1. health_checks          — Historial de monitoreo de servicios
--   2. knowledge_base         — Base de conocimiento del agente IA
--   3. escalations            — Escalaciones a agentes humanos
--   4. whatsapp_learning_sessions — Sesiones de aprendizaje via WhatsApp
--   5. Columnas nuevas en conversations (ai_paused, escalation_id)
-- ============================================================

-- ============================================================
-- 1. HEALTH CHECKS
-- Sin dependencias externas — crear primero
-- ============================================================
CREATE TABLE IF NOT EXISTS health_checks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service      VARCHAR(50)  NOT NULL,   -- backend | supabase | lobbypms | wompi | whatsapp
  status       VARCHAR(20)  NOT NULL,   -- ok | degraded | down
  response_time_ms INTEGER,
  error_message TEXT,
  auto_recovered   BOOLEAN DEFAULT false,
  alert_sent       BOOLEAN DEFAULT false,
  checked_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service
  ON health_checks(service, checked_at DESC);

-- Vista: último estado por servicio (para el dashboard en tiempo real)
CREATE OR REPLACE VIEW v_health_status AS
SELECT DISTINCT ON (service)
  service, status, response_time_ms, error_message,
  auto_recovered, alert_sent, checked_at
FROM health_checks
ORDER BY service, checked_at DESC;

-- ============================================================
-- 2. KNOWLEDGE BASE
-- Depende de: properties
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Pregunta y respuesta
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  category     VARCHAR(50) DEFAULT 'general',
  -- general | policies | activities | transport | food | rooms | staff_learning

  -- Metadatos de origen
  source       VARCHAR(30) DEFAULT 'manual',  -- manual | whatsapp | ai_generated
  created_by   VARCHAR(100),                  -- email, número WhatsApp o 'dashboard'
  original_client_question TEXT,              -- pregunta original del cliente que disparó el aprendizaje

  -- Uso
  used_count   INTEGER DEFAULT 0,
  active       BOOLEAN DEFAULT true,

  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_property
  ON knowledge_base(property_id, active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search
  ON knowledge_base USING GIN(to_tsvector('spanish', question || ' ' || answer));

-- ============================================================
-- 3. ESCALATIONS
-- Depende de: properties, conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id),

  -- Motivo de la escalación
  reason          VARCHAR(50) NOT NULL,
  -- frustration_detected | long_conversation | human_requested

  -- Resumen del contexto enviado al equipo
  summary         TEXT,        -- resumen corto generado por IA
  conversation_summary TEXT,   -- alias (mismo contenido)

  -- Estado
  status          VARCHAR(20) DEFAULT 'open',
  -- open | resolved

  -- Resolución
  resolved_by     VARCHAR(100),
  resolved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_conversation
  ON escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status
  ON escalations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_property_status
  ON escalations(property_id, status, created_at DESC);

-- ============================================================
-- 4. WHATSAPP LEARNING SESSIONS
-- Depende de: properties, conversations, knowledge_base
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_learning_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID REFERENCES properties(id),
  conversation_id UUID REFERENCES conversations(id),

  -- La pregunta del cliente que el agente no supo responder
  question                TEXT,     -- campo principal usado por el código
  original_client_question TEXT,    -- alias de question

  -- A quién se le preguntó
  asked_to_number VARCHAR(20),
  asked_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Respuesta recibida del staff
  response        TEXT,             -- campo principal usado por el código
  answer_received TEXT,             -- alias de response
  answered_by_number VARCHAR(20),
  answered_at     TIMESTAMPTZ,

  -- Estado
  status          VARCHAR(20) DEFAULT 'pending',
  -- pending | answered | saved | expired

  -- Vínculo al knowledge_base cuando se guarda
  knowledge_base_id UUID REFERENCES knowledge_base(id),

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_status
  ON whatsapp_learning_sessions(status, asked_at);

-- ============================================================
-- 5. COLUMNAS NUEVAS EN conversations
-- Controlan si la IA está pausada por una escalación activa
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_paused     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_id UUID REFERENCES escalations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_ai_paused
  ON conversations(ai_paused) WHERE ai_paused = true;

-- ============================================================
-- 6. TRIGGER updated_at para las nuevas tablas
-- (reutiliza la función update_updated_at_column del schema.sql)
-- ============================================================
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escalations_updated_at ON escalations;
CREATE TRIGGER update_escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
