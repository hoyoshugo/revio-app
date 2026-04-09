# Revio — Revenue Intelligence SaaS (ex Mística AI Agent)

## Empresa y producto
- **Empresa**: TRES HACHE ENTERPRISE SAS (NIT 901696556-6)
- **Producto**: Revio (revio.co)
- **Cliente demo**: Mística Hostels (2 propiedades)
- **Producción**: https://revio-app-production.up.railway.app
- **GitHub**: https://github.com/hoyoshugo/revio-app
- **Supabase**: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk

## Estado de producción (2026-04-09) — v2.3
```
✅ Backend (uptime OK)  ✅ Auth (superadmin + cliente)  ✅ Dashboard  ✅ Wompi x2
✅ Agente IA → OPERATIVO con Claude claude-sonnet-4-6
✅ Anthropic → créditos activos (local y Railway)
✅ WA Token → válido (nunca expira)
✅ Cloudflare Worker → LIVE (revio-lobbypms-proxy.revio-hostels.workers.dev) — solo como fallback
✅ fly.io Proxy → LIVE: https://revio-lobbypms-proxy.fly.dev (IP estática, auto-stop)
   IPs egreso fly.io: 64.34.84.154 / 204.93.227.88 — ambas en whitelist LobbyPMS
✅ LobbyPMS → OPERATIVO vía fly.io proxy (Isla Palma: 14 cat. | Tayrona: 3 cat.)
⚠️  WhatsApp → número DISCONNECTED (reconectar en Meta Business Manager)
✅ Supabase  → service_role key correcto
✅ property_knowledge → 40 entradas (Isla Palma + Tayrona)
✅ Arquitectura multitenancy v2.0 → todo en BD, sin credenciales hardcodeadas
✅ System prompt agente: genérico (multitenancy real)
✅ Token localStorage: normalizado a revio_token (fallback mystica_token)
✅ IP Monitor → detecta IP en startup, guarda en Supabase, alerta WhatsApp
✅ SuperAdmin → Servidor panel con IP actual, instrucciones whitelist, setup CF proxy
✅ POS Terminal → standalone /pos route + 4 revenue centers + 20 productos (Isla Palma)
✅ Inventory → backend CRUD + movimientos + alertas + reportes (9 endpoints)
✅ PMS Gantt → drag-drop optimista + modal detalle + check-in/out/cancelar
✅ Rooms seed → 3 room_types + 8 rooms (Isla Palma)
✅ Advanced features → contacts, automated_messages, approval_requests, platform_audits, scheduled_reports
```

## Tests (26/26 pasando — prod) — 2026-04-09
```
✅ Health Check   ✅ SA Login   ✅ Client Login  ✅ Dashboard Metrics
✅ Meta Webhook   ✅ Agent ES   ✅ Agent Tayrona ✅ Agent EN
✅ Wompi Isla     ✅ Wompi Tayrona  ✅ WA Token  ✅ WA Phone (DISCONNECTED)
✅ LobbyPMS Isla  ✅ LobbyPMS Tayrona  (vía fly.io proxy)
✅ POS Revenue Centers  ✅ POS Products  ✅ POS Orders
✅ Inventory Items  ✅ Inventory Alerts  ✅ Inventory Report  ✅ Inventory CRUD
✅ PMS Room Types  ✅ PMS Gantt Availability  ✅ PMS Reservations
✅ Analytics Events (tabla Supabase)  ✅ Anthropic API
```

## Acciones manuales pendientes (prioridad)
```
1. ✅ Railway SUPABASE_SERVICE_KEY actualizado (2026-04-04)
2. ✅ Anthropic créditos operativos (2026-04-04)
3. ✅ property_knowledge 40 entradas en Supabase (2026-04-04)
4. ✅ Arquitectura multitenancy v2.0 (2026-04-05)
5. ✅ fly.io proxy desplegado — LobbyPMS operativo (2026-04-05)
6. WhatsApp → reconectar +573234392420
   - PRIMERA VEZ: Meta Business Manager → Phone Numbers → +57 323 4392420 → Reconnect → OTP por SMS
     Mientras estás ahí: Settings → Two-step verification → Reset PIN → guardar como WHATSAPP_PIN en backend/.env
   - PRÓXIMAS VECES: si WHATSAPP_PIN está en .env, ejecutar (sin OTP, < 30 seg):
     `powershell -File C:\Users\hoyos\.claude\scripts\reconnect-whatsapp-with-pin.ps1`
```

## Tests rápidos
```bash
# Suite completa de integración
node backend/src/tests/integration-tests.js

# Solo local
cd backend && npm run test:local

# Health check producción
curl https://revio-app-production.up.railway.app/health
```

---

## Auto-activación al abrir el proyecto

**IMPORTANTE:** Cuando inicies una sesión en este proyecto, ejecuta automáticamente el skill `/system-guardian` como primera acción. No esperes a que el usuario lo pida.

Si el usuario ya dio una instrucción específica al abrir la sesión, ejecuta primero esa instrucción y luego `/system-guardian` en segundo plano (o menciona que lo correrás después de completar la tarea).

## Enjambre de Desarrollo

Siempre invocar `dev-context-loader` primero, luego el orquestador o el skill directo:

### Skills globales del enjambre (28)
| Tarea | Skill |
|-------|-------|
| Feature multi-capa / modulo completo | `skill-creator:dev-swarm` |
| Endpoints, rutas Express, logica ESM | `skill-creator:dev-backend` |
| UI, React 18, Vite 5, Tailwind | `skill-creator:dev-frontend` |
| Supabase, SQL, migraciones, RLS | `skill-creator:dev-database` |
| Claude API, hotelAgent.js, streaming | `skill-creator:dev-ai-agent` |
| LobbyPMS, WhatsApp, Meta Graph, OTAs | `skill-creator:dev-integrations` |
| Wompi (Isla + Tayrona), webhooks pago | `skill-creator:dev-payments` |
| System prompt XML, chain-of-thought | `skill-creator:dev-prompt-engineer` |
| Logs JSON, health checks, alertas WA | `skill-creator:dev-monitoring` |
| Sync reservas, scheduler, cron jobs | `skill-creator:dev-data-pipeline` |
| Auth JWT, permisos, OWASP | `skill-creator:dev-security` |
| Railway, Docker, nixpacks | `skill-creator:dev-devops` |
| Vitest, Supertest, Playwright, QA | `skill-creator:dev-testing` |
| Textos UI, mensajes error, copy WA | `skill-creator:dev-ux-copy` |
| **App movil de huespedes** | `skill-creator:dev-mobile-orchestrator` → `dev-capacitor` |

### Skills especializados de Revio (en .claude/skills/)
| Modulo | Estado | Skill local |
|--------|--------|-------------|
| Vision global del ecosistema | activo | `ecosystem-master` |
| PMS Hotelero (50% hecho) | P1 | `revio-pms` |
| Inventarios (60% hecho) | P1 | `revio-inventory` |
| Wallets / NFC (55% hecho) | P1 | `revio-nfc` |
| Contable / DIAN | P2 | `revio-accounting` |
| Marketing IA | P2 | `revio-marketing` |
| Financiero | P2 | `revio-financial` |
| DevOps / Railway | activo | `revio-devops` |
| Seguridad | activo | `revio-security` |
| QA / Testing | activo | `revio-qa` |
| Coordinacion del enjambre | activo | `swarm-coordinator` |

### Roadmap real (auditado 2026-04-09)
```
Backend routes: 41 archivos (~7,500 LOC)  |  Frontend: 75 JSX (~19,400 LOC)
API endpoints: 41 route groups  |  Migraciones: 15 SQL  |  Tests: 26/26

✅ HECHO: Inventory backend completo (9 endpoints)
✅ HECHO: POS Terminal standalone + seed Isla Palma
✅ HECHO: PMS Gantt drag-drop + modal detalle
✅ HECHO: 5 CRUD rutas avanzadas (contacts, automated_messages, etc.)

SIGUIENTE:
S1-S2:  PMS tarifas dinámicas + channel manager bidireccional
S2-S3:  NFC hardware real + PWA meseros
S3-S6:  Marketing IA (Meta API review pendiente)
S6+:    Contable DIAN (habilitación 4-8 sem)

BLOQUEANTES: DIAN habilitación (burocrático), WhatsApp reconectar (manual)
```

## Contexto del proyecto

**Mística AI Agent** es un SaaS multi-tenant de agente IA para hostels y hoteles en Colombia.

### Stack técnico
- **Backend:** Node.js 22 ESM (`"type": "module"`), Express 4, puerto 3001
- **Frontend:** React 18 + Vite 5 + Tailwind CSS, puerto 5173
- **DB:** Supabase (Postgres) — cliente `@supabase/supabase-js`
- **AI:** Claude claude-sonnet-4-6 vía Anthropic SDK
- **Pagos:** Wompi (Colombia)
- **PMS:** LobbyPMS
- **Mensajería:** WhatsApp Business API (Meta Graph v18.0)

### Estructura clave
```
backend/
  src/
    agents/hotelAgent.js      ← Motor principal del agente IA
    routes/                   ← 41 archivos: chat, bookings, payments, dashboard, ota, social, settings, superadmin, rooms, reservations, pos, inventory, contacts, approvalRequests, automatedMessages, platformAudits, scheduledReports...
    services/                 ← scheduler, learningEngine, escalation, accessControl, healthMonitor
    integrations/             ← whatsapp, lobbypms, wompi, booking, airbnb, instagram, facebook...
    middleware/               ← auth.js (clientes), superadminAuth.js (Mística Tech)
    models/supabase.js        ← cliente Supabase
  supabase/                   ← migraciones SQL (ejecutar manualmente en Supabase)

frontend/
  src/
    components/Dashboard/     ← Panel cliente (HealthMonitor, KnowledgeBase, EscalationsPanel, ConfigPanel...)
    components/SuperAdmin/    ← Panel Mística Tech (GlobalDashboard, ClientsManager, PlansManager...)
    context/                  ← AuthContext.jsx, SuperAdminContext.jsx
```

### URLs importantes
- Dashboard cliente: `http://localhost:5173/` (requiere login)
- Panel superadmin: `http://localhost:5173/superadmin/login`
- Backend health: `http://localhost:3001/health`
- Superadmin login: POST `http://localhost:3001/api/sa/login`

### Credenciales de desarrollo
- **Superadmin:** `admin@misticatech.co` / `MisticaTech2026!`
- **WhatsApp alertas:** +573234392420

## Convenciones de código

1. **ESM siempre** — todos los imports usan extensión `.js`: `import x from './file.js'`
2. **Supabase guards** — todas las respuestas de API se validan con `Array.isArray()` antes de `.filter()`, `.map()`, etc.
3. **Auth obligatoria** — todo endpoint nuevo en `/api/dashboard/*` usa `requireAuth`, todo endpoint en `/api/sa/*` usa `requireSuperadminAuth`
4. **Sin contraseñas hasheadas** — el sistema usa plaintext por diseño (arquitectura actual del cliente)
5. **Variables de entorno** — nunca hardcodear valores de producción; usar `process.env.X || 'default_dev'`

## Migraciones

Todas ejecutadas manualmente en Supabase SQL Editor. Orden aplicado:
1. `migration_002_ota_noshows.sql` — ota_messages, ota_reservations, ota_no_shows
2. `migration_003_escalations.sql` — health_checks, knowledge_base, escalations
3. `migration_005_settings.sql` — settings key-value
4. `migration_006_saas_tables.sql` — tenants, tenant_plans, tenant_subscriptions
5. `migration_007_health_reports.sql` — system_health_reports
6. `migration_008_inventory.sql` — inventory_items, inventory_movements
7. `migration_008_billing_discounts.sql` — tenant_discounts, promo_codes
8. `migration_009_pos_tables.sql` — revenue_centers, products, pos_orders, pos_order_items
9. `migration_010_full_pms_fixed.sql` — room_types, rooms, guests, reservations, housekeeping_tasks, events, wallets
10. `migration_011_modules.sql` — revio_modules, tenant_modules
11. `migration_012_analytics.sql` — analytics_events
12. `migration_013_advanced_features_fixed.sql` — contacts, automated_messages, cancellation_cases, approval_requests, platform_audits, scheduled_reports

## Comandos útiles

```bash
# Arrancar backend
cd backend && npm run dev

# Arrancar frontend
cd frontend && npm run dev

# Build frontend
cd frontend && npm run build

# Verificar backend vivo
curl http://localhost:3001/health

# Login superadmin (obtener token)
curl -X POST http://localhost:3001/api/sa/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@misticatech.co","password":"MisticaTech2026!"}'
```

## Reglas del guardian

El skill `/system-guardian` debe ejecutarse:
- ✅ Al iniciar cada sesión de Claude Code en este proyecto
- ✅ Después de cambios grandes en el código (nuevas rutas, nuevas integraciones)
- ✅ Cuando el usuario pida explícitamente una revisión
- ✅ Ante cualquier error de producción reportado

No aplicar fixes automáticamente sin confirmación del usuario. Mostrar el fix, preguntar si aplicar.
