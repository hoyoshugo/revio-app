-- ============================================================
-- MIGRACIÓN 005: Tabla de configuración por propiedad
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla principal de configuración flexible (key-value JSONB por propiedad)
CREATE TABLE IF NOT EXISTS settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  -- property_id NULL = configuración global del sistema
  key         VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_by  VARCHAR(100),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_property ON settings(property_id, key);

-- Columnas adicionales en properties para config rápida
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS timezone    VARCHAR(50)  DEFAULT 'America/Bogota',
  ADD COLUMN IF NOT EXISTS default_language VARCHAR(5) DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true;

-- Columnas adicionales en users para permisos más granulares
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();
