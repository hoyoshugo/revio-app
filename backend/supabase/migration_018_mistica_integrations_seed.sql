-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 018 — Seed de credenciales demo tenant
-- Poblado programáticamente desde backend/.env vía script
-- (ver scripts/seed-mistica-integrations.js si aplica).
--
-- Este archivo documenta QUÉ se seedea, pero NO contiene las
-- credenciales reales (evita hardcoding en repo).
--
-- El seed afecta:
--   · settings                    (key='connections')
--   · tenant_provider_selections  (ai=anthropic, payments=wompi, pms=lobbypms)
--   · property_channels           (credentials)
--
-- Ejecutar desde Node en lugar de SQL Editor:
--   cd backend && node --env-file=.env scripts/seed-mistica-integrations.js
-- ═══════════════════════════════════════════════════════

-- Placeholder documental. Ejecutado el 2026-04-11 mediante script.
-- Los valores reales vienen del .env: ANTHROPIC_API_KEY, WOMPI_*,
-- FACEBOOK_PAGE_TOKEN, WHATSAPP_PHONE_ID, LOBBY_TOKEN_*, INSTAGRAM_TOKEN.

SELECT 'migration_018 documental — seed aplicado por script' AS status;
