# Mística AI Agent

Agente de ventas con inteligencia artificial para Mística Hostels (Colombia). Sistema completo con chat widget embebible, dashboard en tiempo real, integración con LobbyPMS, pagos Wompi y automatización de comunicaciones.

## Módulos

- **Agente IA conversacional** con Claude (`claude-sonnet-4-6`) — multilingüe (es/en/fr/de), estrategia de ventas en 3 niveles
- **Integración LobbyPMS** — disponibilidad, tarifas, ocupación, reservas en tiempo real
- **Pagos Wompi** — links de pago por reserva, webhook de confirmación
- **Automatización de comunicaciones** — WhatsApp + email, 7 pasos desde confirmación hasta fidelización
- **Dashboard tiempo real** — conversaciones, reservas, ocupación, reportes semanales
- **Multitenancy** — arquitectura lista para múltiples hostales

## Requisitos

- Node.js >= 18
- Cuenta Supabase (PostgreSQL)
- API Key de Anthropic (Claude)
- Credenciales LobbyPMS por propiedad
- Credenciales Wompi por propiedad
- (Opcional) WhatsApp Business API token
- (Opcional) cuenta SMTP para emails

## Instalación local

### 1. Clonar y configurar variables de entorno

```bash
git clone <repo>
cd mystica-ai-agent
cp .env.example .env
# Editar .env con tus credenciales
```

### 2. Configurar Supabase

Ejecuta el schema en el SQL Editor de tu proyecto Supabase:

```
Supabase Dashboard → SQL Editor → New query
Pegar contenido de: backend/supabase/schema.sql
Ejecutar
```

### 3. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Iniciar en desarrollo

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- Health check: http://localhost:3001/health

## Despliegue en Railway

### Opción A: Solo backend (recomendado para empezar)

1. Crear proyecto en Railway
2. Conectar repositorio GitHub
3. En Variables de entorno, agregar todas las del `.env.example`
4. Railway detecta `railway.json` y despliega automáticamente

```bash
# Instalar Railway CLI (opcional)
npm i -g @railway/cli
railway login
railway up
```

### Opción B: Backend + Frontend separados

1. Crear dos servicios en Railway
2. Backend: `cd backend && npm start`
3. Frontend: `cd frontend && npm run build && npx serve dist`
4. Agregar `VITE_API_URL` en frontend apuntando al backend de Railway

### Variables de entorno requeridas en Railway

```
LOBBY_TOKEN_ISLA_PALMA=...
LOBBY_TOKEN_TAYRONA=...
WOMPI_PUBLIC_KEY_ISLA=...
WOMPI_PRIVATE_KEY_ISLA=...
WOMPI_PUBLIC_KEY_TAYRONA=...
WOMPI_PRIVATE_KEY_TAYRONA=...
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=<cadena larga y aleatoria>
FRONTEND_URL=https://tu-app.railway.app
NODE_ENV=production
PORT=3001
```

## Chat Widget Embebible

Agrega este script en cualquier página web del cliente:

```html
<!-- En el <head> -->
<script>
  window.MysticaConfig = {
    property: 'isla-palma',  // o 'tayrona'
    language: 'es',          // es, en, fr, de (auto-detecta)
    autoOpen: false          // true para abrir automáticamente a los 8 segundos
  };
</script>

<!-- Antes del </body> -->
<script src="https://tu-backend.railway.app/embed.js" async></script>
```

El widget es completamente autónomo, no requiere dependencias adicionales y funciona en cualquier web.

## Crear primer usuario admin

Ejecuta en Supabase SQL Editor:

```sql
-- Reemplaza con tus datos
INSERT INTO users (email, password_hash, name, role, property_id)
VALUES (
  'admin@misticahostels.com',
  'tu_contraseña_aqui',  -- En producción usar bcrypt hash
  'Administrador',
  'admin',
  (SELECT id FROM properties WHERE slug = 'isla-palma')
);
```

En producción, instalar `bcryptjs` y hashear el password:

```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('mi_contraseña', 12);
// Usar el hash en la BD
```

## Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/chat` | Mensaje del widget |
| POST | `/api/chat/init` | Iniciar sesión de chat |
| GET | `/api/dashboard/metrics` | Métricas del panel |
| GET | `/api/dashboard/conversations` | Lista conversaciones |
| GET | `/api/bookings` | Lista reservas |
| POST | `/api/payments/webhook` | Webhook Wompi |
| GET | `/api/payments/pending` | Pagos pendientes |
| GET | `/embed.js` | Script del widget |
| GET | `/health` | Health check |

## Flujo de una venta

```
Cliente escribe en el widget
        ↓
Agente IA detecta idioma y necesidades
        ↓
Consulta disponibilidad en LobbyPMS (tiempo real)
        ↓
Vende el destino → muestra opciones
        ↓
Cliente elige → agente recopila datos
        ↓
Confirma reserva (LobbyPMS + Supabase)
        ↓
Genera link de pago Wompi
        ↓
Envía confirmación por WhatsApp + Email
        ↓
Scheduler: 6 recordatorios automáticos
        ↓
Dashboard: equipo ve todo en tiempo real
```

## Estrategia de descuentos

El agente NUNCA ofrece descuento de entrada. Solo lo considera si:

1. El cliente expresa duda después de ver el valor
2. Se consulta la ocupación via LobbyPMS API
3. Si la ocupación es < 60%, puede ofrecer hasta 15% de descuento
4. Máximo: 15% — nunca más

## Estructura de archivos

```
mystica-ai-agent/
├── backend/
│   ├── src/
│   │   ├── agents/hotelAgent.js       # Agente Claude con tool use
│   │   ├── integrations/
│   │   │   ├── lobbyPMS.js            # LobbyPMS API client
│   │   │   ├── wompi.js               # Wompi payments
│   │   │   └── whatsapp.js            # WhatsApp + Email + Templates
│   │   ├── routes/
│   │   │   ├── chat.js                # Endpoints del chat
│   │   │   ├── bookings.js            # CRUD reservas
│   │   │   ├── payments.js            # Pagos y webhook
│   │   │   └── dashboard.js           # Dashboard y métricas
│   │   ├── models/supabase.js         # Helpers de BD
│   │   ├── middleware/
│   │   │   ├── auth.js                # JWT auth
│   │   │   └── rateLimiter.js         # Rate limiting
│   │   ├── services/
│   │   │   ├── automations.js         # Procesar comunicaciones
│   │   │   └── scheduler.js           # Cron jobs
│   │   └── index.js                   # Servidor Express
│   ├── supabase/schema.sql            # Schema completo de BD
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/             # Panel principal
│   │   │   ├── Reports/               # Reportes semanales
│   │   │   └── Admin/                 # Login
│   │   ├── context/AuthContext.jsx    # Auth state
│   │   ├── hooks/useApi.js            # HTTP client
│   │   └── App.jsx
│   └── package.json
├── .env.example
├── .gitignore
├── railway.json
└── README.md
```

## Escalado multitenancy

Para agregar un nuevo hostal:

1. Ejecutar `INSERT INTO properties (...)` con los datos del hostal
2. Agregar tokens en Railway como variables de entorno
3. Crear usuario admin vinculado a la nueva propiedad
4. El widget se configura con `property: 'nuevo-slug'`

---

Desarrollado para Mística Hostels — Colombia 🌊
