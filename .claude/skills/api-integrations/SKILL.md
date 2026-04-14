---
name: api-integrations
description: >
  Activar cuando se trabaja con cualquier integración externa de Revio:
  LobbyPMS, Wompi, WhatsApp, Meta Graph API (Instagram/Facebook),
  Google Places, TripAdvisor, Booking.com, Airbnb. Incluye credenciales,
  endpoints, manejo de errores y patrones de autenticación.
triggers:
  - "lobbypms"
  - "wompi"
  - "whatsapp"
  - "instagram"
  - "facebook"
  - "google places"
  - "tripadvisor"
  - "booking.com"
  - "airbnb"
  - "integración"
version: 1.0.0
project: revio
---

# Revio — Integraciones Externas

## LobbyPMS

### Credenciales
```env
LOBBY_TOKEN_ISLA_PALMA=DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe
LOBBY_TOKEN_TAYRONA=m25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL
LOBBY_API_URL=https://api.lobbypms.com
```

### Endpoints disponibles
```
GET  /api/v2/available-rooms?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
GET  /api/v1/bookings?status=confirmed
GET  /api/v1/rate-plans
POST /api/v1/bookings
```

### Autenticación
```js
headers: { 'Authorization': `Bearer ${token}` }
```

### Problema conocido: IP Whitelist
El servidor de Railway tiene IP `200.189.27.14`.
LobbyPMS requiere whitelist de IPs.
Solución: contactar soporte LobbyPMS o configurar en dashboard.

### Código de ejemplo
```js
// backend/src/integrations/lobbyPMS.js
import { lobbyPMS } from '../integrations/lobbyPMS.js';
const rooms = await lobbyPMS.getAvailableRooms('isla-palma', '2026-05-20', '2026-05-22');
```

---

## Wompi

### Credenciales
```env
# Isla Palma — NIT 901329182 — MISTICA HOSTELS SAS
WOMPI_PUBLIC_KEY_ISLA=pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is
WOMPI_PRIVATE_KEY_ISLA=prv_prod_aXLdFHwIIktnmKNHdjBXVsaDJzEbs2p9
WOMPI_EVENT_SECRET_ISLA=prod_events_cYHxiHGC0thdvPcKoncsLBSKaEWInNwI

# Tayrona — NIT 901818845-7 — INVERSIONES COLOMBIA TRAVEL SAS
WOMPI_PUBLIC_KEY_TAYRONA=pub_prod_Y3GeuGHuQk22aI3x0x6aKcVi8j2haBcA
WOMPI_PRIVATE_KEY_TAYRONA=prv_prod_JgHPuMpLPIgNHmtdpp5BpRYQv3S4EAsP
WOMPI_EVENT_SECRET_TAYRONA=pendiente  ← obtener de Wompi dashboard

WOMPI_API_URL=https://production.wompi.co/v1
```

### Crear link de pago
```js
POST https://production.wompi.co/v1/payment_links
Authorization: Bearer [PRIVATE_KEY]
{
  "name": "Reserva Isla Palma",
  "description": "2 noches dorm - 20-22 mayo",
  "single_use": true,
  "collect_shipping": false,
  "currency": "COP",
  "amount_in_cents": 15000000,  // COP * 100
  "redirect_url": "https://revio-app-production.up.railway.app/booking/success"
}
```

### Verificar firma HMAC del webhook
```js
import crypto from 'crypto';
const signature = req.headers['x-event-checksum'];
const body = req.rawBody;  // necesita express.raw()
const expected = crypto.createHmac('sha256', WOMPI_EVENT_SECRET)
  .update(body).digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
```

### Webhook URL
`https://revio-app-production.up.railway.app/api/payments/webhook`

---

## WhatsApp Business API

### Credenciales
```env
WHATSAPP_TOKEN=EAAcK6VFh7XYB...   # token 60 días, renovar en Graph API Explorer
WHATSAPP_PHONE_ID=101206379439613
WHATSAPP_NUMBER=+573234392420
WHATSAPP_VERIFY_TOKEN=mystica_webhook_2026
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
META_BUSINESS_ID=764980183700550
WABA_ID=109847878558421
```

### Enviar mensaje de texto
```js
POST https://graph.facebook.com/v22.0/101206379439613/messages
Authorization: Bearer [WHATSAPP_TOKEN]
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "573212345678",
  "type": "text",
  "text": { "body": "Hola! Tu reserva está confirmada 🎉" }
}
```

### Verificar webhook
```
GET /api/social/webhook/meta?hub.mode=subscribe&hub.verify_token=mystica_webhook_2026&hub.challenge=xxx
→ Debe responder con el challenge
```

### Estado actual
- Phone status: DISCONNECTED (requiere reconexión en Meta Business Manager)
- URL: https://business.facebook.com/wa/manage/phone-numbers/?waba_id=109847878558421

### Token permanente (System User)
1. Meta Business Manager → Configuración → Usuarios del sistema
2. Crear usuario "revio-bot" con rol Administrador
3. Asignar app Revio + WABA
4. Generar token con permisos: whatsapp_business_messaging, whatsapp_business_management

---

## Meta Graph API (Instagram + Facebook)

### Tokens actuales
```env
# Token usuario (60 días) — WhatsApp + acceso básico
WHATSAPP_TOKEN=EAAcK6VFh7XYB...

# Page tokens (no expiran)
FACEBOOK_PAGE_TOKEN=EAAcK6VFh7XYBRF5NGH...    # Isla Palma: 269851030441228
FACEBOOK_PAGE_TOKEN_TAYRONA=EAAcK6VFh7XYBRL...  # Tayrona: 538403142679507

# Instagram — PENDIENTE conectar
INSTAGRAM_TOKEN=pendiente
INSTAGRAM_ACCOUNT_ID=pendiente
```

### Permisos actuales del token
- pages_show_list ✅
- whatsapp_business_management ✅
- whatsapp_business_messaging ✅
- public_profile ✅
- pages_read_engagement ❌ — necesario para DMs de Facebook/Instagram

### Obtener Instagram Account ID
```bash
curl "https://graph.facebook.com/v22.0/269851030441228?fields=instagram_business_account&access_token=[PAGE_TOKEN]"
```

### Debug token
```bash
curl "https://graph.facebook.com/v22.0/debug_token?input_token=[TOKEN]&access_token=[TOKEN]"
```

---

## Google Business Profile

### Estado
```env
GOOGLE_API_KEY=pendiente    # crear en console.cloud.google.com
GOOGLE_BUSINESS_ACCOUNT_ID=pendiente
GOOGLE_LOCATION_ID_ISLA=pendiente
GOOGLE_LOCATION_ID_TAYRONA=pendiente
```

### Obtener Place IDs
```bash
curl "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Mistica+Hostel+Isla+Palma+Colombia&inputtype=textquery&fields=place_id,name&key=[API_KEY]"
```

---

## TripAdvisor

### Estado
```env
TRIPADVISOR_API_KEY=pendiente    # developer.tripadvisor.com
TRIPADVISOR_LOCATION_ID_ISLA=pendiente
TRIPADVISOR_LOCATION_ID_TAYRONA=pendiente
```

---

## Booking.com

### Estado: PENDIENTE (proceso de aprobación 2-4 semanas)
```env
BOOKING_WEBHOOK_SECRET=pendiente
BOOKING_USERNAME=pendiente
BOOKING_PASSWORD=pendiente
BOOKING_HOTEL_ID_ISLA=pendiente
BOOKING_HOTEL_ID_TAYRONA=pendiente
```

Contacto: connectivity@booking.com

---

## Anthropic (Claude IA)

### Credenciales
```env
ANTHROPIC_API_KEY=sk-ant-api03-aCImmVuG8...
```

### Estado actual: SIN CRÉDITOS
Recargar en: https://console.anthropic.com/settings/billing

### Uso en hotelAgent.js
```js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: systemPrompt + userMessage }]
});
```

---

## Meta API Rate Limiting

- Meta Graph: 200 calls/hora por user token
- Backoff exponencial + jitter para reintentos
- Queue para manejar picos de tráfico

## Webhook Authentication Patterns

### Meta (Instagram/Facebook/WhatsApp)
Validar firma SHA256 usando `META_APP_SECRET`:
```js
const signature = req.headers['x-hub-signature-256']?.replace('sha256=', '');
const expected = crypto.createHmac('sha256', appSecret)
  .update(req.rawBody).digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
```

### Wompi (Pagos)
Validar con `WOMPI_EVENT_SECRET`:
```js
const signature = req.headers['x-event-checksum'];
const expected = crypto.createHmac('sha256', WOMPI_EVENT_SECRET)
  .update(req.rawBody).digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
```

**Patrón general**: Responder 200 inmediatamente, procesar webhook de forma asincrónica

## Conversión de Monedas

- API recomendada: **frankfurter.app** (gratuita, open source, BCE)
- Cache en Supabase tabla `currency_rates` con TTL configurable
- Fallback: usar última tasa cached si la API falla
- Monedas soportadas: COP, USD, EUR, GBP, MXN, BRL, ARS, PEN, CLP, CAD, AUD
