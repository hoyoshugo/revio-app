-- migration_009_property_knowledge.sql
-- Base de conocimiento por propiedad para el agente IA
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS property_knowledge (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  -- Categorías: general, rooms, policies, activities, transport, faq, restrictions, menu, contact
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_property_knowledge_property ON property_knowledge(property_id);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_category ON property_knowledge(property_id, category);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_active   ON property_knowledge(property_id, is_active);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON property_knowledge;
CREATE TRIGGER trg_knowledge_updated_at
  BEFORE UPDATE ON property_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

-- Datos semilla: Mística Isla Palma
-- Nota: reemplazar 'ISLA_PALMA_PROPERTY_ID' con el UUID real de la propiedad
-- Consultar con: SELECT id FROM properties WHERE slug = 'isla-palma';

-- Datos semilla: Mística Tayrona (igual, usar slug = 'tayrona')

COMMENT ON TABLE property_knowledge IS
  'Base de conocimiento dinámica por propiedad. El agente IA carga estas entradas para construir su system prompt en tiempo real.';
COMMENT ON COLUMN property_knowledge.category IS
  'Categoría del conocimiento: general|rooms|policies|activities|transport|faq|restrictions|menu|contact';
COMMENT ON COLUMN property_knowledge.key IS 'Identificador del dato dentro de la categoría, ej: check_in_time';
COMMENT ON COLUMN property_knowledge.value IS 'Valor del dato, puede contener texto enriquecido o JSON string';
