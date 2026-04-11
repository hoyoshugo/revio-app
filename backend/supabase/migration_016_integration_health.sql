-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 016 — Integration Health
-- Tracking del estado de cada integración por propiedad:
-- connected | unchecked | error | not_configured
-- Se actualiza al guardar credenciales o al hacer ping manual.
-- Idempotente — puede ejecutarse múltiples veces sin romper.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_health (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  integration_key   TEXT          NOT NULL,
  status            TEXT          NOT NULL DEFAULT 'unchecked'
                      CHECK (status IN ('connected','unchecked','error','not_configured')),
  last_checked_at   TIMESTAMPTZ,
  error_message     TEXT,
  response_time_ms  INTEGER,
  metadata          JSONB         DEFAULT '{}',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (property_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_health_property
  ON integration_health(property_id, integration_key);

ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_health_service" ON integration_health;
CREATE POLICY "integration_health_service"
  ON integration_health
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE  integration_health         IS 'Estado de salud de cada integración por propiedad. Refresca al guardar o ping manual.';
COMMENT ON COLUMN integration_health.status  IS 'connected | unchecked | error | not_configured';
COMMENT ON COLUMN integration_health.metadata IS 'Detalles adicionales del ping (account id, merchant name, etc)';
