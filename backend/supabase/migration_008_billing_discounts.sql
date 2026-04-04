-- ============================================================
-- Migration 008: Billing & Discounts
-- Revio SaaS — TRES HACHE ENTERPRISE SAS
-- Created: 2026-04-03
-- ============================================================

-- ── Tenant additional billing columns ───────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS activated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date     DATE,
  ADD COLUMN IF NOT EXISTS billing_cycle         TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN IF NOT EXISTS wompi_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS wompi_customer_id     TEXT;

-- ── tenant_discounts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_discounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('percent_permanent','percent_temporary','trial_extension','plan_upgrade')),
  value            NUMERIC,                    -- percent or days
  expires_at       TIMESTAMPTZ,                -- for percent_temporary
  upgraded_plan_id UUID REFERENCES tenant_plans(id),
  note             TEXT,
  created_by       TEXT DEFAULT 'superadmin',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_discounts_tenant ON tenant_discounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_expires ON tenant_discounts(expires_at);

-- ── landing_config ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO landing_config (key, value) VALUES
  ('hero',        '{"headline": "El agente IA que convierte tus chats en reservas", "subheadline": "Automatiza WhatsApp, OTAs y recepción con IA entrenada para hostels y hoteles en Colombia."}'::jsonb),
  ('pricing',     '{"basico": 299000, "pro": 599000, "enterprise": 1199000}'::jsonb),
  ('integrations','["WhatsApp", "Booking.com", "Airbnb", "LobbyPMS", "Wompi", "Instagram", "Facebook"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── promo_codes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  discount_pct    INT NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
  max_uses        INT DEFAULT 1,
  used_count      INT DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- ── v_tenant_billing view ────────────────────────────────────
CREATE OR REPLACE VIEW v_tenant_billing AS
SELECT
  t.id                                          AS tenant_id,
  t.business_name,
  t.status,
  t.trial_ends_at,
  t.activated_at,
  t.suspended_at,
  t.next_billing_date,
  t.billing_cycle,
  tp.name                                       AS plan_name,
  tp.price_monthly,
  tp.extra_property_price,
  COUNT(DISTINCT p.id)                          AS active_properties,
  GREATEST(0, COUNT(DISTINCT p.id) - 1)         AS extra_properties,
  COALESCE(
    SUM(CASE WHEN td.type IN ('percent_permanent','percent_temporary')
             AND (td.expires_at IS NULL OR td.expires_at > NOW())
             THEN td.value ELSE 0 END), 0
  )                                             AS total_discount_pct
FROM tenants t
LEFT JOIN tenant_plans tp    ON tp.id = t.plan_id
LEFT JOIN properties p       ON p.tenant_id = t.id AND p.is_active = TRUE
LEFT JOIN tenant_discounts td ON td.tenant_id = t.id
GROUP BY t.id, t.business_name, t.status, t.trial_ends_at, t.activated_at,
         t.suspended_at, t.next_billing_date, t.billing_cycle,
         tp.name, tp.price_monthly, tp.extra_property_price;

-- ── Update Revio plan prices (COP) ──────────────────────────
-- Ensures plans match Revio pricing in COP
UPDATE tenant_plans SET
  price_monthly        = 299000,
  extra_property_price = 149000
WHERE LOWER(name) LIKE '%básico%' OR LOWER(name) LIKE '%basico%' OR LOWER(name) LIKE '%basic%';

UPDATE tenant_plans SET
  price_monthly        = 599000,
  extra_property_price = 249000
WHERE LOWER(name) LIKE '%pro%';

UPDATE tenant_plans SET
  price_monthly        = 1199000,
  extra_property_price = 399000
WHERE LOWER(name) LIKE '%enterprise%';

-- Add extra_property_price column if not already present
ALTER TABLE tenant_plans
  ADD COLUMN IF NOT EXISTS extra_property_price BIGINT DEFAULT 0;
