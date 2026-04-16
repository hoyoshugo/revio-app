-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 021 — Dynamic Rates Engine tables
-- seasons · day_of_week_rules · occupancy_rules · los_discounts
-- + seed Isla Palma (Mística)
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente.
-- ═══════════════════════════════════════════════════════

-- ── SEASONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL,
  type          TEXT          NOT NULL CHECK (type IN ('high','low','shoulder')),
  start_date    DATE          NOT NULL,
  end_date      DATE          NOT NULL,
  multiplier    DECIMAL(4,2)  DEFAULT 1.0,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seasons_property ON seasons(property_id, start_date, end_date);

-- ── DAY_OF_WEEK_RULES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS day_of_week_rules (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  day_of_week   INTEGER       NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  multiplier    DECIMAL(4,2)  DEFAULT 1.0,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(property_id, day_of_week)
);

-- ── OCCUPANCY_RULES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS occupancy_rules (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  min_pct       INTEGER       NOT NULL CHECK (min_pct >= 0 AND min_pct <= 100),
  max_pct       INTEGER       NOT NULL CHECK (max_pct >= 0 AND max_pct <= 100),
  multiplier    DECIMAL(4,2)  NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_occupancy_rules_property ON occupancy_rules(property_id);

-- ── LOS_DISCOUNTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS los_discounts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  min_nights    INTEGER       NOT NULL CHECK (min_nights >= 1),
  discount_pct  DECIMAL(5,2)  NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(property_id, min_nights)
);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE seasons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_of_week_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE los_discounts     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['seasons','day_of_week_rules','occupancy_rules','los_discounts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_all ON %s', t);
    EXECUTE format(
      'CREATE POLICY service_all ON %s USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- SEED: Isla Palma (67fbce21-1b88-449f-93e2-1226cda2a7fb)
-- ═══════════════════════════════════════════════════════

-- Seasons — alta: dic-ene, mar (Semana Santa zone), jul
--           baja: may, jun, ago, sep, oct, nov
--           shoulder: feb, abr (puentes)
INSERT INTO seasons (property_id, name, type, start_date, end_date, multiplier) VALUES
  -- 2026 High seasons
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Temporada Alta Dic-Ene',  'high',     '2025-12-15', '2026-01-15', 1.40),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Semana Santa',            'high',     '2026-03-28', '2026-04-05', 1.35),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Temporada Alta Julio',    'high',     '2026-07-01', '2026-07-31', 1.30),
  -- Low seasons
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Temporada Baja May-Jun',  'low',      '2026-05-01', '2026-06-30', 0.85),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Temporada Baja Ago-Nov',  'low',      '2026-08-01', '2026-11-30', 0.85),
  -- Shoulder (puentes)
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Puente Febrero',          'shoulder', '2026-02-13', '2026-02-16', 1.15),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Puente Abril',            'shoulder', '2026-04-10', '2026-04-13', 1.15),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Puente Junio',            'shoulder', '2026-06-19', '2026-06-22', 1.15),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'Puente Octubre',          'shoulder', '2026-10-09', '2026-10-12', 1.15)
ON CONFLICT DO NOTHING;

-- Day-of-week: Fri=5 & Sat=6 premium, Sun-Thu standard
INSERT INTO day_of_week_rules (property_id, day_of_week, multiplier) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 0, 1.00),  -- Domingo
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 1, 1.00),  -- Lunes
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 2, 1.00),  -- Martes
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 3, 1.00),  -- Miercoles
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 4, 1.00),  -- Jueves
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 5, 1.15),  -- Viernes
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 6, 1.20)   -- Sabado
ON CONFLICT (property_id, day_of_week) DO NOTHING;

-- Occupancy tiers
INSERT INTO occupancy_rules (property_id, min_pct, max_pct, multiplier) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 0,  49, 1.00),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 50, 74, 1.15),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 75, 89, 1.25),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 90, 100, 1.40)
ON CONFLICT DO NOTHING;

-- LOS discounts
INSERT INTO los_discounts (property_id, min_nights, discount_pct) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 3, 5.00),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 7, 15.00)
ON CONFLICT (property_id, min_nights) DO NOTHING;

-- ── Comments ───────────────────────────────────────────
COMMENT ON TABLE seasons           IS 'Temporadas por propiedad con multiplicador de tarifa';
COMMENT ON TABLE day_of_week_rules IS 'Multiplicadores de tarifa por dia de la semana';
COMMENT ON TABLE occupancy_rules   IS 'Multiplicadores de tarifa por rango de ocupacion';
COMMENT ON TABLE los_discounts     IS 'Descuentos por duracion de estadia (length-of-stay)';
