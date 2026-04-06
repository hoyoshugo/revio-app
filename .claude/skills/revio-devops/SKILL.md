---
name: revio-devops
description: |
  Infraestructura y DevOps de Revio. Railway, Cloudflare, IP fija LobbyPMS.
  Activar cuando se trabaje en deploy, variables de entorno, Railway, proxy, CI/CD.
triggers:
  - deploy
  - Railway
  - Cloudflare
  - CI/CD
  - infraestructura
  - logs
  - variables entorno
  - IP fija
  - redeploy
status: produccion
priority: P0
---

# Revio DevOps

## Estado de infraestructura (2026-04-05)
- Backend + Frontend: Railway (revio-app-production.up.railway.app)
- BD: Supabase (apghalkivuvyhbmethxk)
- Proxy IP fija: fly.io 64.34.84.154 (para LobbyPMS)
- CDN/Workers: Cloudflare Workers (cloudflare-proxy/)
- GitHub: hoyoshugo/revio-app (autodeploy en push a main)

## Comandos criticos
```bash
# Health check produccion
curl https://revio-app-production.up.railway.app/health

# Logs Railway
railway logs --tail

# IP actual del servidor
curl https://api.ipify.org
# Ver en SuperAdmin -> Servidor para whitelist LobbyPMS

# Deploy manual
git push origin main  # Railway autodeploy

# Cloudflare Worker (proxy IP fija)
cd backend/cloudflare-proxy
wrangler deploy  # requiere CLOUDFLARE_API_TOKEN
```

## Variables de entorno (Railway)
Ver lista completa en Railway dashboard.
Nunca hardcodear -- siempre process.env.VARIABLE

## IPs criticas
- Railway: CAMBIA en cada redeploy (ver SuperAdmin -> Servidor)
- Proxy fly.io: 64.34.84.154 (FIJA -- usar para LobbyPMS whitelist)
- Cloudflare Workers: IPs en cloudflare.com/ips (FIJAS)

## Proceso de deploy
1. git push origin main
2. Railway detecta el push automaticamente
3. Build con nixpacks (~3-4 minutos)
4. Railway reinicia el servicio con la nueva IP
5. ATENTO: LobbyPMS puede fallar si la IP cambio

## Graceful shutdown
```javascript
// backend/src/index.js -- ya implementado
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM recibido, cerrando...');
  server.close(() => process.exit(0));
});
```
