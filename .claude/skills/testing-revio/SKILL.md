---
name: testing-revio
description: >
  Activar cuando se necesita probar o verificar el funcionamiento de
  Revio en producción o desarrollo: comandos curl para cada endpoint,
  checklist de verificación, datos de prueba reales, o cuando se
  quiere ejecutar el suite completo de tests de integración.
triggers:
  - "probar"
  - "test"
  - "verificar"
  - "curl"
  - "health check"
  - "integración funciona"
version: 1.0.0
project: revio
---

# Revio — Tests y Verificación

## URLs base

```
Producción: https://revio-app-production.up.railway.app
Desarrollo:  http://localhost:3001
```

## Tests rápidos (curl)

### 1. Health check
```bash
curl https://revio-app-production.up.railway.app/health
# Esperado: {"status":"ok","version":"1.0.0",...}
```

### 2. SuperAdmin login
```bash
curl -X POST https://revio-app-production.up.railway.app/api/sa/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@misticatech.co","password":"MisticaTech2026!"}'
# Esperado: {"token":"eyJ...","user":{"role":"superadmin_tech"}}
```

### 3. Client login
```bash
curl -X POST https://revio-app-production.up.railway.app/api/dashboard/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@misticahostels.com","password":"Mystica2026!"}'
# Esperado: {"token":"eyJ...","user":{"email":"admin@misticahostels.com"}}
```

### 4. Meta webhook verification
```bash
curl "https://revio-app-production.up.railway.app/api/social/webhook/meta?hub.mode=subscribe&hub.verify_token=mystica_webhook_2026&hub.challenge=test123"
# Esperado: test123
```

### 5. Chat widget (agente IA)
```bash
curl -X POST https://revio-app-production.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola quiero información","property_slug":"mistica-isla-palma","session_id":"test-001"}'
# Esperado (con créditos Anthropic): respuesta del agente en español
# Esperado (sin créditos): {"reply":"Lo siento, tuve un problema técnico..."} 
```

### 6. Dashboard metrics (con token)
```bash
TOKEN=$(curl -s -X POST https://revio-app-production.up.railway.app/api/dashboard/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@misticahostels.com","password":"Mystica2026!"}' | \
  node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")

curl https://revio-app-production.up.railway.app/api/dashboard/metrics \
  -H "Authorization: Bearer $TOKEN"
```

### 7. LobbyPMS disponibilidad
```bash
curl -H "Authorization: Bearer DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe" \
  "https://api.lobbypms.com/api/v2/available-rooms?dateFrom=2026-05-20&dateTo=2026-05-22"
# ✅ LobbyPMS operativo vía fly.io proxy (IPs egreso: 64.34.84.154 / 204.93.227.88 — ambas en whitelist)
```

### 8. Wompi merchant
```bash
curl "https://production.wompi.co/v1/merchants/pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is"
# Esperado: datos del comercio Isla Palma
```

### 9. WhatsApp token
```bash
WA_TOKEN="EAAcK6VFh7XYBRJzyUw..."
curl "https://graph.facebook.com/v22.0/101206379439613?fields=id,display_phone_number,verified_name&access_token=${WA_TOKEN}"
# Esperado: {"id":"101206379439613","display_phone_number":"+57 323 4392420"}
```

### 10. Anthropic API
```bash
curl -s "https://api.anthropic.com/v1/models" \
  -H "x-api-key: sk-ant-api03-..." \
  -H "anthropic-version: 2023-06-01" | head -c 100
# Esperado: lista de modelos (si hay créditos)
# Si falla: "credit balance too low"
```

## Suite completa de tests

```bash
# Ejecutar desde el directorio del proyecto:
node backend/src/tests/integration-tests.js
```

## Datos de prueba reales

```
Tenant: Mística Hostels
User: admin@misticahostels.com / Mystica2026!
Property Isla Palma: 67fbce21-1b88-449f-93e2-1226cda2a7fb (slug: mistica-isla-palma)
Property Tayrona:    148f7836-6fcf-4d06-8570-bd65fcc2ccf0 (slug: mistica-tayrona)
SuperAdmin: admin@misticatech.co / MisticaTech2026!
```

## Checklist de verificación completo

```
Backend:
[ ] GET /health → status: ok
[ ] POST /api/sa/login → token JWT
[ ] POST /api/dashboard/login → token JWT
[ ] GET /api/dashboard/metrics → array de propiedades
[ ] GET /api/social/webhook/meta?verify → challenge echo
[ ] POST /api/chat → respuesta del agente (requiere créditos Anthropic)

Integraciones:
[ ] LobbyPMS /api/v2/available-rooms → habitaciones (requiere IP whitelist)
[ ] Wompi merchants endpoint → datos del comercio
[ ] WhatsApp token debug → is_valid: true
[ ] Anthropic API → lista de modelos (requiere créditos)

Frontend:
[ ] https://revio-app-production.up.railway.app → landing page carga
[ ] /login → formulario de login
[ ] /superadmin/login → panel superadmin
```

## Errores conocidos en producción

| Error | Estado | Solución |
|-------|--------|---------|
| Chat responde "problema técnico" | ✅ RESUELTO (créditos activos) | Operativo |
| LobbyPMS 403 | ✅ RESUELTO (fly.io proxy) | fly.io proxy activo (64.34.84.154 / 204.93.227.88) |
| WhatsApp envío falla | Phase DISCONNECTED | Reconectar en Meta Business |
| OTA poll crash | adapter sin getUnreadMessages | ✅ Corregido en commit 5c9526c |
