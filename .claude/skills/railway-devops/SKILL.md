---
name: railway-devops
description: >
  Activar cuando se trabaja con el deploy de Revio en Railway:
  builds Docker, variables de entorno, dominios, logs, redeploys,
  troubleshooting de builds o cuando se necesita actualizar la
  configuración de producción via Railway GraphQL API.
triggers:
  - "railway"
  - "deploy"
  - "dockerfile"
  - "producción"
  - "variables de entorno"
  - "build"
  - "logs"
version: 1.0.0
project: revio
---

# Railway — DevOps Revio

## URLs y IDs

```
Producción: https://revio-app-production.up.railway.app
GitHub: https://github.com/hoyoshugo/revio-app (branch: main)

Railway IDs (API GraphQL):
  projectId:     cfe111d6-c183-4445-836a-644edbb34e36
  environmentId: 14f2f2f5-93cc-45ec-a905-f51c98fa6f03
  serviceId:     b3b77a38-6888-465b-ae35-6463c9950390
```

## Railway API (sin browser)

### Actualizar variable de entorno
```bash
RAILWAY_COOKIE="rw_Fe26.2**[token]"

curl -s -X POST "https://backboard.railway.com/graphql/internal" \
  -H "Content-Type: application/json" \
  -H "Cookie: rw.session=${RAILWAY_COOKIE}" \
  -d '{
    "query": "mutation variableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
    "variables": {
      "input": {
        "projectId": "cfe111d6-c183-4445-836a-644edbb34e36",
        "environmentId": "14f2f2f5-93cc-45ec-a905-f51c98fa6f03",
        "serviceId": "b3b77a38-6888-465b-ae35-6463c9950390",
        "name": "VARIABLE_NAME",
        "value": "value"
      }
    }
  }'
```

### Triggear redeploy
```bash
curl -s -X POST "https://backboard.railway.com/graphql/internal" \
  -H "Content-Type: application/json" \
  -H "Cookie: rw.session=${RAILWAY_COOKIE}" \
  -d '{
    "query": "mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }",
    "variables": {
      "serviceId": "b3b77a38-6888-465b-ae35-6463c9950390",
      "environmentId": "14f2f2f5-93cc-45ec-a905-f51c98fa6f03"
    }
  }'
```

### Ver logs del último deploy
```bash
curl -s -X POST "https://backboard.railway.com/graphql/internal" \
  -H "Cookie: rw.session=${RAILWAY_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ deploymentLogs(deploymentId: \"[deploymentId]\", limit: 100) { message timestamp } }"}'
```

### Ver estado de deployments
```bash
curl -s -X POST "https://backboard.railway.com/graphql/internal" \
  -H "Cookie: rw.session=${RAILWAY_COOKIE}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ deployments(input: { serviceId: \"b3b77a38-6888-465b-ae35-6463c9950390\" }) { edges { node { id status createdAt } } } }"}'
```

## Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY . .
ARG VITE_API_URL=https://revio-app-production.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}
RUN cd frontend && npm run build
EXPOSE 3001
CMD ["node", "backend/src/index.js"]
```

**IMPORTANTE**: `VITE_API_URL` es build-time (Vite), debe pasarse como ARG antes de `npm run build`.

## railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "node backend/src/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

## Variables de entorno en Railway (36 variables)

```env
# LobbyPMS
LOBBY_TOKEN_ISLA_PALMA=DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe
LOBBY_TOKEN_TAYRONA=m25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL
LOBBY_API_URL=https://api.lobbypms.com

# Wompi
WOMPI_PUBLIC_KEY_ISLA=pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is
WOMPI_PRIVATE_KEY_ISLA=prv_prod_aXLdFHwIIktnmKNHdjBXVsaDJzEbs2p9
WOMPI_EVENT_SECRET_ISLA=prod_events_cYHxiHGC0thdvPcKoncsLBSKaEWInNwI
WOMPI_PUBLIC_KEY_TAYRONA=pub_prod_Y3GeuGHuQk22aI3x0x6aKcVi8j2haBcA
WOMPI_PRIVATE_KEY_TAYRONA=prv_prod_JgHPuMpLPIgNHmtdpp5BpRYQv3S4EAsP
WOMPI_EVENT_SECRET_TAYRONA=pendiente
WOMPI_API_URL=https://production.wompi.co/v1

# WhatsApp
WHATSAPP_NUMBER=+573234392420
WHATSAPP_TOKEN=[60-day token]
WHATSAPP_VERIFY_TOKEN=mystica_webhook_2026
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
WHATSAPP_PHONE_ID=101206379439613
META_BUSINESS_ID=764980183700550
META_APP_SECRET=b16771c0aaaf31715c38b08203fe8c3f
META_VERIFY_TOKEN=mystica_webhook_2026

# Anthropic — PENDIENTE créditos
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase — PENDIENTE service_role key
SUPABASE_URL=https://apghalkivuvyhbmethxk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=❌ PENDIENTE

# Auth
JWT_SECRET=MisticaHostels2026SuperSecretKey
JWT_SUPERADMIN_SECRET=MisticaTech2026SuperAdminSecretKey_XK9m
ENCRYPTION_KEY=a3f8c2d1e4b59678...

# SuperAdmin
SUPERADMIN_EMAIL=admin@misticatech.co
SUPERADMIN_PASSWORD=MisticaTech2026!

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://revio-app-production.up.railway.app
```

## Troubleshooting builds

| Error | Causa | Solución |
|-------|-------|---------|
| `nodejs_22 undefined` | nixpkgs hash sin ese paquete | Usar DOCKERFILE builder |
| `npm ci exit code 127` | Node no instalado en nixpacks | Agregar `providers = ["node"]` o usar Dockerfile |
| `lockfile out of sync` | package.json ≠ package-lock.json | `npm install --legacy-peer-deps` |
| `health check failed` | App no inicia | Revisar PORT y CMD en Dockerfile |

## IP del servidor

```
Railway server egress IP: 200.189.27.14
Necesita whitelist en: LobbyPMS, cualquier API con restricción IP
```

## Flujo de deploy

```
git push origin main
  → GitHub webhook → Railway detects push
  → Docker build (~5 min)
  → Health check /health
  → Swap deployment
```

## Plan actual

```
Trial plan — no soporta custom domains
Para api.revio.co: upgrade a Hobby ($5/mes)
Luego: Settings → Domains → Add custom domain
DNS: CNAME api → [cname].railway.app
```

## Graceful Shutdown

```javascript
// backend/src/index.js — ya implementado
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM recibido, cerrando...');
  server.close(() => process.exit(0));
});
```

Necesario para que Railway pueda reiniciar limpiamente sin interrumpir requests en vuelo.
