-- ============================================================
-- MIGRACIÓN 003: Social Media, Knowledge Base, Health, Escalaciones
-- Ejecutar DESPUÉS de migration_002
-- ============================================================

-- ============================================================
-- TABLA: knowledge_base
-- Conocimiento acumulado por el agente IA
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- La pregunta o tema
  question TEXT NOT NULL,
  question_embedding TEXT,                   -- reservado para búsqueda semántica (requiere pgvector)
  keywords TEXT[],                           -- palabras clave para búsqueda simple

  -- La respuesta aprobada
  answer TEXT NOT NULL,
  answer_language VARCHAR(5) DEFAULT 'es',

  -- Origen del conocimiento
  source VARCHAR(30) DEFAULT 'whatsapp',    -- whatsapp | manual | ai_generated
  created_by VARCHAR(100),                   -- número de WhatsApp o 'staff'
  original_question TEXT,                    -- pregunta original del cliente que lo disparó

  -- Uso y calidad
  used_count INTEGER DEFAULT 0,
  approved BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: health_checks
-- Registro de monitoreo del sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service VARCHAR(50) NOT NULL,             -- backend | supabase | lobbypms | wompi | whatsapp
  status VARCHAR(20) NOT NULL,              -- ok | degraded | down
  response_time_ms INTEGER,
  error_message TEXT,
  auto_recovered BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vista: último estado por servicio
CREATE OR REPLACE VIEW v_health_status AS
SELECT DISTINCT ON (service)
  service, status, response_time_ms, error_message,
  auto_recovered, alert_sent, checked_at
FROM health_checks
ORDER BY service, checked_at DESC;

-- ============================================================
-- TABLA: escalations
-- Escalaciones a agentes humanos
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  -- Motivo
  reason VARCHAR(50) NOT NULL,
  -- frustrated | requested_human | repeated_question | complaint | other
  trigger_message TEXT,                      -- mensaje que disparó la escalación
  sentiment_score DECIMAL(3,2),             -- -1.0 (muy negativo) a 1.0 (muy positivo)

  -- Estado
  status VARCHAR(20) DEFAULT 'pending',
  -- pending | notified | in_progress | resolved | returned_to_ai

  -- Notificación al equipo
  team_notified_at TIMESTAMPTZ,
  team_notified_via VARCHAR(20),
  team_whatsapp_numbers TEXT[],
  conversation_summary TEXT,                 -- resumen del contexto enviado al equipo

  -- Resolución
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  return_to_ai BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: whatsapp_learning_sessions
-- Sesiones de aprendizaje via WhatsApp (pregunta pendiente → esperando respuesta del staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_learning_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),

  -- La pregunta del cliente que el agente no supo responder
  original_client_question TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id),

  -- WhatsApp al que se le preguntó
  asked_to_number VARCHAR(20) NOT NULL,
  asked_at TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_message_id VARCHAR(255),

  -- Respuesta recibida
  answer_received TEXT,
  answered_by_number VARCHAR(20),
  answered_at TIMESTAMPTZ,

  -- Estado
  status VARCHAR(20) DEFAULT 'pending',
  -- pending | answered | saved | expired

  -- Vínculo al knowledge_base cuando se guarda
  knowledge_base_id UUID REFERENCES knowledge_base(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_knowledge_base_property ON knowledge_base(property_id, active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_status ON whatsapp_learning_sessions(status, asked_at);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
