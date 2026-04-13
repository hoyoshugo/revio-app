-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 020 — PMS Core: 5 tablas faltantes
-- rate_plans · check_ins · folios · charges · housekeeping
-- + seeds demo Mística
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente.
-- ═══════════════════════════════════════════════════════

-- ── RATE_PLANS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_plans (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  description    TEXT,
  type           TEXT          DEFAULT 'standard' CHECK (type IN ('standard','seasonal','weekend','promo','ota')),
  base_rate      DECIMAL(10,2),
  markup_percent DECIMAL(5,2)  DEFAULT 0,
  min_nights     INTEGER       DEFAULT 1,
  max_nights     INTEGER,
  valid_from     DATE,
  valid_to       DATE,
  days_of_week   INTEGER[],
  channels       TEXT[]        DEFAULT ARRAY['direct'],
  is_active      BOOLEAN       DEFAULT true,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_plans_property ON rate_plans(property_id, is_active);

-- ── CHECK_INS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_ins (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID          REFERENCES reservations(id) ON DELETE CASCADE,
  property_id     UUID          REFERENCES properties(id),
  type            TEXT          NOT NULL CHECK (type IN ('checkin','checkout')),
  scheduled_at    TIMESTAMPTZ,
  actual_at       TIMESTAMPTZ,
  room_id         UUID          REFERENCES rooms(id),
  guest_id        UUID,
  staff_id        TEXT,
  notes           TEXT,
  id_type         TEXT,
  id_number       TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_check_ins_reservation ON check_ins(reservation_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_property    ON check_ins(property_id, type, actual_at DESC);

-- ── FOLIOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folios (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID          REFERENCES reservations(id) ON DELETE CASCADE,
  property_id     UUID          REFERENCES properties(id),
  guest_id        UUID,
  folio_number    TEXT          UNIQUE,
  status          TEXT          DEFAULT 'open' CHECK (status IN ('open','closed','invoiced')),
  subtotal        DECIMAL(10,2) DEFAULT 0,
  taxes           DECIMAL(10,2) DEFAULT 0,
  discounts       DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) DEFAULT 0,
  currency        TEXT          DEFAULT 'COP',
  notes           TEXT,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folios_reservation ON folios(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folios_property    ON folios(property_id, status);

-- ── CHARGES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charges (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id       UUID          NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
  property_id    UUID          REFERENCES properties(id),
  type           TEXT          NOT NULL CHECK (type IN ('room','service','food','activity','extra','discount')),
  description    TEXT          NOT NULL,
  quantity       DECIMAL(10,2) DEFAULT 1,
  unit_price     DECIMAL(10,2) NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  currency       TEXT          DEFAULT 'COP',
  date           DATE          DEFAULT CURRENT_DATE,
  pos_session_id UUID,
  created_by     TEXT,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_charges_folio ON charges(folio_id);

-- ── HOUSEKEEPING ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS housekeeping (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID          NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id       UUID          NOT NULL REFERENCES rooms(id),
  date          DATE          DEFAULT CURRENT_DATE,
  status        TEXT          DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','clean','inspected','out_of_order')),
  priority      TEXT          DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to   TEXT,
  notes         TEXT,
  checklist     JSONB         DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  inspected_at  TIMESTAMPTZ,
  inspected_by  TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (property_id, room_id, date)
);
CREATE INDEX IF NOT EXISTS idx_housekeeping_property_date ON housekeeping(property_id, date);

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE rate_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_plans_service"   ON rate_plans;
DROP POLICY IF EXISTS "check_ins_service"    ON check_ins;
DROP POLICY IF EXISTS "folios_service"       ON folios;
DROP POLICY IF EXISTS "charges_service"      ON charges;
DROP POLICY IF EXISTS "housekeeping_service" ON housekeeping;

CREATE POLICY "rate_plans_service"   ON rate_plans   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "check_ins_service"    ON check_ins    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "folios_service"       ON folios       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "charges_service"      ON charges      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "housekeeping_service" ON housekeeping FOR ALL USING (auth.role() = 'service_role');

-- ── SEEDS MÍSTICA ───────────────────────────────────────
INSERT INTO rate_plans (property_id, name, type, base_rate, min_nights, valid_from, valid_to, channels, is_active) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','Tarifa Base','standard',180000,1,NULL,NULL,ARRAY['direct','booking','hostelworld'],true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','Temporada Alta','seasonal',250000,2,'2025-06-15','2025-08-31',ARRAY['all'],true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','Temporada Baja','seasonal',150000,1,'2025-02-01','2025-06-14',ARRAY['all'],true),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb','Fin de Semana','weekend',200000,2,NULL,NULL,ARRAY['direct'],true),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','Tarifa Base','standard',120000,1,NULL,NULL,ARRAY['direct','booking'],true),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','Temporada Alta','seasonal',180000,2,'2025-06-15','2025-08-31',ARRAY['all'],true)
ON CONFLICT DO NOTHING;

INSERT INTO housekeeping (property_id, room_id, date, status, priority)
SELECT r.property_id, r.id, CURRENT_DATE, 'pending', 'normal'
FROM rooms r
WHERE r.property_id IN ('67fbce21-1b88-449f-93e2-1226cda2a7fb','148f7836-6fcf-4d06-8570-bd65fcc2ccf0')
  AND r.is_active = true
ON CONFLICT (property_id, room_id, date) DO NOTHING;

COMMENT ON TABLE rate_plans   IS 'Planes tarifarios por propiedad (base, temporada, weekend, promo, OTA)';
COMMENT ON TABLE check_ins    IS 'Registro de check-in y check-out con datos del huésped';
COMMENT ON TABLE folios       IS 'Cuenta del huésped con subtotal, taxes, total';
COMMENT ON TABLE charges      IS 'Cargos individuales al folio (room, service, food, activity, discount)';
COMMENT ON TABLE housekeeping IS 'Estado de limpieza por habitación por día con checklist';
