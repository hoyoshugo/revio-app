-- migration_010_full_pms_fixed.sql
-- Tablas completas PMS: rooms, housekeeping, POS, wallets, events, revenue centers
-- VERSION CORREGIDA — idempotente, compatible con migration_009 ya aplicada
--
-- CAMBIOS vs migration_010_full_pms.sql:
--   1. ADD COLUMN IF NOT EXISTS wallet_id antes del ADD CONSTRAINT fk_pos_wallet
--   2. FKs de pos_orders (guest_id, reservation_id) agregadas despues de crear guests/reservations
--   3. Todos los ADD CONSTRAINT envueltos en DO...EXCEPTION para idempotencia
--   4. Tablas que ya existen (revenue_centers, products, pos_orders, pos_order_items)
--      usan CREATE TABLE IF NOT EXISTS — se saltean sin error
-- ============================================================

-- ============================================================
-- TABLA: room_types
-- ============================================================
CREATE TABLE IF NOT EXISTS room_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(50) NOT NULL,
  description   TEXT,
  capacity      INT NOT NULL DEFAULT 2,
  beds          JSONB DEFAULT '[]',
  base_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3) DEFAULT 'COP',
  amenities     TEXT[] DEFAULT ARRAY[]::TEXT[],
  photos        TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, slug)
);

-- ============================================================
-- TABLA: rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id  UUID REFERENCES room_types(id) ON DELETE SET NULL,
  number        VARCHAR(20) NOT NULL,
  name          VARCHAR(100),
  floor         INT DEFAULT 1,
  capacity      INT DEFAULT 2,
  status        VARCHAR(20) DEFAULT 'available',
  notes         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, number)
);

-- ============================================================
-- TABLA: guests
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID REFERENCES properties(id) ON DELETE CASCADE,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100),
  email             VARCHAR(255),
  phone             VARCHAR(50),
  nationality       VARCHAR(100),
  document_type     VARCHAR(20) DEFAULT 'CC',
  document_number   VARCHAR(50),
  date_of_birth     DATE,
  gender            VARCHAR(10),
  address           TEXT,
  city              VARCHAR(100),
  country           VARCHAR(100) DEFAULT 'Colombia',
  language          VARCHAR(5) DEFAULT 'es',
  tags              TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes             TEXT,
  total_stays       INT DEFAULT 0,
  total_spent       DECIMAL(12,2) DEFAULT 0,
  last_stay_date    DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Link bookings → guests y rooms
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id  UUID REFERENCES rooms(id)  ON DELETE SET NULL;

-- ============================================================
-- TABLA: reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  room_type_id    UUID REFERENCES room_types(id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,

  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  nights          INT GENERATED ALWAYS AS (check_out - check_in) STORED,
  adults          INT DEFAULT 1,
  children        INT DEFAULT 0,

  rate_per_night  DECIMAL(12,2) DEFAULT 0,
  total_amount    DECIMAL(12,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'COP',

  status          VARCHAR(30) DEFAULT 'confirmed',
  source          VARCHAR(50) DEFAULT 'direct',
  channel_ref     VARCHAR(100),
  color           VARCHAR(7) DEFAULT '#6366F1',

  special_requests TEXT,
  internal_notes   TEXT,

  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: housekeeping_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id        UUID REFERENCES rooms(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  type           VARCHAR(30) DEFAULT 'checkout_clean',
  status         VARCHAR(20) DEFAULT 'pending',
  priority       VARCHAR(10) DEFAULT 'normal',
  assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_for  DATE,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  checklist      JSONB DEFAULT '[]',
  photos         TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: events
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID REFERENCES properties(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  type          VARCHAR(30) DEFAULT 'local',
  impact        VARCHAR(20) DEFAULT 'medium',
  color         VARCHAR(7) DEFAULT '#F59E0B',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: revenue_centers (ya existe — CREATE IF NOT EXISTS la saltea)
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue_centers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  type          VARCHAR(30) DEFAULT 'bar',
  description   TEXT,
  icon          VARCHAR(50) DEFAULT 'store',
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: products (ya existe — CREATE IF NOT EXISTS la saltea)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  revenue_center_id UUID REFERENCES revenue_centers(id) ON DELETE SET NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  category          VARCHAR(100),
  price             DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) DEFAULT 'COP',
  sku               VARCHAR(50),
  photo_url         TEXT,
  is_available      BOOLEAN DEFAULT TRUE,
  sort_order        INT DEFAULT 0,
  stock             INT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: pos_orders (ya existe desde migration_009 — saltea CREATE)
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  revenue_center_id UUID REFERENCES revenue_centers(id) ON DELETE SET NULL,
  reservation_id    UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id          UUID REFERENCES guests(id) ON DELETE SET NULL,
  wallet_id         UUID,

  order_number      SERIAL,

  subtotal          DECIMAL(12,2) DEFAULT 0,
  taxes             DECIMAL(12,2) DEFAULT 0,
  discount          DECIMAL(12,2) DEFAULT 0,
  total             DECIMAL(12,2) DEFAULT 0,
  currency          VARCHAR(3) DEFAULT 'COP',

  status            VARCHAR(20) DEFAULT 'open',
  payment_method    VARCHAR(30),

  notes             TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- FIX: agregar FKs a la pos_orders existente (migration_009 las creo sin constraints)
-- guests y reservations ya estan creadas arriba, por eso este bloque va aqui.
DO $$ BEGIN
  ALTER TABLE pos_orders
    ADD CONSTRAINT fk_pos_orders_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  ALTER TABLE pos_orders
    ADD CONSTRAINT fk_pos_orders_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================================
-- TABLA: pos_order_items (ya existe — saltea CREATE)
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  VARCHAR(200) NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  subtotal      DECIMAL(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: wristband_wallets
-- ============================================================
CREATE TABLE IF NOT EXISTS wristband_wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  wristband_code  VARCHAR(50) UNIQUE NOT NULL,
  qr_data         TEXT,
  balance         DECIMAL(12,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'COP',
  is_active       BOOLEAN DEFAULT TRUE,
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  guest_name      VARCHAR(200),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FIX PROBLEMA PRINCIPAL: wallet_id no existe en pos_orders real
-- La columna no se creo porque migration_009 no la incluia y el
-- CREATE TABLE IF NOT EXISTS de esta migracion fue salteado.
-- Solución: ADD COLUMN IF NOT EXISTS + luego ADD CONSTRAINT.
-- ============================================================
ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS wallet_id UUID;

DO $$ BEGIN
  ALTER TABLE pos_orders
    ADD CONSTRAINT fk_pos_wallet
    FOREIGN KEY (wallet_id) REFERENCES wristband_wallets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================================
-- TABLA: wallet_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES wristband_wallets(id) ON DELETE CASCADE,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description   TEXT,
  reference     VARCHAR(100),
  pos_order_id  UUID REFERENCES pos_orders(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: price_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS price_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id    UUID REFERENCES room_types(id) ON DELETE CASCADE,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  reason          TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rooms_property        ON rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status          ON rooms(property_id, status);
CREATE INDEX IF NOT EXISTS idx_room_types_property   ON room_types(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates    ON reservations(property_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_room     ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status   ON reservations(property_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_property       ON guests(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_email          ON guests(email);
CREATE INDEX IF NOT EXISTS idx_housekeeping_property ON housekeeping_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_status   ON housekeeping_tasks(property_id, status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_date     ON housekeeping_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_pos_orders_property   ON pos_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status     ON pos_orders(property_id, status);
CREATE INDEX IF NOT EXISTS idx_wallets_property      ON wristband_wallets(property_id);
CREATE INDEX IF NOT EXISTS idx_wallets_code          ON wristband_wallets(wristband_code);
CREATE INDEX IF NOT EXISTS idx_wallet_txn            ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_products_property     ON products(property_id, is_available);
CREATE INDEX IF NOT EXISTS idx_events_property       ON events(property_id, start_date);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'room_types','rooms','guests','reservations','housekeeping_tasks',
    'products','pos_orders','wristband_wallets'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%s ON %s', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE room_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_tasks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_centers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wristband_wallets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_overrides     ENABLE ROW LEVEL SECURITY;

-- Politica service_role: acceso total (el backend usa service_role key)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'room_types','rooms','guests','reservations','housekeeping_tasks',
    'events','revenue_centers','products','pos_orders','pos_order_items',
    'wristband_wallets','wallet_transactions','price_overrides'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_all ON %s', t);
    EXECUTE format(
      'CREATE POLICY service_all ON %s USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMENTARIOS
-- ============================================================
COMMENT ON TABLE room_types          IS 'Tipos de habitacion (dormitorios, cabanas, suites)';
COMMENT ON TABLE rooms               IS 'Habitaciones individuales con estado en tiempo real';
COMMENT ON TABLE guests              IS 'Maestro de huespedes unificado cross-propiedades';
COMMENT ON TABLE reservations        IS 'Reservas con soporte para vista Gantt y drag-and-drop';
COMMENT ON TABLE housekeeping_tasks  IS 'Tablero de tareas de housekeeping por habitacion';
COMMENT ON TABLE events              IS 'Eventos locales/nacionales que afectan tarifas';
COMMENT ON TABLE revenue_centers     IS 'Centros de revenue: bar, restaurante, tours';
COMMENT ON TABLE products            IS 'Productos de los centros de revenue';
COMMENT ON TABLE pos_orders          IS 'Ordenes del punto de venta';
COMMENT ON TABLE wristband_wallets   IS 'Billeteras digitales vinculadas a brazaletes NFC';
COMMENT ON TABLE wallet_transactions IS 'Movimientos de billetera (recargas, cobros, reembolsos)';
