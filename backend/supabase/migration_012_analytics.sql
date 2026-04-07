-- migration_012_analytics.sql
-- Analytics events table for product analytics and conversion tracking
-- Created: 2026-04-07
--
-- INSTRUCCIONES: Ejecutar manualmente en Supabase SQL Editor
-- Project: apghalkivuvyhbmethxk

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_property
  ON analytics_events(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name
  ON analytics_events(property_id, event_name);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events(session_id);

-- RLS: cada propiedad solo accede a sus eventos
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Política: lectura por property_id del JWT del usuario
DROP POLICY IF EXISTS "property analytics isolation" ON analytics_events;
CREATE POLICY "property analytics isolation" ON analytics_events
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties
      WHERE id = (current_setting('request.jwt.claims', true)::json->>'property_id')::uuid
    )
  );

-- Service role bypass (backend admin)
GRANT ALL ON analytics_events TO service_role;

COMMENT ON TABLE analytics_events IS 'Eventos de analytics para tracking de conversión, funnels y KPIs';
COMMENT ON COLUMN analytics_events.event_name IS 'Nombre del evento (page_view, chat_opened, reservation_completed, payment_completed)';
COMMENT ON COLUMN analytics_events.properties IS 'JSONB con metadata del evento (value, currency, channel, etc)';
