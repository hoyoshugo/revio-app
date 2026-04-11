-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN 015 — Property Knowledge Seed (tenant demo)
-- Agrega los campos nuevos de Info Propiedad que no existían:
-- general/gps, general/entorno, food/descripcion, media/fotos
--
-- Esta migración seed aplica SOLO al tenant demo (cliente de prueba).
-- Los tenants productivos deben configurar sus propios valores desde
-- el panel "Info Propiedad" en Settings.
--
-- Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql/new
-- Idempotente — usa ON CONFLICT DO UPDATE.
-- ═══════════════════════════════════════════════════════

-- ── Demo property #1 (Isla Palma) ──────────────────────
INSERT INTO property_knowledge (property_id, category, key, value, is_active, sort_order) VALUES
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'general', 'gps',
   '10.1833° N, 75.7833° W', true, 0),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'general', 'entorno',
   'Isla privada en el Archipiélago de San Bernardo. Rodeada de arrecifes de coral, manglares y aguas turquesas. Sin carreteras, sin ruido urbano. Acceso exclusivo por lancha desde Cartagena o Tolú.',
   true, 0),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'food', 'descripcion',
   'Restaurante y bar en terraza con vista al mar. Desayuno incluido en la estadía. Menú de mariscos frescos, coctelería tropical y snacks. Horario de bar: 10 AM - 10 PM.',
   true, 0),
  ('67fbce21-1b88-449f-93e2-1226cda2a7fb', 'media', 'fotos',
   '[]', true, 0)
ON CONFLICT (property_id, category, key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

-- ── Demo property #2 (Tayrona) ─────────────────────────
INSERT INTO property_knowledge (property_id, category, key, value, is_active, sort_order) VALUES
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'general', 'gps',
   '11.3167° N, 74.0500° W', true, 0),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'general', 'entorno',
   'Ubicado en Bahía Cinto, dentro del Parque Nacional Natural Tayrona. Rodeado de selva tropical, playas vírgenes y sitios arqueológicos ancestrales. Sin acceso vehicular directo.',
   true, 0),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'food', 'descripcion',
   'Cocina ecológica con ingredientes locales de la región. Desayuno incluido. Especialidad en pescado fresco y cocina costeña colombiana.',
   true, 0),
  ('148f7836-6fcf-4d06-8570-bd65fcc2ccf0', 'media', 'fotos',
   '[]', true, 0)
ON CONFLICT (property_id, category, key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();
