---
name: api-integration
description: Patrones de integración con APIs externas. Actívate para Meta (Instagram/Facebook/WhatsApp), Google Business, TripAdvisor, Booking, Airbnb, Expedia, Hostelworld, y cualquier OTA/PMS.
triggers:
  - API
  - integración
  - Meta
  - Instagram
  - Facebook
  - webhook
  - OTA
  - PMS
version: 2.0.0
---

# API Integration Patterns

## Meta Business API unificada (IG + FB + WA)

### Estructura cuenta Mística
- Meta Business ID: `META_BUSINESS_ID`
- WhatsApp Phone ID: `WHATSAPP_PHONE_ID` (compartido +57 323 4392420)
- Facebook Pages: `FACEBOOK_PAGE_ID_ISLA` + `FACEBOOK_PAGE_ID_TAYRONA`
- Instagram: @misticaisland + @misticatayrona (vinculadas a las páginas FB)
- Token: `FACEBOOK_PAGE_TOKEN` sirve para WhatsApp + ambas FB pages + ambas IG
- Verify token webhook: `META_VERIFY_TOKEN` o `META_WEBHOOK_VERIFY_TOKEN`

### Webhook unificado
Todos los eventos caen en `POST /api/webhooks/meta`. Identificar fuente por:
- `messaging_product === 'whatsapp'` → WhatsApp
- `body.object === 'instagram'` → Instagram (DM o comment)
- `body.object === 'page'` → Facebook Page (mensaje o comment)
- `change.field === 'comments'` → comentario en post

### Enviar mensaje por canal
```js
// WhatsApp
POST graph.facebook.com/v22.0/{PHONE_ID}/messages
body: { messaging_product:'whatsapp', to: E164, type:'text', text:{body} }

// Instagram / Facebook DM
POST graph.facebook.com/v22.0/me/messages
body: { recipient:{id}, message:{text}, messaging_type:'RESPONSE' }

// Responder comentario IG
POST graph.facebook.com/v22.0/{commentId}/replies
body: { message }

// Responder comentario FB
POST graph.facebook.com/v22.0/{commentId}/comments
body: { message }
```

## Conversión de monedas

- Default: **frankfurter.app** (gratuita, open source, BCE)
- Cache Supabase `currency_rates` con TTL configurable
- Fallback: stale cache si la API falla
- Multi-moneda: COP, USD, EUR, GBP, MXN, BRL, ARS, PEN, CLP, CAD, AUD

## Webhooks auth
- Meta: validar `x-hub-signature-256` con `META_APP_SECRET`
- Wompi: validar con `WOMPI_EVENT_SECRET`
- Regla: responder 200 inmediato, procesar async

## Rate limiting
- Meta Graph: 200 calls/hora por user token
- Backoff exponencial + jitter
- Queue para picos
