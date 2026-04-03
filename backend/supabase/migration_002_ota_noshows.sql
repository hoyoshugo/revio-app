-- ============================================================
-- MIGRACIÓN 002: OTAs, No-shows y Cancelaciones
-- Ejecutar en Supabase SQL Editor DESPUÉS del schema.sql inicial
-- ============================================================

-- ============================================================
-- TABLA: ota_messages
-- Mensajes entrantes de Booking.com, Airbnb, Hostelworld
-- ============================================================
CREATE TABLE IF NOT EXISTS ota_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Origen
  platform VARCHAR(30) NOT NULL,         -- 'booking', 'airbnb', 'hostelworld'
  platform_message_id VARCHAR(255),       -- ID del mensaje en la plataforma
  platform_reservation_id VARCHAR(255),   -- ID de la reserva en la plataforma

  -- Participantes
  guest_name VARCHAR(200),
  guest_id_on_platform VARCHAR(255),

  -- Contenido
  direction VARCHAR(10) NOT NULL DEFAULT 'inbound',  -- inbound | outbound
  body TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'es',
  attachments JSONB DEFAULT '[]',

  -- Estado de procesamiento
  status VARCHAR(20) DEFAULT 'unread',   -- unread | read | replied | failed
  ai_reply_sent BOOLEAN DEFAULT false,
  ai_reply_body TEXT,
  ai_reply_at TIMESTAMPTZ,
  reply_error TEXT,

  -- Vinculación con reserva interna
  booking_id UUID REFERENCES bookings(id),
  conversation_id UUID REFERENCES conversations(id),

  -- Datos crudos del webhook
  raw_payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: ota_reservations
-- Reservas que llegan vía OTAs (sincronizadas desde las plataformas)
-- ============================================================
CREATE TABLE IF NOT EXISTS ota_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),   -- vinculada con la reserva interna

  platform VARCHAR(30) NOT NULL,
  platform_reservation_id VARCHAR(255) NOT NULL,
  platform_status VARCHAR(50),              -- confirmed, cancelled, modified, no_show

  -- Datos del huésped (como los envía la OTA)
  guest_name VARCHAR(200),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_language VARCHAR(5),
  guest_country VARCHAR(100),

  -- Fechas
  checkin_date DATE,
  checkout_date DATE,
  adults INTEGER,
  children INTEGER DEFAULT 0,

  -- Financiero
  total_amount DECIMAL(10,2),
  commission_amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'COP',
  payment_status VARCHAR(30),

  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, platform_reservation_id)
);

-- ============================================================
-- TABLA: no_show_logs
-- Registro de no-shows detectados y acciones tomadas
-- ============================================================
CREATE TABLE IF NOT EXISTS no_show_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  -- Estado del proceso
  status VARCHAR(30) DEFAULT 'detected',
  -- detected → alerted_guest → alerted_team → marked_noshow → resolved

  -- Contacto previo al check-in
  pre_checkin_alert_sent_at TIMESTAMPTZ,
  pre_checkin_channel VARCHAR(20),         -- whatsapp | email
  pre_checkin_message_id VARCHAR(255),
  guest_responded BOOLEAN DEFAULT false,
  guest_response_at TIMESTAMPTZ,

  -- Notificación al equipo
  team_notified_at TIMESTAMPTZ,
  team_notified_via VARCHAR(20),

  -- Acción en LobbyPMS
  lobby_cancellation_id VARCHAR(100),
  lobby_cancelled_at TIMESTAMPTZ,
  lobby_cancel_error TEXT,

  -- Penalidad / Cobro
  penalty_applied BOOLEAN DEFAULT false,
  penalty_amount DECIMAL(10,2),
  penalty_wompi_reference VARCHAR(255),

  notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cancellation_logs
-- Registro detallado de cada cancelación
-- ============================================================
CREATE TABLE IF NOT EXISTS cancellation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),

  -- Quién canceló
  cancelled_by VARCHAR(30) NOT NULL,       -- guest | staff | system | ota | no_show
  cancellation_reason TEXT,
  cancellation_date TIMESTAMPTZ DEFAULT NOW(),

  -- Política aplicada
  policy_name VARCHAR(100),
  days_before_checkin INTEGER,             -- cuántos días antes se canceló
  penalty_percentage DECIMAL(5,2) DEFAULT 0,
  penalty_amount DECIMAL(10,2) DEFAULT 0,

  -- Reembolso
  refund_eligible BOOLEAN DEFAULT false,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_status VARCHAR(30) DEFAULT 'pending',
  -- pending | processing | refunded | failed | waived
  wompi_refund_reference VARCHAR(255),
  wompi_refund_data JSONB,
  refund_processed_at TIMESTAMPTZ,
  refund_error TEXT,

  -- Notificaciones enviadas
  guest_notified_at TIMESTAMPTZ,
  guest_notified_via VARCHAR(20),
  team_notified_at TIMESTAMPTZ,

  -- Cancelación en LobbyPMS
  lobby_cancel_response JSONB,
  lobby_cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ota_messages_platform ON ota_messages(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ota_messages_property ON ota_messages(property_id, status);
CREATE INDEX IF NOT EXISTS idx_ota_messages_reservation ON ota_messages(platform_reservation_id);
CREATE INDEX IF NOT EXISTS idx_ota_reservations_platform ON ota_reservations(platform, platform_reservation_id);
CREATE INDEX IF NOT EXISTS idx_no_show_logs_booking ON no_show_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_no_show_logs_status ON no_show_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cancellation_logs_booking ON cancellation_logs(booking_id);

-- ============================================================
-- TRIGGERS para updated_at
-- ============================================================
CREATE TRIGGER update_ota_reservations_updated_at BEFORE UPDATE ON ota_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_no_show_logs_updated_at BEFORE UPDATE ON no_show_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
