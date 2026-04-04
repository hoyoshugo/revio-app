-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/sql
-- Orden: 1. migration_008  2. migration_009  3. knowledge base
-- ============================================================

-- ============================================================
-- MIGRATION 008: Billing & Discounts
-- ============================================================
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS activated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date     DATE,
  ADD COLUMN IF NOT EXISTS billing_cycle         TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN IF NOT EXISTS wompi_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS wompi_customer_id     TEXT;

CREATE TABLE IF NOT EXISTS tenant_discounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('percent_permanent','percent_temporary','trial_extension','plan_upgrade')),
  value            NUMERIC,
  expires_at       TIMESTAMPTZ,
  upgraded_plan_id UUID REFERENCES tenant_plans(id),
  note             TEXT,
  created_by       TEXT DEFAULT 'superadmin',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_tenant  ON tenant_discounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_discounts_expires ON tenant_discounts(expires_at);

CREATE TABLE IF NOT EXISTS landing_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO landing_config (key, value) VALUES
  ('hero','{"headline":"El agente IA que convierte tus chats en reservas","subheadline":"Automatiza WhatsApp, OTAs y recepcion con IA entrenada para hostels en Colombia."}'::jsonb),
  ('pricing','{"basico":299000,"pro":599000,"enterprise":1199000}'::jsonb),
  ('integrations','["WhatsApp","Booking.com","Airbnb","LobbyPMS","Wompi","Instagram","Facebook"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS promo_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  discount_pct INT NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
  max_uses     INT DEFAULT 1,
  used_count   INT DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

ALTER TABLE tenant_plans ADD COLUMN IF NOT EXISTS extra_property_price BIGINT DEFAULT 0;
UPDATE tenant_plans SET price_monthly=299000, extra_property_price=149000 WHERE LOWER(name) LIKE '%basico%' OR LOWER(name) LIKE '%basic%';
UPDATE tenant_plans SET price_monthly=599000, extra_property_price=249000 WHERE LOWER(name) LIKE '%pro%';
UPDATE tenant_plans SET price_monthly=1199000, extra_property_price=399000 WHERE LOWER(name) LIKE '%enterprise%';

-- ============================================================
-- MIGRATION 009: Property Knowledge Base
-- ============================================================
CREATE TABLE IF NOT EXISTS property_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, category, key)
);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_property ON property_knowledge(property_id);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_category ON property_knowledge(property_id, category);
CREATE INDEX IF NOT EXISTS idx_property_knowledge_active   ON property_knowledge(property_id, is_active);

CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON property_knowledge;
CREATE TRIGGER trg_knowledge_updated_at BEFORE UPDATE ON property_knowledge FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

-- ============================================================
-- KNOWLEDGE BASE: MISTICA ISLA PALMA
-- property_id: 67fbce21-1b88-449f-93e2-1226cda2a7fb
-- ============================================================
INSERT INTO property_knowledge (property_id, category, key, value, sort_order) VALUES
('67fbce21-1b88-449f-93e2-1226cda2a7fb','general','nombre','Mistica Isla Palma Hostel',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','general','descripcion','Hostel ecologico en la Isla Palma, Bolivar, Colombia. Isla privada rodeada de arrecifes de coral y playa.',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','general','ubicacion','Isla Palma, Bahia de Barbacoas, Bolivar, Colombia. Solo acceso por lancha.',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','general','web','https://misticaisland.com',4),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','general','whatsapp','+573234392420',5),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','rooms','tipos','Dormitorios mixtos (dorms), habitaciones privadas con bano, cabanas sobre el mar',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','rooms','restriccion_ninos','No se permiten ninos menores de 7 anos',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','rooms','capacidad_maxima','Aprox. 60 camas entre todas las opciones de alojamiento',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','policies','check_in','Check-in desde las 3:00 PM',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','policies','check_out','Check-out hasta las 11:00 AM',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','policies','cancelacion','Cancelacion gratuita hasta 7 dias antes. Cancelaciones tardias sin reembolso.',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','policies','mascotas','No se permiten mascotas',4),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','activities','incluidas','Snorkeling en arrecife de coral, kayak, paddleboard, senderismo por la isla, fogatas nocturnas',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','activities','tours_pagados','Tour pesca deportiva, buceo certificado, excursiones a islas vecinas',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','activities','link','https://misticaisland.com/services',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','transport','como_llegar','Via Cartagena: lancha privada desde muelle Bazurto o La Bodeguita. Tambien desde Tolu y Covenas.',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','transport','link_instrucciones','https://misticaisland.com/how-to-get',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','transport','tiempo_viaje','45-90 minutos en lancha segun punto de partida',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','faq','link','https://misticaisland.com/faq',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','faq','wifi','WiFi limitado. Isla con conectividad reducida por ubicacion remota.',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','faq','efectivo','Se recomienda traer efectivo. Pagos con tarjeta disponibles para reserva principal.',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','menu','link','https://misticaisland.com/services',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','menu','descripcion','Restaurante con cocina caribena, bar en la playa, desayunos incluidos en algunas tarifas',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','contact','whatsapp','+573234392420',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','contact','web','https://misticaisland.com',2),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','contact','horario_atencion','7:00 AM - 10:00 PM',3),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','restrictions','ninos','No se admiten menores de 7 anos',1),
('67fbce21-1b88-449f-93e2-1226cda2a7fb','restrictions','edad_minima','Menores de 18 deben venir acompanados de adulto responsable',2)
ON CONFLICT (property_id, category, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();

-- ============================================================
-- KNOWLEDGE BASE: MISTICA TAYRONA
-- property_id: 148f7836-6fcf-4d06-8570-bd65fcc2ccf0
-- ============================================================
INSERT INTO property_knowledge (property_id, category, key, value, sort_order) VALUES
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','general','nombre','Mistica Tayrona Hostel',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','general','descripcion','Hostel boutique en las inmediaciones del Parque Nacional Natural Tayrona, Santa Marta, Colombia.',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','general','ubicacion','Via al Tayrona, Santa Marta, Magdalena, Colombia.',3),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','general','whatsapp','+573234392420',4),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','rooms','tipos','Dormitorios mixtos, habitaciones privadas, habitaciones con vista a la naturaleza',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','rooms','restriccion_ninos','No se permiten ninos menores de 7 anos',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','policies','check_in','Check-in desde las 3:00 PM',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','policies','check_out','Check-out hasta las 11:00 AM',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','policies','cancelacion','Cancelacion gratuita hasta 7 dias antes. Sin reembolso en cancelaciones tardias.',3),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','policies','mascotas','No se permiten mascotas',4),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','activities','incluidas','Acceso al sendero hacia el Parque Tayrona, zona social, hamacas',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','activities','tours_pagados','Tours al Parque Tayrona, snorkeling, ciudad perdida, senderismo guiado',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','transport','como_llegar','Desde Santa Marta: bus o taxi hacia el Parque Tayrona, aprox. 45 minutos.',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','transport','desde_aeropuerto','Aeropuerto Simon Bolivar (SMR) a 1 hora en taxi.',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','contact','whatsapp','+573234392420',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','contact','horario_atencion','7:00 AM - 10:00 PM',2),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','restrictions','ninos','No se admiten menores de 7 anos',1),
('148f7836-6fcf-4d06-8570-bd65fcc2ccf0','restrictions','parque','El Parque Tayrona tiene restricciones de acceso y cupos diarios propios',2)
ON CONFLICT (property_id, category, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();

-- ============================================================
-- VERIFICACION FINAL
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('property_knowledge','tenant_discounts','landing_config','promo_codes')
ORDER BY table_name;

SELECT COUNT(*) AS total_rows, property_id FROM property_knowledge GROUP BY property_id;
