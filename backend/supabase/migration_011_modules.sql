-- ============================================================
-- Migration 011: Revio Modules System
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Tabla: revio_modules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS revio_modules (
  id              VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  icon            VARCHAR(10),
  category        VARCHAR(50),
  status          VARCHAR(20)  NOT NULL DEFAULT 'development'
                    CHECK (status IN ('production','beta','development','planned')),
  completion_pct  INTEGER      NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  priority        VARCHAR(5)   NOT NULL DEFAULT 'P2',
  is_sellable     BOOLEAN      NOT NULL DEFAULT false,
  base_price_cop  INTEGER      NOT NULL DEFAULT 0,
  dependencies    TEXT[]       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Tabla: tenant_modules ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_modules (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id         VARCHAR(50)  NOT NULL REFERENCES revio_modules(id),
  is_active         BOOLEAN      NOT NULL DEFAULT false,
  activated_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  price_override_cop INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_module ON tenant_modules(module_id);

-- RLS
ALTER TABLE revio_modules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revio_modules_service_all"  ON revio_modules  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "tenant_modules_service_all" ON tenant_modules FOR ALL USING (auth.role() = 'service_role');

-- ── Seed: módulos del ecosistema ──────────────────────────────
INSERT INTO revio_modules (id, name, description, icon, category, status, completion_pct, priority, is_sellable, base_price_cop, dependencies) VALUES
  ('revenue_agent',  'Revenue Agent',        'Agente IA 24/7 — cierra reservas por WhatsApp, OTAs y redes sociales.',           '🤖', 'core',         'production',  90, 'P0', true,  0,       '{}'),
  ('pms',            'PMS Hotelero',         'Gestión hotelera: reservas, habitaciones, huéspedes, facturación DIAN.',           '🏨', 'operations',   'development', 35, 'P1', false, 199000, '{revenue_agent}'),
  ('nfc_pos',        'NFC & Punto de Venta', 'Sistema NFC para consumos. Bar, restaurante, spa con carga a habitación.',         '📲', 'sales',        'beta',        55, 'P1', true,  149000, '{pms}'),
  ('inventory',      'Inventarios',          'Control de stock, proveedores, órdenes de compra y alertas automáticas.',          '📦', 'operations',   'development', 40, 'P1', false, 99000,  '{}'),
  ('channel_manager','Channel Manager',      'Sincronización de disponibilidad y tarifas con OTAs en tiempo real.',              '🔗', 'distribution', 'development', 30, 'P2', false, 149000, '{pms}'),
  ('marketing_ai',   'Marketing IA',         'Agencia de marketing digital IA. Campañas Meta y Google con optimización.',        '📣', 'growth',       'development',  5, 'P2', false, 249000, '{revenue_agent}'),
  ('accounting',     'Contable',             'Sistema contable completo: PUC Colombia, factura electrónica DIAN, nómina.',       '📊', 'finance',      'planned',      5, 'P2', false, 199000, '{}'),
  ('financial',      'Financiero',           'Análisis financiero, presupuestos, evaluación de proyectos y KPIs.',               '💹', 'finance',      'planned',      0, 'P3', false, 149000, '{accounting}'),
  ('mobile_app',     'App Móvil NFC',        'App iOS/Android para meseros. Gestión de consumos con NFC tipo PouchNation.',      '📱', 'sales',        'development',  0, 'P1', false, 0,       '{nfc_pos}')
ON CONFLICT (id) DO UPDATE SET
  completion_pct = EXCLUDED.completion_pct,
  status         = EXCLUDED.status,
  is_sellable    = EXCLUDED.is_sellable,
  updated_at     = NOW();

-- ── Activar módulos para Mística Hostels (cliente fundador) ───
INSERT INTO tenant_modules (tenant_id, module_id, is_active, activated_at, notes)
SELECT t.id, 'revenue_agent', true, NOW(), 'Plan fundador — siempre activo'
FROM tenants t WHERE t.contact_email = 'admin@misticahostels.com'
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = true;

INSERT INTO tenant_modules (tenant_id, module_id, is_active, activated_at, notes)
SELECT t.id, 'nfc_pos', true, NOW(), 'Beta testing — cliente fundador'
FROM tenants t WHERE t.contact_email = 'admin@misticahostels.com'
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = true;

INSERT INTO tenant_modules (tenant_id, module_id, is_active, activated_at, notes)
SELECT t.id, 'inventory', true, NOW(), 'Módulo piloto — beta'
FROM tenants t WHERE t.contact_email = 'admin@misticahostels.com'
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = true;

COMMENT ON TABLE revio_modules  IS 'Catálogo de módulos del ecosistema Revio con estado de desarrollo';
COMMENT ON TABLE tenant_modules IS 'Módulos activos por tenant — controlado desde SuperAdmin';
