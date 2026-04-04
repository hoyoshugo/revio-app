# Revio — Revenue Intelligence SaaS (ex Mística AI Agent)

## Empresa y producto
- **Empresa**: TRES HACHE ENTERPRISE SAS (NIT 901696556-6)
- **Producto**: Revio (revio.co)
- **Cliente demo**: Mística Hostels (2 propiedades)
- **Producción**: https://revio-app-production.up.railway.app
- **GitHub**: https://github.com/hoyoshugo/revio-app
- **Supabase**: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk

## Estado de producción (2026-04-04)
```
✅ Backend (uptime OK)  ✅ Auth (superadmin + cliente)  ✅ Dashboard  ✅ Wompi x2
✅ WhatsApp CONNECTED + GREEN quality  ✅ Meta webhook  ✅ WA token (vence ~2026-06-03)
⚠️  Agente IA → fallback activo (sin créditos Anthropic) → recargar $20 USD
❌  LobbyPMS  → IP 200.189.27.14 no está en whitelist → dashboard LobbyPMS
              → Cache fallback activo (agente no falla, usa último dato conocido)
⚠️  Supabase  → service_role key correcto en backend/.env LOCAL
              → Railway aún tiene key antigua → ejecutar .\update-railway-vars.ps1
              → Fallback a anon key funciona (backend operativo)
⚠️  property_knowledge tabla → pendiente crear en Supabase SQL Editor
              → Auto-creará en Railway si se agrega SUPABASE_DB_URL (ver update-railway-vars.ps1)
```

## Tests (12/15 pasando) — 2026-04-04
```
✅ Health Check   ✅ SA Login   ✅ Client Login  ✅ Dashboard Metrics
✅ Meta Webhook   ✅ Agent ES   ✅ Agent Tayrona ✅ Agent EN
✅ Wompi Isla     ✅ Wompi Tayrona  ✅ WA Token  ✅ WA Phone CONNECTED
❌ LobbyPMS Isla  ❌ LobbyPMS Tayrona  ❌ Anthropic (sin créditos)
```

## Acciones manuales pendientes (prioridad)
```
1. ✅ Railway SUPABASE_SERVICE_KEY actualizado (2026-04-04)
2. ✅ LobbyPMS IP whitelist resuelta (2026-04-04) — 14 categorías disponibles
3. Supabase SQL Editor → migration_009_property_knowledge.sql  ← property_knowledge tabla
4. console.anthropic.com/settings/billing → verificar organización correcta ← agente IA
   IMPORTANTE: El key sk-ant-api03-aCImmVu... reporta 0 créditos.
   Si cargaste créditos, verifica que sean en la misma organización del key.
   Alternativa: generar nuevo key desde la org donde cargaste créditos.
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

Para cualquier tarea de desarrollo en este proyecto, usa el enjambre de skills especializados:
- **Feature completa / multi-capa** → `skill-creator:dev-swarm` (orquestador)
- **Endpoints, rutas, lógica** → `skill-creator:dev-backend`
- **UI, React, Vite, componentes** → `skill-creator:dev-frontend`
- **Supabase, SQL, migraciones** → `skill-creator:dev-database`
- **Claude API, agente IA, prompts** → `skill-creator:dev-ai-agent`
- **Railway, deploy, infra** → `skill-creator:dev-devops`
- **Auth, Wompi, permisos** → `skill-creator:dev-security`

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
