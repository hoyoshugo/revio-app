-- ============================================================
-- Migration 009: POS Tables (revenue_centers, products, pos_orders)
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Tabla: revenue_centers ────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_centers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'bar' CHECK (type IN ('bar','restaurant','store','tours','spa','other')),
  description TEXT,
  icon        TEXT DEFAULT 'store',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revenue_centers_property ON revenue_centers(property_id, is_active);

-- ── Tabla: products ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  revenue_center_id UUID REFERENCES revenue_centers(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  price             NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost              NUMERIC(12,2) DEFAULT 0,
  sku               TEXT,
  photo_url         TEXT,
  stock             INT DEFAULT 0,
  min_stock         INT DEFAULT 0,
  track_stock       BOOLEAN NOT NULL DEFAULT false,
  unit              TEXT DEFAULT 'unidad',
  is_available      BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_property ON products(property_id, is_available);
CREATE INDEX IF NOT EXISTS idx_products_rc ON products(revenue_center_id);

-- ── Tabla: pos_orders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  revenue_center_id UUID REFERENCES revenue_centers(id) ON DELETE SET NULL,
  order_number      TEXT NOT NULL,
  payment_method    TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','wristband','room_charge')),
  guest_id          UUID,
  reservation_id    UUID,
  table_number      TEXT,
  notes             TEXT,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_received     NUMERIC(12,2),
  cash_change       NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('open','paid','cancelled')),
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_orders_property ON pos_orders(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(property_id, status);

-- ── Tabla: pos_order_items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL,
  subtotal     NUMERIC(12,2) NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_order ON pos_order_items(order_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE revenue_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_centers_isolation" ON revenue_centers FOR ALL
  USING (property_id = (current_setting('app.current_property_id', true))::UUID);

CREATE POLICY "products_isolation" ON products FOR ALL
  USING (property_id = (current_setting('app.current_property_id', true))::UUID);

CREATE POLICY "pos_orders_isolation" ON pos_orders FOR ALL
  USING (property_id = (current_setting('app.current_property_id', true))::UUID);

CREATE POLICY "pos_order_items_isolation" ON pos_order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM pos_orders o WHERE o.id = pos_order_items.order_id AND o.property_id = (current_setting('app.current_property_id', true))::UUID));

-- ── Datos demo para Mística Isla Palma ───────────────────────
-- Ejecutar solo si quieres datos de prueba (ajusta el property_id):
-- INSERT INTO revenue_centers (property_id, name, type, icon, sort_order) VALUES
--   ('<property_id>', 'Bar La Palma', 'bar', 'wine', 1),
--   ('property_id>', 'Restaurante', 'restaurant', 'utensils', 2),
--   ('<property_id>', 'Tienda', 'store', 'shopping-bag', 3);
