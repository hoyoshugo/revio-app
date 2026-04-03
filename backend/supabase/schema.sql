-- ============================================================
-- MÍSTICA AI AGENT - Esquema completo de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLA: properties (multitenancy - cada hostal/cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,          -- 'isla-palma', 'tayrona'
  name VARCHAR(100) NOT NULL,
  plan VARCHAR(20) DEFAULT 'pro',            -- 'basic', 'pro', 'enterprise'
  is_active BOOLEAN DEFAULT true,

  -- Configuración visual (white-label)
  brand_name VARCHAR(100),
  brand_logo_url TEXT,
  brand_primary_color VARCHAR(7) DEFAULT '#1a1a2e',
  brand_secondary_color VARCHAR(7) DEFAULT '#e94560',

  -- Información del hostal
  location TEXT,
  maps_url TEXT,
  how_to_get_url TEXT,
  booking_url TEXT,
  activities_url TEXT,
  menu_url TEXT,
  faq_url TEXT,
  whatsapp_number VARCHAR(20),
  languages TEXT[] DEFAULT ARRAY['es', 'en'],
  includes TEXT[],
  restrictions TEXT[],

  -- Configuración API (encriptada en prod, aquí como referencia)
  lobby_token_env_key VARCHAR(100),          -- nombre de la env var, no el valor
  wompi_public_key_env_key VARCHAR(100),
  wompi_private_key_env_key VARCHAR(100),

  -- Configuración email
  email_from VARCHAR(200),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: users (admins del dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'staff',          -- 'super_admin', 'admin', 'staff'
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: conversations (cada sesión de chat con un cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,   -- ID de sesión del widget

  -- Datos del cliente (se van llenando durante la conversación)
  guest_name VARCHAR(200),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_language VARCHAR(5) DEFAULT 'es',    -- es, en, fr, de
  guest_nationality VARCHAR(100),

  -- Estado del funnel de ventas
  status VARCHAR(30) DEFAULT 'prospect',
  -- prospect → quoted → reserved → paid → checked_in → checked_out → post_stay

  -- Datos de intención de viaje
  property_interest VARCHAR(50),             -- 'isla-palma', 'tayrona', 'both'
  checkin_date DATE,
  checkout_date DATE,
  adults INTEGER,
  children INTEGER,
  room_type_interest VARCHAR(100),
  budget_range VARCHAR(50),

  -- Seguimiento
  total_messages INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  source VARCHAR(50) DEFAULT 'widget',       -- widget, whatsapp, email
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Contexto para el agente IA (historial en formato Claude)
  conversation_context JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: messages (cada mensaje individual)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,                 -- 'user', 'assistant'
  content TEXT NOT NULL,

  -- Metadatos del agente
  tokens_used INTEGER,
  model_used VARCHAR(50),
  response_time_ms INTEGER,

  -- Herramientas usadas (si el agente consultó LobbyPMS, etc.)
  tools_called JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: bookings (reservas creadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),

  -- ID externo en LobbyPMS
  lobby_booking_id VARCHAR(100),
  lobby_customer_id VARCHAR(100),

  -- Datos de la reserva
  guest_name VARCHAR(200) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_nationality VARCHAR(100),
  guest_document_type VARCHAR(20),
  guest_document_number VARCHAR(50),

  room_type VARCHAR(100),
  room_name VARCHAR(200),
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  nights INTEGER,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,

  -- Tarifas
  rate_plan VARCHAR(100),
  price_per_night DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  taxes DECIMAL(10,2),
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'COP',
  discount_applied DECIMAL(5,2) DEFAULT 0,  -- porcentaje de descuento
  discount_reason TEXT,

  -- Estado
  status VARCHAR(30) DEFAULT 'pending',
  -- pending → confirmed → paid → checked_in → checked_out → cancelled

  -- Fuente de la reserva
  source VARCHAR(50) DEFAULT 'ai_agent',     -- ai_agent, direct, booking, airbnb

  -- Notas
  special_requests TEXT,
  internal_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: payments (pagos Wompi)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  -- Datos Wompi
  wompi_reference VARCHAR(255) UNIQUE NOT NULL,
  wompi_transaction_id VARCHAR(255),
  payment_link_url TEXT,
  payment_link_id VARCHAR(255),

  -- Montos
  amount DECIMAL(10,2) NOT NULL,
  amount_in_cents BIGINT NOT NULL,
  currency VARCHAR(3) DEFAULT 'COP',

  -- Estado
  status VARCHAR(30) DEFAULT 'pending',
  -- pending → approved → declined → voided → error

  -- Respuesta completa del webhook
  webhook_data JSONB,

  -- Timestamps
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: communications (registro de todas las comunicaciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  type VARCHAR(20) NOT NULL,                 -- whatsapp, email, sms
  direction VARCHAR(10) DEFAULT 'outbound',  -- outbound, inbound

  -- Secuencia automática
  sequence_step VARCHAR(50),
  -- confirmation, reminder_7d, reminder_3d, reminder_1d,
  -- welcome_day, review_request, loyalty_offer

  -- Contenido
  recipient_phone VARCHAR(50),
  recipient_email VARCHAR(255),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Estado de envío
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → sent → delivered → read → failed

  -- Respuesta del proveedor
  provider_message_id VARCHAR(255),
  provider_response JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: api_logs (trazabilidad de llamadas a APIs externas)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  conversation_id UUID REFERENCES conversations(id),

  service VARCHAR(50) NOT NULL,              -- lobbypms, wompi, whatsapp, anthropic
  method VARCHAR(10),                        -- GET, POST, PUT, DELETE
  endpoint VARCHAR(500),
  request_data JSONB,
  response_data JSONB,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  success BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: occupancy_cache (caché de ocupación para decisiones)
-- ============================================================
CREATE TABLE IF NOT EXISTS occupancy_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  date DATE NOT NULL,
  occupancy_percentage DECIMAL(5,2),
  available_rooms INTEGER,
  total_rooms INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(property_id, date)
);

-- ============================================================
-- DATOS INICIALES: propiedades de Mística
-- ============================================================
INSERT INTO properties (
  slug, name, plan, brand_name, brand_primary_color, brand_secondary_color,
  location, maps_url, how_to_get_url, booking_url, activities_url, menu_url, faq_url,
  whatsapp_number, languages, includes, restrictions,
  lobby_token_env_key, wompi_public_key_env_key, wompi_private_key_env_key
) VALUES (
  'isla-palma',
  'Mística Isla Palma',
  'pro',
  'Mística Island',
  '#1a1a2e',
  '#00b4d8',
  'Isla Palma, Archipiélago San Bernardo, Cartagena, Colombia',
  'https://maps.app.goo.gl/fFhJpQWSHnhgRHxp6',
  'https://www.misticaisland.com/how-to-get',
  'https://booking.misticaisland.com',
  'https://www.misticaisland.com/activities',
  'https://www.misticaisland.com/services',
  'https://www.misticaisland.com/faq',
  '+573234392420',
  ARRAY['es', 'en', 'fr', 'de'],
  ARRAY['Desayuno incluido', 'WiFi gratuito'],
  ARRAY['Niños menores de 7 años solo permitidos en Cabaña del Árbol o Las Aldea'],
  'LOBBY_TOKEN_ISLA_PALMA',
  'WOMPI_PUBLIC_KEY_ISLA',
  'WOMPI_PRIVATE_KEY_ISLA'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO properties (
  slug, name, plan, brand_name, brand_primary_color, brand_secondary_color,
  location, maps_url, how_to_get_url, booking_url, activities_url, menu_url, faq_url,
  whatsapp_number, languages, includes, restrictions,
  lobby_token_env_key, wompi_public_key_env_key, wompi_private_key_env_key
) VALUES (
  'tayrona',
  'Mística Tayrona',
  'pro',
  'Mística Tayrona',
  '#1a1a2e',
  '#2d9e6b',
  'Bahía Cinto, Parque Nacional Natural Tayrona, Colombia',
  'https://maps.app.goo.gl/9Prr7GFDqfFRYgyQA',
  'https://www.mhostels.co/how-to-get',
  'https://booking.misticatayrona.com',
  'https://www.mhostels.co/activities',
  'https://www.mhostels.co/services',
  'https://www.mhostels.co/faq',
  '+573234392420',
  ARRAY['es', 'en', 'fr', 'de'],
  ARRAY['Desayuno incluido', 'WiFi gratuito'],
  ARRAY[]::TEXT[],
  'LOBBY_TOKEN_TAYRONA',
  'WOMPI_PUBLIC_KEY_TAYRONA',
  'WOMPI_PRIVATE_KEY_TAYRONA'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_checkin ON bookings(checkin_date);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(wompi_reference);
CREATE INDEX IF NOT EXISTS idx_communications_booking ON communications(booking_id);
CREATE INDEX IF NOT EXISTS idx_communications_scheduled ON communications(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_api_logs_service ON api_logs(service, created_at DESC);

-- ============================================================
-- FUNCIONES para actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VISTA: dashboard metrics por propiedad
-- ============================================================
CREATE OR REPLACE VIEW v_dashboard_metrics AS
SELECT
  p.id AS property_id,
  p.slug,
  p.name,

  -- Conversaciones hoy
  COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE) AS conversations_today,

  -- Por estado
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'prospect') AS prospects,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'quoted') AS quoted,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'reserved') AS reserved,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'paid') AS paid,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'checked_in') AS checked_in,

  -- Reservas hoy
  COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= CURRENT_DATE) AS bookings_today,

  -- Ingresos hoy
  COALESCE(SUM(b.total_amount) FILTER (WHERE b.created_at >= CURRENT_DATE AND b.status NOT IN ('cancelled')), 0) AS revenue_today,

  -- Check-ins y check-outs hoy
  COUNT(DISTINCT b.id) FILTER (WHERE b.checkin_date = CURRENT_DATE) AS checkins_today,
  COUNT(DISTINCT b.id) FILTER (WHERE b.checkout_date = CURRENT_DATE) AS checkouts_today,

  -- Pagos pendientes
  COUNT(DISTINCT pay.id) FILTER (WHERE pay.status = 'pending') AS pending_payments,
  COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'pending'), 0) AS pending_payments_amount

FROM properties p
LEFT JOIN conversations c ON c.property_id = p.id
LEFT JOIN bookings b ON b.property_id = p.id
LEFT JOIN payments pay ON pay.property_id = p.id
GROUP BY p.id, p.slug, p.name;
