# Revio — Revenue Intelligence SaaS (ex Mística AI Agent)

## Empresa y producto
- **Empresa**: TRES HACHE ENTERPRISE SAS (NIT 901696556-6)
- **Producto**: Revio (revio.co)
- **Cliente demo**: Mística Hostels (2 propiedades)
- **Producción**: https://revio-app-production.up.railway.app
- **GitHub**: https://github.com/hoyoshugo/revio-app
- **Supabase**: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk

## Estado de producción (2026-04-05) — v2.0
```
✅ Backend (uptime OK)  ✅ Auth (superadmin + cliente)  ✅ Dashboard  ✅ Wompi x2
✅ Agente IA → OPERATIVO con Claude claude-sonnet-4-6
✅ Anthropic → créditos activos (local y Railway)
✅ WA Token → válido (nunca expira)
⚠️  WhatsApp → número DISCONNECTED (reconectar en Meta Business Manager)
⚠️  LobbyPMS → IP Railway ROTA en cada redeploy (ver IP actual en SuperAdmin → Servidor)
              → Agente funciona con cache (huéspedes no afectados)
              → Solución permanente: Cloudflare Worker (backend/cloudflare-proxy/)
✅ Supabase  → service_role key correcto
✅ property_knowledge → 40 entradas (Isla Palma + Tayrona)
✅ Arquitectura multitenancy v2.0 → todo en BD, sin credenciales hardcodeadas
✅ System prompt agente: genérico (multitenancy real)
✅ Token localStorage: normalizado a revio_token (fallback mystica_token)
✅ IP Monitor → detecta IP en startup, guarda en Supabase, alerta WhatsApp
✅ SuperAdmin → Servidor panel con IP actual, instrucciones whitelist, setup CF proxy
```

## Tests (13/15 pasando — local y prod) — 2026-04-05
```
✅ Health Check   ✅ SA Login   ✅ Client Login  ✅ Dashboard Metrics
✅ Meta Webhook   ✅ Agent ES   ✅ Agent Tayrona ✅ Agent EN
✅ Wompi Isla     ✅ Wompi Tayrona  ✅ WA Token  ✅ WA Phone (DISCONNECTED)
✅ Anthropic
❌ LobbyPMS Isla  ❌ LobbyPMS Tayrona  (IP rota — whitelist manual en LobbyPMS)
NOTA: IP Railway cambia en cada deploy → ver IP en SuperAdmin → Servidor
```

## Acciones manuales pendientes (prioridad)
```
1. ✅ Railway SUPABASE_SERVICE_KEY actualizado (2026-04-04)
2. ✅ Anthropic créditos operativos (2026-04-04)
3. ✅ property_knowledge 40 entradas en Supabase (2026-04-04)
4. ✅ Arquitectura multitenancy v2.0 (2026-04-05)
5. LobbyPMS → ver IP actual en SuperAdmin → Servidor → copiar IP → app.lobbypms.com/settings/api
   NOTA: Railway cambia IP en cada redeploy → solución permanente = Cloudflare Worker
   Deploy CF Worker: cd backend/cloudflare-proxy && CLOUDFLARE_API_TOKEN=xxx wrangler deploy
6. WhatsApp → reconectar +573234392420 en Meta Business Manager → WhatsApp → Phone Numbers
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

| Tarea | Skill |
|-------|-------|
| Feature multi-capa / módulo completo | `skill-creator:dev-swarm` |
| Endpoints, rutas Express, lógica ESM | `skill-creator:dev-backend` |
| UI, React 18, Vite 5, Tailwind | `skill-creator:dev-frontend` |
| Supabase, SQL, migraciones, RLS | `skill-creator:dev-database` |
| Claude API, hotelAgent.js, prompts | `skill-creator:dev-ai-agent` |
| LobbyPMS, WhatsApp, Meta Graph, OTAs | `skill-creator:dev-integrations` |
| Wompi (Isla + Tayrona), webhooks pago | `skill-creator:dev-payments` |
| Auth JWT, permisos, OWASP | `skill-creator:dev-security` |
| Railway, Docker, nixpacks | `skill-creator:dev-devops` |
| Jest, Supertest, mocks, QA | `skill-creator:dev-testing` |

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
    routes/                   ← chat, bookings, payments, dashboard, ota, social, settings, superadmin
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

## Migraciones pendientes

Ejecutar en Supabase SQL Editor en este orden:
1. `backend/supabase/migration_003_escalations.sql`
2. `backend/supabase/migration_005_settings.sql`
3. `backend/supabase/migration_006_saas_tables.sql`
4. `backend/supabase/migration_007_health_reports.sql` ← creado por system-guardian

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
