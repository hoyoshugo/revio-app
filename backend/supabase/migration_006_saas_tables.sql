-- ============================================================
-- MIGRACIÓN 006: Tablas SaaS para panel Super Admin
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PLANES DE SUSCRIPCIÓN
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(50)  NOT NULL UNIQUE,   -- 'Basic', 'Pro', 'Enterprise'
  slug        VARCHAR(50)  NOT NULL UNIQUE,   -- 'basic', 'pro', 'enterprise'
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency    VARCHAR(5)   DEFAULT 'USD',

  -- Límites del plan
  max_properties    INTEGER DEFAULT 1,
  max_conversations_month INTEGER DEFAULT 500,
  max_users         INTEGER DEFAULT 3,

  -- Canales permitidos
  channels_allowed  TEXT[]  DEFAULT ARRAY['whatsapp', 'web'],
  -- booking, airbnb, hostelworld, expedia, instagram, facebook, google, tripadvisor, tiktok

  -- Features
  features          JSONB   DEFAULT '{}',
  -- { "health_monitor": true, "learning_engine": true, "escalations": true, "reports": true }

  -- Período de gracia en días antes de desactivar por falta de pago
  grace_period_days INTEGER DEFAULT 3,

  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Planes por defecto
INSERT INTO tenant_plans (name, slug, price_monthly, max_properties, max_conversations_month, max_users, channels_allowed, grace_period_days, features)
VALUES
  ('Basic',      'basic',      49,  1, 500,   2, ARRAY['whatsapp','web'], 3,
   '{"health_monitor":false,"learning_engine":false,"escalations":false,"reports":false}'),
  ('Pro',        'pro',        99,  2, 2000,  5, ARRAY['whatsapp','web','booking','airbnb','instagram','facebook'], 3,
   '{"health_monitor":true,"learning_engine":true,"escalations":true,"reports":true}'),
  ('Enterprise', 'enterprise', 249, 5, 10000, 20, ARRAY['whatsapp','web','booking','airbnb','hostelworld','expedia','instagram','facebook','google','tripadvisor','tiktok'], 7,
   '{"health_monitor":true,"learning_engine":true,"escalations":true,"reports":true,"white_label":true}')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. TENANTS (Clientes del SaaS)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(200) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,     -- identificador único del cliente
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(30),
  contact_name  VARCHAR(100),

  -- Plan y facturación
  plan_id       UUID REFERENCES tenant_plans(id),
  billing_cycle VARCHAR(20) DEFAULT 'monthly',    -- monthly | annual
  trial_ends_at TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,
  payment_method VARCHAR(30),                     -- wompi | manual | bank_transfer

  -- Estado
  status        VARCHAR(20) DEFAULT 'trial',
  -- trial | active | suspended | cancelled | overdue

  -- Configuración
  max_properties    INTEGER DEFAULT 1,            -- override del plan
  max_conversations_month INTEGER DEFAULT 500,

  -- Credenciales de acceso al dashboard del cliente
  dashboard_email    VARCHAR(255),
  dashboard_password VARCHAR(255),               -- plaintext (como el resto del sistema)

  -- Vínculo con la tabla properties existente (1 tenant puede tener N properties)
  -- Las properties tienen tenant_id (agregar columna)

  -- Notas internas (solo superadmin ve esto)
  internal_notes TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_checklist JSONB DEFAULT '{}',

  -- Wompi para cobrar
  wompi_subscription_id VARCHAR(255),

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar tenant_id a properties para multitenancy
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status, created_at DESC);

-- ============================================================
-- 3. HISTORIAL DE PAGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES tenant_plans(id),

  amount      DECIMAL(10,2) NOT NULL,
  currency    VARCHAR(5) DEFAULT 'USD',
  status      VARCHAR(20) DEFAULT 'pending',
  -- pending | paid | failed | refunded | cancelled

  -- Período que cubre
  period_start TIMESTAMPTZ,
  period_end   TIMESTAMPTZ,

  -- Referencia de pago
  payment_method   VARCHAR(30),
  external_ref     VARCHAR(255),  -- ID transacción Wompi u otro
  wompi_transaction_id VARCHAR(255),

  -- Registro
  paid_at     TIMESTAMPTZ,
  notes       TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON tenant_payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON tenant_payments(status, period_end);

-- ============================================================
-- 4. REGISTRO DE USO POR CLIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_usage (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Conversaciones
  conversations_count INTEGER DEFAULT 0,
  messages_count      INTEGER DEFAULT 0,

  -- Llamadas a APIs externas
  api_calls_lobbypms  INTEGER DEFAULT 0,
  api_calls_wompi     INTEGER DEFAULT 0,
  api_calls_whatsapp  INTEGER DEFAULT 0,
  api_calls_claude    INTEGER DEFAULT 0,
  api_calls_other     INTEGER DEFAULT 0,

  -- Tokens de Claude consumidos (para calcular costo)
  claude_input_tokens  INTEGER DEFAULT 0,
  claude_output_tokens INTEGER DEFAULT 0,

  -- Costo estimado en USD
  estimated_cost_usd  DECIMAL(10,4) DEFAULT 0,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON tenant_usage(tenant_id, date DESC);

-- ============================================================
-- 5. LOG DE ERRORES DEL SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS system_errors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- NULL = error global del sistema

  severity    VARCHAR(10) NOT NULL DEFAULT 'error',
  -- critical | error | warning | info

  service     VARCHAR(50),     -- backend | supabase | lobbypms | wompi | whatsapp | claude
  error_type  VARCHAR(100),    -- connection_failed | timeout | auth_error | etc.
  message     TEXT NOT NULL,
  stack_trace TEXT,
  context     JSONB DEFAULT '{}',  -- datos adicionales del contexto

  -- Estado de resolución
  status      VARCHAR(20) DEFAULT 'open',
  -- open | reviewing | resolved | ignored

  assigned_to VARCHAR(100),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_errors_tenant ON system_errors(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_status ON system_errors(status, severity, created_at DESC);

-- ============================================================
-- 6. CORRECCIONES APLICADAS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_corrections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_id    UUID REFERENCES system_errors(id),
  tenant_id   UUID REFERENCES tenants(id),

  title       VARCHAR(200) NOT NULL,
  description TEXT,
  applied_by  VARCHAR(100),
  applied_at  TIMESTAMPTZ DEFAULT NOW(),

  -- Resultado
  success     BOOLEAN DEFAULT true,
  result_notes TEXT
);

-- ============================================================
-- 7. TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tenant_plans_updated_at ON tenant_plans;
CREATE TRIGGER trg_tenant_plans_updated_at
  BEFORE UPDATE ON tenant_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. VISTA: resumen de clientes para el dashboard
-- ============================================================
CREATE OR REPLACE VIEW v_tenant_summary AS
SELECT
  t.id, t.business_name, t.slug, t.contact_email, t.status,
  t.trial_ends_at, t.next_payment_at, t.onboarding_completed,
  p.name AS plan_name, p.price_monthly,
  (SELECT COUNT(*) FROM properties pr WHERE pr.tenant_id = t.id) AS property_count,
  COALESCE((
    SELECT SUM(u.conversations_count)
    FROM tenant_usage u
    WHERE u.tenant_id = t.id
      AND u.date >= date_trunc('month', CURRENT_DATE)
  ), 0) AS conversations_this_month,
  t.created_at
FROM tenants t
LEFT JOIN tenant_plans p ON p.id = t.plan_id;
