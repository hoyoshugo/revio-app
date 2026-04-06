-- ============================================================
-- Migration 008: Inventory Module
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Tabla: inventory_items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  sku           TEXT,
  categoria     TEXT NOT NULL DEFAULT 'General',
  stock_actual  NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_minimo  NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_costo  NUMERIC(12,2) NOT NULL DEFAULT 0,
  bodega        TEXT,
  proveedor     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SKU único por propiedad (cuando se informa)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku
  ON inventory_items(property_id, sku)
  WHERE sku IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_inventory_items_property
  ON inventory_items(property_id, is_active);

CREATE INDEX IF NOT EXISTS idx_inventory_items_categoria
  ON inventory_items(property_id, categoria)
  WHERE is_active = true;

-- ── Tabla: inventory_movements ────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad        NUMERIC(10,2) NOT NULL,
  stock_anterior  NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_nuevo     NUMERIC(10,2) NOT NULL DEFAULT 0,
  motivo          TEXT,
  user_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON inventory_movements(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_property
  ON inventory_movements(property_id, created_at DESC);

-- ── RLS: un hotel solo ve su propio inventario ─────────────────
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Política para inventory_items
CREATE POLICY "inventory_items_property_isolation"
  ON inventory_items
  FOR ALL
  USING (property_id = (current_setting('app.current_property_id', true))::UUID);

-- Política para inventory_movements
CREATE POLICY "inventory_movements_property_isolation"
  ON inventory_movements
  FOR ALL
  USING (property_id = (current_setting('app.current_property_id', true))::UUID);

-- Service role bypass (backend usa service_role key — omite RLS)
-- No se necesita policy adicional: service_role ya tiene acceso total.

-- ── Comentarios para documentación ───────────────────────────
COMMENT ON TABLE inventory_items IS 'Items de inventario por propiedad (bodega, bar, amenities, etc.)';
COMMENT ON TABLE inventory_movements IS 'Historial de movimientos de stock: entradas, salidas y ajustes';
COMMENT ON COLUMN inventory_movements.tipo IS 'entrada: suma al stock | salida: resta al stock | ajuste: setea valor absoluto';
