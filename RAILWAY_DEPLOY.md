# Railway Deployment Guide — Revio

## Pasos para deploy en Railway

### 1. Crear proyecto en Railway
1. Ir a [railway.app](https://railway.app) → New Project
2. "Deploy from GitHub repo" → seleccionar `hoyoshugo/revio-app`
3. Branch: `main`

### 2. Variables de entorno en Railway
En el servicio creado → Settings → Variables → añadir:

```
# === REQUERIDAS ===
LOBBY_TOKEN_ISLA_PALMA=DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe
LOBBY_TOKEN_TAYRONA=m25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL
LOBBY_API_URL=https://api.lobbypms.com

WOMPI_PUBLIC_KEY_ISLA=pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is
WOMPI_PRIVATE_KEY_ISLA=prv_prod_aXLdFHwIIktnmKNHdjBXVsaDJzEbs2p9
WOMPI_PUBLIC_KEY_TAYRONA=pub_prod_Y3GeuGHuQk22aI3x0x6aKcVi8j2haBcA
WOMPI_PRIVATE_KEY_TAYRONA=prv_prod_JgHPuMpLPIgNHmtdpp5BpRYQv3S4EAsP
WOMPI_API_URL=https://production.wompi.co/v1

WHATSAPP_PHONE_ID=101206379439613
WHATSAPP_NUMBER=+573234392420
WHATSAPP_TOKEN=pendiente
WHATSAPP_API_URL=https://graph.facebook.com/v18.0

ANTHROPIC_API_KEY=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

SUPABASE_URL=https://apghalkivuvyhbmethxk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZ2hhbGtpdnV2eWhibWV0aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTg4ODYsImV4cCI6MjA5MDczNDg4Nn0.np3z1aomEr1lOeyNkekeyCnw1Qb6iHhHWGYz1r147Gw
SUPABASE_SERVICE_KEY=sb_publishable_jyNwf-sel-lQGpZOav1Ktg_djMxoKsiJ

JWT_SECRET=MisticaHostels2026SuperSecretKey
ENCRYPTION_KEY=a3f8c2d1e4b5967843210fedcba9876543210fedcba9876543210fedcba98765432

SUPERADMIN_EMAIL=admin@misticatech.co
SUPERADMIN_PASSWORD=MisticaTech2026!
JWT_SUPERADMIN_SECRET=MisticaTech2026SuperAdminSecretKey_XK9m

NODE_ENV=production
PORT=3001

# === ACTUALIZAR DESPUÉS DEL PRIMER DEPLOY ===
# (poner la URL real de Railway aquí)
FRONTEND_URL=https://revio-app.railway.app

# === OPCIONALES ===
META_VERIFY_TOKEN=mystica_webhook_2026
ALERT_WHATSAPP=+573234392420
LEARNING_WHATSAPP_1=+573057673770
LEARNING_WHATSAPP_2=+573006526427
ESCALATION_WHATSAPP_1=+573057673770
ESCALATION_WHATSAPP_2=+573006526427
```

### 3. Cuando llegue el WHATSAPP_TOKEN
Simplemente actualizar la variable `WHATSAPP_TOKEN` en Railway → el backend lo detecta automáticamente en el siguiente request.

### 4. Migraciones SQL pendientes
Ejecutar en Supabase SQL Editor (proyecto: `apghalkivuvyhbmethxk`):
1. `backend/supabase/migration_008_billing_discounts.sql`
2. `backend/supabase/migration_009_property_knowledge.sql`

### 5. Whitelist IP en LobbyPMS
- IP de Railway: aparece en Railway → Service → Settings → Networking
- Agregar en panel de LobbyPMS → API Access → Allowed IPs

### 6. URL del webhook de Wompi
Configurar en Wompi dashboard:
```
https://revio-app.railway.app/api/payments/webhook
```

### 7. URL del webhook de WhatsApp (Meta)
```
https://revio-app.railway.app/api/chat/webhook
Verify token: mystica_webhook_2026
```
