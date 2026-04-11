-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 018b — Consolidada
-- Agrega: group_name en tenants, is_visible en tenant_modules,
--         portugués en idiomas del demo tenant
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente — puede ejecutarse múltiples veces sin romper.
-- ═══════════════════════════════════════════════════════

-- ── tenants: group_name + group_description ─────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS group_name         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS group_description  TEXT;

UPDATE tenants
  SET group_name = 'Mística Hostels'
  WHERE (business_name ILIKE '%mistica%' OR business_name ILIKE '%mística%' OR contact_email ILIKE '%mistica%')
    AND (group_name IS NULL OR group_name = '');

-- ── tenant_modules: is_visible ──────────────────────────
ALTER TABLE tenant_modules ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT false;

-- Solo revenue_agent visible por defecto (los otros módulos existen
-- pero no están terminados — no mostrar en sidebar todavía)
UPDATE tenant_modules SET is_visible = true  WHERE module_id = 'revenue_agent';
UPDATE tenant_modules SET is_visible = false WHERE module_id <> 'revenue_agent';

-- ── property_knowledge: portugués en idiomas ────────────
INSERT INTO property_knowledge (property_id, category, key, value, is_active, sort_order)
VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'general', 'idiomas', 'Español, Inglés, Francés, Alemán, Portugués', true, 0),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'general', 'idiomas', 'Español, Inglés, Francés, Alemán, Portugués', true, 0)
ON CONFLICT (property_id, category, key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

COMMENT ON COLUMN tenants.group_name        IS 'Nombre comercial del grupo hotelero (ej: Mística Hostels)';
COMMENT ON COLUMN tenants.group_description IS 'Descripción del grupo mostrada al agente IA';
COMMENT ON COLUMN tenant_modules.is_visible IS 'Si false, el módulo no aparece en el sidebar (útil para ocultar módulos en desarrollo)';
