-- seed_demo_data.sql
-- Datos demo para Revio: Mística Hostels
-- IMPORTANTE: Ejecutar DESPUÉS de migration_010_full_pms.sql
-- Asume que ya existen las propiedades 'isla-palma' y 'tayrona' en la tabla properties

-- ============================================================
-- Variables: obtener IDs de propiedades existentes
-- ============================================================
DO $$
DECLARE
  prop_isla  UUID;
  prop_tayro UUID;
  prop_sb    UUID;   -- propiedad extra: San Bernardo

  -- Room type IDs
  rt_dorm_isla   UUID;
  rt_priv_isla   UUID;
  rt_cabin_tayro UUID;
  rt_dorm_tayro  UUID;

  -- Revenue center IDs
  rc_bar_isla   UUID;
  rc_food_isla  UUID;
  rc_tours_isla UUID;

  -- User IDs
  user_admin UUID;
  user_recep UUID;
  user_hk    UUID;

  -- Guest IDs (array)
  g_ids UUID[];
  i INT;

BEGIN

-- ── Obtener propiedades ──
SELECT id INTO prop_isla  FROM properties WHERE slug = 'isla-palma'  LIMIT 1;
SELECT id INTO prop_tayro FROM properties WHERE slug = 'tayrona'     LIMIT 1;

IF prop_isla IS NULL THEN
  RAISE NOTICE 'Propiedad isla-palma no encontrada. Verifica que exista en la tabla properties.';
  RETURN;
END IF;

-- ── Usuarios demo ──
INSERT INTO users (id, property_id, email, password_hash, name, role, is_active)
VALUES
  (gen_random_uuid(), prop_isla, 'recepcion@mistica.co', 'Mistica2026!', 'Ana Torres', 'staff', true),
  (gen_random_uuid(), prop_isla, 'hk@mistica.co',        'Mistica2026!', 'Carlos Díaz', 'staff', true)
ON CONFLICT (email) DO NOTHING;

SELECT id INTO user_recep FROM users WHERE email = 'recepcion@mistica.co' LIMIT 1;
SELECT id INTO user_hk    FROM users WHERE email = 'hk@mistica.co'        LIMIT 1;

-- ── Tipos de habitación: Isla Palma ──
INSERT INTO room_types (id, property_id, name, slug, description, capacity, beds, base_price, amenities)
VALUES
  (gen_random_uuid(), prop_isla, 'Dormitorio Mixto 8', 'dorm-8',
   'Dormitorio compartido con 8 camas tipo litera. Ideal para viajeros solos.',
   8, '[{"type":"bunk","count":4}]'::jsonb, 65000,
   ARRAY['Lockers', 'Ventilador', 'Baño compartido', 'Wi-Fi']),
  (gen_random_uuid(), prop_isla, 'Dormitorio Mixto 6', 'dorm-6',
   'Dormitorio compartido con 6 camas tipo litera. Más íntimo.',
   6, '[{"type":"bunk","count":3}]'::jsonb, 75000,
   ARRAY['Lockers', 'AC', 'Baño compartido', 'Wi-Fi']),
  (gen_random_uuid(), prop_isla, 'Privado Doble', 'privado-doble',
   'Habitación privada con cama doble. Baño privado incluido.',
   2, '[{"type":"double","count":1}]'::jsonb, 180000,
   ARRAY['Baño privado', 'AC', 'TV', 'Wi-Fi', 'Vista al mar']),
  (gen_random_uuid(), prop_isla, 'Privado Twin', 'privado-twin',
   'Habitación privada con dos camas individuales. Ideal para parejas o amigos.',
   2, '[{"type":"twin","count":2}]'::jsonb, 170000,
   ARRAY['Baño privado', 'AC', 'Wi-Fi'])
ON CONFLICT (property_id, slug) DO NOTHING;

SELECT id INTO rt_dorm_isla FROM room_types WHERE property_id = prop_isla AND slug = 'dorm-8'         LIMIT 1;
SELECT id INTO rt_priv_isla FROM room_types WHERE property_id = prop_isla AND slug = 'privado-doble'  LIMIT 1;

-- ── Tipos de habitación: Tayrona ──
IF prop_tayro IS NOT NULL THEN
  INSERT INTO room_types (id, property_id, name, slug, description, capacity, beds, base_price, amenities)
  VALUES
    (gen_random_uuid(), prop_tayro, 'Cabaña Ecológica', 'cabana-eco',
     'Cabaña con materiales naturales, hamaca y vista a la selva.',
     2, '[{"type":"double","count":1}]'::jsonb, 280000,
     ARRAY['Hamaca', 'Ventilador', 'Baño privado', 'Desayuno incluido']),
    (gen_random_uuid(), prop_tayro, 'Dormitorio Mixto Tayrona', 'dorm-tayro',
     'Dormitorio compartido en la naturaleza. 6 plazas.',
     6, '[{"type":"bunk","count":3}]'::jsonb, 95000,
     ARRAY['Lockers', 'Baño compartido', 'Desayuno incluido'])
  ON CONFLICT (property_id, slug) DO NOTHING;

  SELECT id INTO rt_cabin_tayro FROM room_types WHERE property_id = prop_tayro AND slug = 'cabana-eco'   LIMIT 1;
  SELECT id INTO rt_dorm_tayro  FROM room_types WHERE property_id = prop_tayro AND slug = 'dorm-tayro'   LIMIT 1;
END IF;

-- ── Habitaciones: Isla Palma (12 habitaciones) ──
INSERT INTO rooms (property_id, room_type_id, number, name, floor, capacity) VALUES
  (prop_isla, rt_dorm_isla, '101', 'Dorm A',  1, 8),
  (prop_isla, rt_dorm_isla, '102', 'Dorm B',  1, 8),
  (prop_isla, rt_dorm_isla, '103', 'Dorm C',  1, 6),
  (prop_isla, rt_priv_isla, '201', 'Suite Mar', 2, 2),
  (prop_isla, rt_priv_isla, '202', 'Vista Coral', 2, 2),
  (prop_isla, rt_priv_isla, '203', 'Brisa Marina', 2, 2),
  (prop_isla, rt_priv_isla, '204', 'Atardecer', 2, 2),
  (prop_isla, rt_dorm_isla, '105', 'Dorm E', 1, 8),
  (prop_isla, rt_dorm_isla, '106', 'Dorm F', 1, 6)
ON CONFLICT (property_id, number) DO NOTHING;

-- ── Habitaciones: Tayrona (8 cabañas) ──
IF prop_tayro IS NOT NULL AND rt_cabin_tayro IS NOT NULL THEN
  INSERT INTO rooms (property_id, room_type_id, number, name, floor, capacity) VALUES
    (prop_tayro, rt_cabin_tayro, 'C-01', 'Cabaña Jaguar',   1, 2),
    (prop_tayro, rt_cabin_tayro, 'C-02', 'Cabaña Mico',     1, 2),
    (prop_tayro, rt_cabin_tayro, 'C-03', 'Cabaña Colibri',  1, 2),
    (prop_tayro, rt_cabin_tayro, 'C-04', 'Cabaña Tucán',    1, 2),
    (prop_tayro, rt_dorm_tayro,  'D-01', 'Dorm Selva',      1, 6),
    (prop_tayro, rt_dorm_tayro,  'D-02', 'Dorm Playa',      1, 6)
  ON CONFLICT (property_id, number) DO NOTHING;
END IF;

-- ── Huéspedes demo (15 huéspedes) ──
INSERT INTO guests (id, property_id, first_name, last_name, email, phone, nationality, document_type, document_number, language, tags)
VALUES
  (gen_random_uuid(), prop_isla, 'Santiago', 'Ramírez',    'santi.ramirez@gmail.com', '+573001234567', 'Colombia',   'CC', '1090234567', 'es', ARRAY['frecuente']),
  (gen_random_uuid(), prop_isla, 'Valentina','Gómez',      'vale.gomez@hotmail.com',  '+573052345678', 'Colombia',   'CC', '1093456789', 'es', ARRAY['vip']),
  (gen_random_uuid(), prop_isla, 'Andrés',   'Morales',    'andres.m@gmail.com',      '+573143456789', 'Colombia',   'CC', '1020345678', 'es', ARRAY[]),
  (gen_random_uuid(), prop_isla, 'Laura',    'Castellanos','lau.cas@yahoo.com',        '+573204567890', 'Colombia',   'CC', '1001234567', 'es', ARRAY['frecuente']),
  (gen_random_uuid(), prop_isla, 'Mateo',    'Herrera',    'mateo.h@gmail.com',        '+573305678901', 'Colombia',   'CC', '1056789012', 'es', ARRAY[]),
  (gen_random_uuid(), prop_isla, 'Sophie',   'Martin',     'sophie.m@gmail.com',       '+33612345678',  'Francia',    'PP', 'FR123456',   'fr', ARRAY['mochilero']),
  (gen_random_uuid(), prop_isla, 'Jake',     'Williams',   'jake.w@outlook.com',       '+17025678901',  'USA',        'PP', 'US234567',   'en', ARRAY['mochilero']),
  (gen_random_uuid(), prop_isla, 'Ana',      'Silva',      'ana.silva@gmail.com',      '+5511987654321','Brasil',     'PP', 'BR345678',   'pt', ARRAY[]),
  (gen_random_uuid(), prop_isla, 'Carlos',   'Mendoza',    'carlos.m@gmail.com',       '+573406789012', 'Colombia',   'CC', '1067890123', 'es', ARRAY['vip']),
  (gen_random_uuid(), prop_isla, 'Isabella', 'Torres',     'isa.t@gmail.com',          '+573007890123', 'Colombia',   'CC', '1078901234', 'es', ARRAY[]),
  (gen_random_uuid(), prop_isla, 'Lucas',    'Fernández',  'lucas.f@gmail.com',        '+5491123456789','Argentina',  'PP', 'AR456789',   'es', ARRAY['mochilero']),
  (gen_random_uuid(), prop_isla, 'Emma',     'Dupont',     'emma.d@gmail.com',         '+32498765432',  'Bélgica',    'PP', 'BE567890',   'fr', ARRAY[]),
  (gen_random_uuid(), prop_isla, 'Diego',    'Vargas',     'diego.v@yahoo.com',        '+573508901234', 'Colombia',   'CC', '1089012345', 'es', ARRAY['frecuente']),
  (gen_random_uuid(), prop_isla, 'Camila',   'Ríos',       'cami.rios@gmail.com',      '+573109012345', 'Colombia',   'CC', '1000123456', 'es', ARRAY['vip']),
  (gen_random_uuid(), prop_isla, 'Oliver',   'Brown',      'oliver.b@gmail.com',       '+442012345678', 'UK',         'PP', 'UK678901',   'en', ARRAY['mochilero'])
ON CONFLICT DO NOTHING;

-- ── Revenue Centers: Isla Palma ──
INSERT INTO revenue_centers (id, property_id, name, type, is_active, sort_order)
VALUES
  (gen_random_uuid(), prop_isla, 'Bar La Ola',     'bar',        true, 1),
  (gen_random_uuid(), prop_isla, 'Restaurante',    'restaurant', true, 2),
  (gen_random_uuid(), prop_isla, 'Tours y Actividades', 'tours', true, 3)
ON CONFLICT DO NOTHING;

SELECT id INTO rc_bar_isla   FROM revenue_centers WHERE property_id = prop_isla AND type = 'bar'        LIMIT 1;
SELECT id INTO rc_food_isla  FROM revenue_centers WHERE property_id = prop_isla AND type = 'restaurant' LIMIT 1;
SELECT id INTO rc_tours_isla FROM revenue_centers WHERE property_id = prop_isla AND type = 'tours'      LIMIT 1;

-- ── Productos: Bar ──
IF rc_bar_isla IS NOT NULL THEN
  INSERT INTO products (property_id, revenue_center_id, name, category, price, is_available, sort_order)
  VALUES
    (prop_isla, rc_bar_isla, 'Cerveza Águila',     'bebida', 8000,  true, 1),
    (prop_isla, rc_bar_isla, 'Cerveza Artesanal',  'bebida', 14000, true, 2),
    (prop_isla, rc_bar_isla, 'Cóctel Caribe',      'cóctel', 22000, true, 3),
    (prop_isla, rc_bar_isla, 'Mojito',             'cóctel', 20000, true, 4),
    (prop_isla, rc_bar_isla, 'Agua Mineral',       'bebida', 4000,  true, 5),
    (prop_isla, rc_bar_isla, 'Gaseosa',            'bebida', 5000,  true, 6),
    (prop_isla, rc_bar_isla, 'Jugo Natural',       'bebida', 9000,  true, 7),
    (prop_isla, rc_bar_isla, 'Ron Viejo de Caldas','shot',   12000, true, 8),
    (prop_isla, rc_bar_isla, 'Gin Tonic',          'cóctel', 25000, true, 9),
    (prop_isla, rc_bar_isla, 'Sangría Jarra',      'cóctel', 45000, true, 10)
  ON CONFLICT DO NOTHING;
END IF;

-- ── Productos: Restaurante ──
IF rc_food_isla IS NOT NULL THEN
  INSERT INTO products (property_id, revenue_center_id, name, category, price, is_available, sort_order)
  VALUES
    (prop_isla, rc_food_isla, 'Desayuno Completo',     'desayuno', 18000, true, 1),
    (prop_isla, rc_food_isla, 'Tostadas con Aguacate', 'desayuno', 14000, true, 2),
    (prop_isla, rc_food_isla, 'Bandeja Paisa Mini',    'almuerzo', 28000, true, 3),
    (prop_isla, rc_food_isla, 'Ensalada Tropical',     'almuerzo', 20000, true, 4),
    (prop_isla, rc_food_isla, 'Burger Mística',        'almuerzo', 32000, true, 5),
    (prop_isla, rc_food_isla, 'Ceviche de Camarón',    'cena',     38000, true, 6),
    (prop_isla, rc_food_isla, 'Pargo Frito',           'cena',     45000, true, 7),
    (prop_isla, rc_food_isla, 'Pizza Artesanal',       'cena',     35000, true, 8),
    (prop_isla, rc_food_isla, 'Nachos con Guacamole',  'snack',    22000, true, 9),
    (prop_isla, rc_food_isla, 'Bowl de Açaí',          'snack',    18000, true, 10)
  ON CONFLICT DO NOTHING;
END IF;

-- ── Productos: Tours ──
IF rc_tours_isla IS NOT NULL THEN
  INSERT INTO products (property_id, revenue_center_id, name, category, price, is_available, sort_order)
  VALUES
    (prop_isla, rc_tours_isla, 'Snorkel 2h',           'acuático', 85000,  true, 1),
    (prop_isla, rc_tours_isla, 'Kayak 1h',             'acuático', 45000,  true, 2),
    (prop_isla, rc_tours_isla, 'Tour Isla Barú',       'terrestre',150000, true, 3),
    (prop_isla, rc_tours_isla, 'Clase de Surf',        'acuático', 120000, true, 4),
    (prop_isla, rc_tours_isla, 'Paseo en Velero',      'acuático', 200000, true, 5),
    (prop_isla, rc_tours_isla, 'Tour Nocturno',        'terrestre',80000,  true, 6),
    (prop_isla, rc_tours_isla, 'Buceo Bautismo',       'acuático', 350000, true, 7),
    (prop_isla, rc_tours_isla, 'Paddleboard 1h',       'acuático', 55000,  true, 8),
    (prop_isla, rc_tours_isla, 'Tour Manglares',       'terrestre',95000,  true, 9),
    (prop_isla, rc_tours_isla, 'Pesca Deportiva',      'acuático', 280000, true, 10)
  ON CONFLICT DO NOTHING;
END IF;

-- ── Eventos próximos ──
INSERT INTO events (property_id, name, description, start_date, end_date, type, impact)
VALUES
  (prop_isla, 'Semana Santa',
   'Alta temporada. Incrementar tarifas 40%. Reservas al máximo.',
   CURRENT_DATE + 5, CURRENT_DATE + 12, 'national', 'high'),
  (prop_isla, 'Festival de Música Barranquilla',
   'Evento regional que aumenta demanda de hospedaje en la costa.',
   CURRENT_DATE + 20, CURRENT_DATE + 23, 'local', 'medium'),
  (prop_isla, 'Temporada Baja',
   'Baja temporada. Considerar descuentos para aumentar ocupación.',
   CURRENT_DATE + 45, CURRENT_DATE + 75, 'property', 'low'),
  (NULL, 'Festivo 1 de Mayo',
   'Día del Trabajo. Puente festivo nacional.',
   CURRENT_DATE + 27, CURRENT_DATE + 28, 'national', 'medium')
ON CONFLICT DO NOTHING;

-- ── Reservas demo (30 reservas en los próximos 60 días) ──
-- Se crean con los primeros rooms y guests disponibles
DO $inner$
DECLARE
  room_ids UUID[];
  guest_ids UUID[];
  r_room UUID;
  r_guest UUID;
  r_checkin DATE;
  r_checkout DATE;
  r_nights INT;
  r_price DECIMAL;
  src TEXT;
  stat TEXT;
  colors TEXT[] := ARRAY['#6366F1','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  j INT;
BEGIN
  SELECT ARRAY(SELECT id FROM rooms WHERE property_id = (SELECT id FROM properties WHERE slug = 'isla-palma' LIMIT 1) LIMIT 9) INTO room_ids;
  SELECT ARRAY(SELECT id FROM guests WHERE property_id = (SELECT id FROM properties WHERE slug = 'isla-palma' LIMIT 1) LIMIT 15) INTO guest_ids;

  FOR j IN 1..30 LOOP
    r_room  := room_ids[1 + (j % array_length(room_ids, 1))];
    r_guest := guest_ids[1 + (j % array_length(guest_ids, 1))];
    r_nights := 1 + (j % 6);
    r_checkin  := CURRENT_DATE + (j * 2) - 5;
    r_checkout := r_checkin + r_nights;
    r_price := 65000 + (j * 5000);
    src  := CASE (j % 4) WHEN 0 THEN 'direct' WHEN 1 THEN 'booking.com' WHEN 2 THEN 'airbnb' ELSE 'whatsapp' END;
    stat := CASE
      WHEN r_checkin < CURRENT_DATE THEN 'checked_out'
      WHEN r_checkin = CURRENT_DATE THEN 'checked_in'
      ELSE 'confirmed'
    END;

    BEGIN
      INSERT INTO reservations (
        property_id, room_id, guest_id, check_in, check_out,
        adults, rate_per_night, total_amount, currency, status, source,
        color
      ) VALUES (
        (SELECT id FROM properties WHERE slug = 'isla-palma' LIMIT 1),
        r_room, r_guest, r_checkin, r_checkout,
        1 + (j % 3), r_price, r_price * r_nights, 'COP', stat, src,
        colors[1 + (j % array_length(colors, 1))]
      );
    EXCEPTION WHEN unique_violation THEN
      -- Skip conflicts
      NULL;
    END;
  END LOOP;
END;
$inner$ LANGUAGE plpgsql;

-- ── Billeteras de brazalete (10 activas) ──
INSERT INTO wristband_wallets (property_id, guest_name, wristband_code, qr_data, balance, is_active, activated_at)
SELECT
  p.id,
  g.first_name || ' ' || COALESCE(g.last_name, ''),
  'RV-' || UPPER(SUBSTRING(MD5(g.id::TEXT), 1, 6)),
  '{"type":"revio_wallet","code":"RV-' || UPPER(SUBSTRING(MD5(g.id::TEXT), 1, 6)) || '"}',
  (RANDOM() * 300000 + 50000)::DECIMAL(12,2),
  TRUE,
  NOW()
FROM guests g
JOIN properties p ON g.property_id = p.id
WHERE p.slug = 'isla-palma'
LIMIT 10
ON CONFLICT (wristband_code) DO NOTHING;

-- ── Housekeeping tasks (10 tareas de hoy) ──
INSERT INTO housekeeping_tasks (property_id, room_id, type, status, priority, scheduled_for, notes)
SELECT
  r.property_id,
  r.id,
  CASE (ROW_NUMBER() OVER () % 4)::INT
    WHEN 0 THEN 'checkout_clean'
    WHEN 1 THEN 'daily_clean'
    WHEN 2 THEN 'deep_clean'
    ELSE 'inspection'
  END,
  CASE (ROW_NUMBER() OVER () % 3)::INT
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'in_progress'
    ELSE 'done'
  END,
  CASE (ROW_NUMBER() OVER () % 3)::INT
    WHEN 0 THEN 'high'
    WHEN 1 THEN 'normal'
    ELSE 'low'
  END,
  CURRENT_DATE,
  'Tarea generada automáticamente por seed'
FROM rooms r
JOIN properties p ON r.property_id = p.id
WHERE p.slug = 'isla-palma'
LIMIT 10;

RAISE NOTICE '✅ Seed completado: habitaciones, tipos, huéspedes, revenue centers, productos, reservas, billeteras, housekeeping tasks';

END;
$$ LANGUAGE plpgsql;
