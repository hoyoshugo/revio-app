-- migration_025_byok_anthropic.sql
-- E-AGENT-4: BYOK Anthropic + tracking de costo + billing.
--
-- Agrega flags al tenants para que el operador elija:
--   - BYOK (configurar su propia API key Anthropic, billing directo a su cuenta)
--   - Platform (usar la key plataforma Alzio, cobro metered con margin)
--
-- Idempotente.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS byok_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS platform_billing_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS max_conversations_month INTEGER DEFAULT 1000;

-- Default razonable para tenants existentes:
-- Si tenant tiene status='trial' o 'active' y NO tiene anthropic_config: usa platform
-- (y se cobra metered cuando lleguen los pagos del E-AGENT-4 metered billing).
UPDATE public.tenants
SET byok_required = false,
    platform_billing_enabled = true,
    max_conversations_month = COALESCE(max_conversations_month, 1000)
WHERE byok_required IS NULL OR platform_billing_enabled IS NULL;

-- Verificación
SELECT
  CASE WHEN byok_required THEN 'BYOK' ELSE 'Platform' END AS billing_mode,
  count(*) AS tenants
FROM public.tenants
GROUP BY billing_mode;
