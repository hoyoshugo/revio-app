---
name: revio-architecture
description: >
  Activar cuando se necesita entender la arquitectura completa de Revio:
  estructura de carpetas, stack técnico, flujos de autenticación JWT,
  flujo de pagos Wompi, multitenancy, rutas de API, o cuando se va a
  crear una feature nueva que toca múltiples capas del sistema.
triggers:
  - "arquitectura de revio"
  - "cómo funciona el sistema"
  - "flujo de autenticación"
  - "flujo de pagos"
  - "multitenancy"
  - "nueva feature"
version: 1.0.0
project: revio
---

# Revio — Arquitectura Completa

## Stack técnico

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Backend | Node.js 22 ESM + Express 4 | 3001 |
| Frontend | React 18 + Vite 5 + Tailwind CSS | 5173 |
| Base de datos | Supabase (Postgres) | — |
| Deploy | Railway (Dockerfile) | — |
| IA | Claude claude-sonnet-4-6 vía Anthropic SDK | — |
| Pagos | Wompi (Colombia) | — |
| PMS | LobbyPMS | — |
| Mensajería | WhatsApp Business API Meta Graph v22.0 | — |

## Estructura de carpetas

```
mystica-ai-agent/
├── backend/
│   ├── src/
│   │   ├── agents/hotelAgent.js       ← Motor IA principal
│   │   ├── routes/
│   │   │   ├── chat.js                ← POST /api/chat
│   │   │   ├── bookings.js            ← /api/bookings/*
│   │   │   ├── payments.js            ← /api/payments/*
│   │   │   ├── dashboard.js           ← /api/dashboard/* (cliente)
│   │   │   ├── knowledge.js           ← /api/knowledge/*
│   │   │   ├── ota.js                 ← /api/ota/*
│   │   │   ├── social.js              ← /api/social/*
│   │   │   ├── settings.js            ← /api/settings/*
│   │   │   ├── superadmin.js          ← /api/sa/* (Mística Tech)
│   │   │   └── register.js            ← /api/register/*
│   │   ├── services/
│   │   │   ├── scheduler.js           ← Cron jobs
│   │   │   ├── learningEngine.js      ← Auto-mejora del agente
│   │   │   ├── escalation.js          ← Escalar a humano
│   │   │   ├── accessControl.js       ← Control pagos/acceso
│   │   │   └── healthMonitor.js       ← Monitor servicios
│   │   ├── integrations/
│   │   │   ├── lobbyPMS.js            ← LobbyPMS PMS
│   │   │   ├── wompi.js               ← Wompi pagos
│   │   │   ├── whatsapp.js            ← WhatsApp Business
│   │   │   ├── instagram.js           ← Instagram DMs
│   │   │   ├── facebook.js            ← Facebook Pages
│   │   │   ├── googleBusiness.js      ← Google Business
│   │   │   ├── tripadvisor.js         ← TripAdvisor
│   │   │   ├── bookingCom.js          ← Booking.com
│   │   │   ├── airbnb.js              ← Airbnb
│   │   │   ├── otaHub.js              ← Orquestador OTA
│   │   │   └── pms/
│   │   │       ├── pmsAdapter.js      ← Adapter pattern
│   │   │       ├── lobbypms.js
│   │   │       ├── cloudbeds.js
│   │   │       ├── mews.js
│   │   │       └── custom.js
│   │   ├── middleware/
│   │   │   ├── auth.js                ← JWT clientes
│   │   │   ├── superadminAuth.js      ← JWT superadmin
│   │   │   └── rateLimiter.js         ← Rate limiting
│   │   ├── models/
│   │   │   └── supabase.js            ← Cliente Supabase + helpers DB
│   │   └── index.js                   ← Entry point Express
│   ├── supabase/                      ← Migraciones SQL
│   └── package.json                   ← "type": "module" (ESM)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/             ← Panel cliente
│   │   │   └── SuperAdmin/            ← Panel Mística Tech
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SuperAdminContext.jsx
│   │   └── pages/
│   ├── .env.production                ← VITE_API_URL=https://revio-app-production.up.railway.app
│   └── package.json
├── Dockerfile                         ← node:22-alpine, ARG VITE_API_URL
└── railway.json                       ← DOCKERFILE builder
```

## Convenciones de código

- **ESM siempre**: `import x from './file.js'` (con extensión .js)
- **Supabase guards**: `Array.isArray(data)` antes de `.map()/.filter()`
- **Auth obligatoria**: `/api/dashboard/*` → `requireAuth`, `/api/sa/*` → `requireSuperadminAuth`
- **Sin contraseñas hasheadas**: diseño actual usa plaintext
- **Variables de entorno**: nunca hardcodear, usar `process.env.X || 'default'`

## Flujo de autenticación JWT

```
Cliente                    Backend                   Supabase
  │                          │                          │
  ├─ POST /api/dashboard/login ────────────────────────►│
  │   {email, password}      │  SELECT FROM users       │
  │                          │◄────────────────────────┤
  │                          │  verificar password      │
  │◄── {token, user} ────────┤  signToken(userId)       │
  │                          │                          │
  ├─ GET /api/dashboard/* ───►│                          │
  │   Authorization: Bearer  │  requireAuth middleware  │
  │                          │  jwt.verify(token)       │
  │                          │  req.user = decoded      │
  │◄── data ─────────────────┤                          │
```

JWT tiene campos: `{ id, email, role, property_id, tenant_id }`

## Flujo de pagos Wompi

```
1. Guest en chat → solicita reserva
2. hotelAgent.js → crea link de pago Wompi
   POST https://production.wompi.co/v1/payment_links
   {amount_in_cents, currency, name, description, redirect_url}
3. Responde al guest con payment_link_url
4. Guest completa pago en Wompi
5. Wompi → POST /api/payments/webhook
   Verifica firma HMAC con WOMPI_EVENT_SECRET
   Si status=APPROVED → crea reserva en LobbyPMS
                      → guarda en Supabase
                      → notifica por WhatsApp
```

## Sistema Multitenancy

```
tenants (empresa)
  └── properties (propiedades del hotel)
        └── users (staff del hotel)
              └── conversations (chats de huéspedes)
                    └── messages

Aislamiento: req.user.tenant_id filtra todos los queries
Property slug: mistica-isla-palma, mistica-tayrona
```

## Endpoints principales

```
# Públicos
GET  /health
POST /api/chat              ← Widget del chatbot
GET  /api/social/webhook/meta    ← Verificación webhook
POST /api/social/webhook/meta    ← Eventos Meta

# Clientes (requireAuth)
POST /api/dashboard/login
GET  /api/dashboard/metrics
GET  /api/dashboard/conversations
GET  /api/knowledge/:propertyId
PUT  /api/knowledge/:id
POST /api/settings/ai-provider
GET  /api/bookings/available
POST /api/bookings/create
POST /api/payments/create-link

# SuperAdmin (requireSuperadminAuth)
POST /api/sa/login          ← admin@misticatech.co / MisticaTech2026!
GET  /api/sa/dashboard
GET  /api/sa/tenants
POST /api/sa/tenants
PUT  /api/sa/tenants/:id
GET  /api/sa/plans
GET  /api/sa/errors
```

## Datos clave de Mística (cliente demo)

```
Tenant: Mística Hostels
Email: admin@misticahostels.com
Password: Mystica2026!

Propiedad Isla Palma:
  ID: 67fbce21-1b88-449f-93e2-1226cda2a7fb
  Slug: mistica-isla-palma / isla-palma
  LobbyPMS token: DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe

Propiedad Tayrona:
  ID: 148f7836-6fcf-4d06-8570-bd65fcc2ccf0
  Slug: mistica-tayrona / tayrona
  LobbyPMS token: m25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL
```

## URLs

- Producción: https://revio-app-production.up.railway.app
- GitHub: https://github.com/hoyoshugo/revio-app
- Supabase: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk
- Railway: https://railway.app (project: fulfilling-light)
