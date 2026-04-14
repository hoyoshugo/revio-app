---
name: revio-pms
description: |
  Modulo PMS Hotelero de Revio. 35% completo (1907 lineas existentes).
  GanttCalendar.jsx (690L) y GuestDetail.jsx (588L) ya estan avanzados.
  Pendiente: tarifas dinamicas, DIAN, channel manager bidireccional.
  Activar cuando se trabaje en reservas, habitaciones, check-in/out, huespedes.
triggers:
  - PMS
  - reservas
  - habitaciones
  - check-in
  - check-out
  - DIAN
  - Migracion Colombia
  - channel manager
  - tarifas
  - disponibilidad
  - RevPAR
status: avanzado-35pct
priority: P1
---

# Revio PMS — Sistema de Gestion Hotelera

## Estado real (auditado 2026-04-14)
- GanttCalendar.jsx: 690 lineas (ya existe)
- GuestDetail.jsx: 588 lineas (ya existe)
- RoomsManager.jsx: 213 lineas (ya existe)
- backend/src/routes/reservations.js: 180 lineas
- backend/src/routes/rooms.js: 159 lineas
- backend/src/routes/guests.js: 77 lineas
- **TOTAL EXISTENTE: 1907 lineas — 35% completo**

## Estado de módulos completados

✅ Gantt drag-drop + modal detalle + check-in/out/cancel: OPERATIVO

## Pendiente critico

### Semanas 1-2: Motor de tarifas
```javascript
// backend/src/modules/pms/rates.js
// Tarifas por: tipo habitacion, temporada, canal, anticipacion
const RATE_TYPES = ['rack', 'ota', 'direct', 'group', 'promo'];
// Tabla: pms_rates (room_type_id, channel, season, price, min_nights)
```

### Semanas 2-4: DIAN Facturacion Electronica
```
PROCESO:
1. Solicitar habilitacion en muisca.dian.gov.co (4-8 sem espera)
2. Certificado digital para firma (Certicamara/Andes SCD)
3. Implementar XML UBL 2.1
4. Ambiente de pruebas DIAN primero
5. Produccion despues de aprobacion

NOTA CRITICA: Iniciar habilitacion DIAN HOY — 4-8 semanas solo de espera
```

### Semanas 3-5: Channel Manager
```javascript
// Sincronizacion bidireccional con OTAs
// iCal (Airbnb, VRBO): lectura + escritura de disponibilidad
// API Booking.com: Content API + Rates/Availability API
// Webhook: cuando llega reserva OTA -> crear en PMS
```

## Tablas Supabase
```sql
-- Ya existe (migration_010_full_pms.sql):
-- pms_rooms, pms_reservations, pms_guests
-- Pendiente:
CREATE TABLE pms_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid REFERENCES pms_rooms(id),
  channel text, -- rack, booking, airbnb, direct
  season text,
  price_per_night numeric,
  min_nights int DEFAULT 1,
  valid_from date, valid_to date
);
```

## Bloqueantes
1. DIAN habilitacion: proceso burocratico 4-8 semanas (iniciar HOY)
2. Migracion Colombia API: poca documentacion oficial
3. Race conditions en reservas: usar Supabase transactions

## Rutas de API (backend)
```
GET  /api/pms/rooms?property_id=&date_from=&date_to=  -- disponibilidad
POST /api/pms/reservations                             -- crear reserva
PUT  /api/pms/reservations/:id/checkin                 -- check-in digital
PUT  /api/pms/reservations/:id/checkout                -- check-out + factura
GET  /api/pms/rates?room_type_id=&channel=             -- tarifas
POST /api/pms/rates                                    -- actualizar tarifa
```

## Componentes frontend existentes
- GanttCalendar.jsx (690L): ocupacion visual por habitacion/fecha
- GuestDetail.jsx (588L): ficha completa del huesped
- RoomsManager.jsx (213L): configuracion de habitaciones
- BookingsList.jsx: lista de reservas (ya existe)

## Referencia: LobbyPMS, Cloudbeds, Mews
Estos sistemas tardan 2-3 anos en construirse con equipos de 10+ personas.
Con el enjambre de agentes y el codigo existente, estimamos 5 semanas.
