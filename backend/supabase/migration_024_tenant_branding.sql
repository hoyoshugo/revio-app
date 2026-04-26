-- migration_024_tenant_branding.sql
-- E-AGENT-3: Per-tenant branding del widget embebible.
--
-- Agrega columnas de branding a tenants para que /embed.js?tenant=<slug>
-- pueda renderizar logo, colores, nombre del agente y greeting custom.
--
-- Idempotente.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS greeting_custom TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS avatar_emoji TEXT;

-- Defaults razonables para tenants existentes
UPDATE public.tenants
SET primary_color = COALESCE(primary_color, '#6366F1'),
    accent_color = COALESCE(accent_color, '#4F46E5'),
    avatar_emoji = COALESCE(avatar_emoji, '💬'),
    agent_name = COALESCE(agent_name, 'Asistente · En línea')
WHERE primary_color IS NULL OR accent_color IS NULL OR avatar_emoji IS NULL OR agent_name IS NULL;

-- Verificación
SELECT 'tenants_with_branding' AS metric, count(*) AS value
FROM public.tenants
WHERE primary_color IS NOT NULL;
