---
name: saas-business
description: >
  Activar cuando se trabaja con el modelo de negocio de Revio:
  planes y precios, facturación, onboarding de clientes, métricas
  SaaS, sistema de descuentos, promo codes, o landing page config.
triggers:
  - "planes"
  - "precios"
  - "facturación"
  - "onboarding"
  - "tenant"
  - "mrr"
  - "descuento"
  - "promo"
version: 1.0.0
project: revio
---

# Revio — Modelo de Negocio SaaS

## Empresa
- Nombre: TRES HACHE ENTERPRISE SAS
- NIT: 901696556-6
- Producto: Revio (revio.co)
- Empresa del cliente demo: MÍSTICA HOSTELS

## Planes y precios (COP)

| Plan | Precio/mes | Extra propiedad/mes | Max propiedades | Descripción |
|------|-----------|--------------------|-|-------------|
| Básico | $299.000 | $149.000 | 1 | WhatsApp + 1 OTA |
| Pro | $599.000 | $249.000 | 3 | Todas las OTAs + analytics |
| Enterprise | $1.199.000 | $399.000 | ilimitadas | API custom + SLA |

## Sistema de facturación

```sql
-- Ciclos disponibles
billing_cycle: 'monthly' | 'annual'

-- Descuentos
tenant_discounts:
  type: 'percent_permanent' | 'percent_temporary' | 'trial_extension' | 'plan_upgrade'
  value: NUMERIC (porcentaje)
  expires_at: TIMESTAMPTZ (null = permanente)
```

## Promo codes

```sql
promo_codes:
  code TEXT UNIQUE       -- "REVIO30"
  discount_pct INT       -- 30
  max_uses INT           -- 100
  used_count INT         -- 0
  expires_at TIMESTAMPTZ
  is_active BOOLEAN
```

## Trial

- Duración: 14 días por defecto
- Status durante trial: 'trial'
- Al vencer: si no paga → 'suspended'
- Puede extenderse via tenant_discounts (type: 'trial_extension')

## Flujo de onboarding

```
1. Cliente se registra en /register
   → crea tenant + user + property básica
2. Wizard de onboarding (/onboarding)
   → conectar PMS (LobbyPMS/Cloudbeds/Mews)
   → conectar WhatsApp
   → configurar agente IA
   → prueba de conversación
3. Dashboard activo
   → métricas en tiempo real
   → knowledge base editable
   → configuración de intensidad de venta
```

## Métricas del negocio (SuperAdmin dashboard)

```
MRR = suma de plan prices de tenants activos
Conversaciones hoy/mes
Costo estimado Anthropic (tokens * precio)
Errores abiertos (críticos vs normales)
Growth mensual (últimos 3 meses)
```

## Landing page config (tabla landing_config)

```json
{
  "hero": {
    "headline": "El agente IA que convierte tus chats en reservas",
    "subheadline": "Automatiza WhatsApp, OTAs y recepción con IA entrenada para hostels en Colombia."
  },
  "pricing": {
    "basico": 299000,
    "pro": 599000,
    "enterprise": 1199000
  },
  "integrations": ["WhatsApp","Booking.com","Airbnb","LobbyPMS","Wompi","Instagram","Facebook"]
}
```

## Endpoints SuperAdmin relevantes

```
GET  /api/sa/dashboard      → MRR, tenants, conversaciones
GET  /api/sa/tenants        → lista todos los clientes
POST /api/sa/tenants        → crear cliente manual
PUT  /api/sa/tenants/:id    → editar cliente
POST /api/sa/tenants/:id/toggle → activar/suspender
GET  /api/sa/plans          → planes disponibles
POST /api/sa/plans          → crear plan nuevo
```

## Credenciales SuperAdmin

```
Email: admin@misticatech.co
Password: MisticaTech2026!
JWT: /api/sa/login → token 12h
```
