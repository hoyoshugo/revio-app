-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 022 — Channel Sync (bidirectional channel manager)
--
-- Tables:
--  · channel_sync_log       — audit log of all push/pull operations
--  · ical_feeds             — tracked iCal feed URLs per room type
--  · channel_rate_overrides — per-channel rate overrides by date range
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente — puede ejecutarse múltiples veces sin romper.
-- ═══════════════════════════════════════════════════════

-- ── 1. CHANNEL_SYNC_LOG ────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_sync_log (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID           NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel_key   TEXT           NOT NULL,
  action        TEXT           NOT NULL,
  direction     TEXT           NOT NULL CHECK (direction IN ('push', 'pull')),
  status        TEXT           NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'error', 'pending')),
  payload       JSONB          DEFAULT '{}',
  error_message TEXT,
  created_at    TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_sync_log_property
  ON channel_sync_log(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_sync_log_status
  ON channel_sync_log(property_id, status);

-- ── 2. ICAL_FEEDS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ical_feeds (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID           NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id   UUID           NOT NULL,
  channel_key    TEXT           NOT NULL,
  feed_url       TEXT,
  last_synced_at TIMESTAMPTZ,
  is_active      BOOLEAN        DEFAULT true,
  created_at     TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (property_id, room_type_id, channel_key)
);

CREATE INDEX IF NOT EXISTS idx_ical_feeds_property
  ON ical_feeds(property_id, is_active);

-- ── 3. CHANNEL_RATE_OVERRIDES ──────────────────────────
CREATE TABLE IF NOT EXISTS channel_rate_overrides (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID           NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id   UUID           NOT NULL,
  channel_key    TEXT           NOT NULL,
  date_from      DATE           NOT NULL,
  date_to        DATE           NOT NULL,
  rate           DECIMAL(12,2)  NOT NULL,
  created_at     TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE (property_id, room_type_id, channel_key, date_from)
);

CREATE INDEX IF NOT EXISTS idx_channel_rate_overrides_lookup
  ON channel_rate_overrides(property_id, room_type_id, date_from, date_to);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE channel_sync_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ical_feeds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_rate_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_sync_log_service"      ON channel_sync_log;
DROP POLICY IF EXISTS "ical_feeds_service"             ON ical_feeds;
DROP POLICY IF EXISTS "channel_rate_overrides_service" ON channel_rate_overrides;

CREATE POLICY "channel_sync_log_service"      ON channel_sync_log      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "ical_feeds_service"             ON ical_feeds             FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "channel_rate_overrides_service" ON channel_rate_overrides FOR ALL USING (auth.role() = 'service_role');

-- ── COMMENTS ───────────────────────────────────────────
COMMENT ON TABLE channel_sync_log      IS 'Audit log of all channel sync operations (push/pull availability, rates, reservations)';
COMMENT ON TABLE ical_feeds             IS 'Tracked iCal feed URLs per property + room type + channel';
COMMENT ON TABLE channel_rate_overrides IS 'Per-channel rate overrides — allows different rates per OTA by date range';
