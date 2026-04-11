-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 014 — Wallets + POS + Currency + Tenant Billing
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente — puede ejecutarse múltiples veces sin romper.
-- ═══════════════════════════════════════════════════════

-- ── WALLETS (NFC guest wallets) ─────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_name       VARCHAR(200) NOT NULL,
  guest_email      VARCHAR(200),
  guest_phone      VARCHAR(50),
  nfc_uid          VARCHAR(100) UNIQUE,
  room_number      VARCHAR(50),
  reservation_id   VARCHAR(100),
  balance_cop      BIGINT       DEFAULT 0,
  credit_limit_cop BIGINT       DEFAULT 500000,
  status           VARCHAR(20)  DEFAULT 'active'
                     CHECK (status IN ('active','suspended','closed','checked_out')),
  check_in_date    DATE,
  check_out_date   DATE,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallets_property ON wallets(property_id, status);
CREATE INDEX IF NOT EXISTS idx_wallets_nfc      ON wallets(nfc_uid) WHERE nfc_uid IS NOT NULL;

-- ── WALLET_TRANSACTIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID         NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  property_id     UUID         NOT NULL,
  type            VARCHAR(20)  NOT NULL
                    CHECK (type IN ('charge','payment','refund','adjustment','topup')),
  amount_cop      BIGINT       NOT NULL,
  description     VARCHAR(300),
  pos_session_id  UUID,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id, created_at DESC);

-- ── POS_SESSIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id        UUID         NOT NULL,
  cashier_name     VARCHAR(200),
  station_name     VARCHAR(100) DEFAULT 'POS Principal',
  status           VARCHAR(20)  DEFAULT 'open'
                     CHECK (status IN ('open','closed')),
  opened_at        TIMESTAMPTZ  DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  total_sales_cop  BIGINT       DEFAULT 0,
  total_cash_cop   BIGINT       DEFAULT 0,
  total_card_cop   BIGINT       DEFAULT 0,
  total_wallet_cop BIGINT       DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_property ON pos_sessions(property_id, status);

-- ── POS_ITEMS (líneas de venta) ─────────────────────────
CREATE TABLE IF NOT EXISTS pos_items (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_session_id   UUID         NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,
  wallet_id        UUID         REFERENCES wallets(id),
  property_id      UUID         NOT NULL,
  category         VARCHAR(50),
  product_name     VARCHAR(200) NOT NULL,
  quantity         INTEGER      NOT NULL DEFAULT 1,
  unit_price_cop   BIGINT       NOT NULL,
  total_price_cop  BIGINT       NOT NULL,
  payment_method   VARCHAR(20)  DEFAULT 'wallet'
                     CHECK (payment_method IN ('wallet','cash','card','mixed')),
  notes            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pos_items_session ON pos_items(pos_session_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_wallet  ON pos_items(wallet_id) WHERE wallet_id IS NOT NULL;

-- ── CURRENCY_RATES (tasas cacheadas) ────────────────────
CREATE TABLE IF NOT EXISTS currency_rates (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency    VARCHAR(10)   NOT NULL DEFAULT 'COP',
  target_currency  VARCHAR(10)   NOT NULL,
  rate             DECIMAL(20,8) NOT NULL,
  source           VARCHAR(100)  DEFAULT 'frankfurter.app',
  fetched_at       TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(base_currency, target_currency)
);

-- ── TENANT_BILLING (pago/habilitación) ──────────────────
CREATE TABLE IF NOT EXISTS tenant_billing (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  status                 VARCHAR(20)  DEFAULT 'trial'
                           CHECK (status IN ('trial','active','suspended','cancelled')),
  plan                   VARCHAR(50)  DEFAULT 'starter',
  billing_currency       VARCHAR(10)  DEFAULT 'COP',
  monthly_price_cop      BIGINT       DEFAULT 299000,
  trial_ends_at          TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '30 days'),
  current_period_start   TIMESTAMPTZ  DEFAULT NOW(),
  current_period_end     TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '30 days'),
  payment_method         VARCHAR(50),
  last_payment_at        TIMESTAMPTZ,
  last_payment_amount_cop BIGINT,
  next_due_at            TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '30 days'),
  manually_enabled_until TIMESTAMPTZ,
  enabled_by             VARCHAR(200),
  notes                  TEXT,
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_billing       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_service"         ON wallets;
DROP POLICY IF EXISTS "wallet_tx_service"       ON wallet_transactions;
DROP POLICY IF EXISTS "pos_sessions_service"    ON pos_sessions;
DROP POLICY IF EXISTS "pos_items_service"       ON pos_items;
DROP POLICY IF EXISTS "currency_rates_service"  ON currency_rates;
DROP POLICY IF EXISTS "tenant_billing_service"  ON tenant_billing;

CREATE POLICY "wallets_service"         ON wallets              FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "wallet_tx_service"       ON wallet_transactions  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pos_sessions_service"    ON pos_sessions         FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "pos_items_service"       ON pos_items            FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "currency_rates_service"  ON currency_rates       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "tenant_billing_service"  ON tenant_billing       FOR ALL USING (auth.role() = 'service_role');

-- ── SEED TENANT_BILLING Mística (cliente fundador, 365 días) ──
INSERT INTO tenant_billing (tenant_id, status, plan, billing_currency, monthly_price_cop,
                            trial_ends_at, manually_enabled_until, enabled_by, notes)
SELECT id, 'active', 'professional', 'COP', 999000,
       NOW() + INTERVAL '365 days',
       NOW() + INTERVAL '365 days',
       'admin@revio.co',
       'Cliente fundador — descuento 20% permanente'
FROM tenants
WHERE contact_email = 'admin@misticahostels.com'
ON CONFLICT (tenant_id) DO UPDATE
  SET status = 'active',
      manually_enabled_until = NOW() + INTERVAL '365 days';

-- ── SEED CURRENCY RATES iniciales ───────────────────────
INSERT INTO currency_rates (base_currency, target_currency, rate) VALUES
  ('COP', 'USD', 0.000244),
  ('COP', 'EUR', 0.000225),
  ('COP', 'GBP', 0.000193),
  ('USD', 'COP', 4100.0),
  ('EUR', 'COP', 4450.0),
  ('GBP', 'COP', 5180.0)
ON CONFLICT (base_currency, target_currency) DO NOTHING;

COMMENT ON TABLE wallets             IS 'Billeteras NFC de huéspedes para consumos en hotel';
COMMENT ON TABLE wallet_transactions IS 'Movimientos de billeteras NFC';
COMMENT ON TABLE pos_sessions        IS 'Sesiones de punto de venta';
COMMENT ON TABLE pos_items           IS 'Items vendidos en cada sesión POS';
COMMENT ON TABLE currency_rates      IS 'Tasas de cambio cacheadas con TTL 1 hora (frankfurter.app)';
COMMENT ON TABLE tenant_billing      IS 'Control de facturación y habilitación de tenants (pago o manual)';
