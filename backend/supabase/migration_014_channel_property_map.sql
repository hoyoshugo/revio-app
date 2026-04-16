-- migration_014_channel_property_map.sql
-- Mapeo de canales Meta (page_id, phone_number_id, ig_account_id) a property_id
-- Permite ruteo automático de mensajes entrantes a la propiedad correcta.

-- ═══════════════════════════════════════════════════════
-- 1. Tabla de mapeo: external_id → property_id
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS channel_property_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,                    -- 'whatsapp' | 'facebook' | 'instagram'
  external_id TEXT NOT NULL,                -- page_id, phone_number_id, ig_account_id
  external_name TEXT,                       -- nombre legible: "Mistica Island Hostel", "+573234392420"
  scope TEXT NOT NULL DEFAULT 'independent', -- 'independent' | 'shared'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, external_id)
);

-- Índices para lookup rápido en webhook (path caliente)
CREATE INDEX IF NOT EXISTS idx_channel_property_map_lookup
  ON channel_property_map(channel, external_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_channel_property_map_property
  ON channel_property_map(property_id);

-- ═══════════════════════════════════════════════════════
-- 2. Añadir scope a settings (conexiones compartidas vs independientes)
-- ═══════════════════════════════════════════════════════
ALTER TABLE settings ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'independent';
-- scope = 'shared' → credencial compartida por todas las propiedades del tenant
-- scope = 'independent' → credencial solo para esta propiedad

-- ═══════════════════════════════════════════════════════
-- 3. Seed: mapeos conocidos de Mística (Isla Palma + Tayrona)
-- ═══════════════════════════════════════════════════════

-- Buscar property IDs dinámicamente
DO $$
DECLARE
  isla_id UUID;
  tayrona_id UUID;
BEGIN
  SELECT id INTO isla_id FROM properties WHERE slug = 'isla-palma' LIMIT 1;
  SELECT id INTO tayrona_id FROM properties WHERE slug = 'tayrona' LIMIT 1;

  -- WhatsApp: número compartido → mapear a ambas con scope='shared'
  -- El webhook usará el primer match; el agente IA maneja el ruteo interno
  IF isla_id IS NOT NULL THEN
    INSERT INTO channel_property_map (property_id, channel, external_id, external_name, scope)
    VALUES (isla_id, 'whatsapp', '101206379439613', '+573234392420 (compartido)', 'shared')
    ON CONFLICT (channel, external_id) DO UPDATE SET
      property_id = EXCLUDED.property_id,
      external_name = EXCLUDED.external_name,
      scope = EXCLUDED.scope,
      updated_at = now();
  END IF;

  -- Facebook Pages: independientes por propiedad
  IF isla_id IS NOT NULL THEN
    INSERT INTO channel_property_map (property_id, channel, external_id, external_name, scope)
    VALUES (isla_id, 'facebook', '269851030441228', 'Mistica Island Hostel', 'independent')
    ON CONFLICT (channel, external_id) DO UPDATE SET
      property_id = EXCLUDED.property_id,
      external_name = EXCLUDED.external_name,
      scope = EXCLUDED.scope,
      updated_at = now();
  END IF;

  IF tayrona_id IS NOT NULL THEN
    INSERT INTO channel_property_map (property_id, channel, external_id, external_name, scope)
    VALUES (tayrona_id, 'facebook', '538403142679507', 'M Hostel Tayrona', 'independent')
    ON CONFLICT (channel, external_id) DO UPDATE SET
      property_id = EXCLUDED.property_id,
      external_name = EXCLUDED.external_name,
      scope = EXCLUDED.scope,
      updated_at = now();
  END IF;

  -- Instagram: pendiente conectar cuentas IG Business
  -- Cuando se conecten, agregar aquí con el ig_account_id
END $$;
