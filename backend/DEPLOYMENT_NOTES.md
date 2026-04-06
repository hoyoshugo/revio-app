# Revio PMS — Production Checklist

## ✅ Currently Active (as of 2026-04-05)
- Backend: Railway (revio-app-production.up.railway.app)
- Supabase: apghalkivuvyhbmethxk
- Wompi Isla Palma: public + private keys configured
- Wompi Tayrona: public + private keys configured
- LobbyPMS: tokens active for both properties (cache fallback active)
- WhatsApp: token active (expires ~2026-06-03)
- Anthropic: credits active, claude-sonnet-4-6 operational
- property_knowledge: 40 entries in Supabase

## ⚠️ Pending Actions (manual — cannot be automated)

### 1. WhatsApp Reconnection
**Status:** Number DISCONNECTED
**Action:**
1. Go to https://business.facebook.com → WhatsApp → Phone numbers
2. Select +573234392420 → click "Reconnect"
3. Verify WHATSAPP_PHONE_ID in Railway env matches your number ID

### 2. WOMPI_EVENT_SECRET_TAYRONA
**Status:** Pending
**Action:**
1. Go to https://dashboard.wompi.co → Settings → Webhooks
2. Copy "Event secret" for Tayrona account
3. Add to Railway env: `WOMPI_EVENT_SECRET_TAYRONA=...`

### 3. LobbyPMS IP Whitelist
**Status:** IP 18.144.119.47 not whitelisted (changes per deploy)
**Options:**
- **Option A (Recommended):** QuotaGuard Static on Railway Marketplace ($19/mo) — fixed outbound IP
- **Option B:** Contact LobbyPMS support to whitelist Railway IP range
- **Option C:** Self-hosted VPS proxy with fixed IP
**Note:** Agent works with cache fallback while pending

### 4. SMTP Email Configuration
**Status:** Not configured
**Action:**
1. Option A — Gmail App Password: Gmail → Settings → Security → App Passwords
2. Option B — SendGrid (recommended for production): https://sendgrid.com → API Keys
3. Add to Railway env:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxxxxxx
   ```

### 5. WhatsApp Token Renewal (before 2026-06-03)
**Action:**
1. Meta Developer → Your App → WhatsApp → Generate Token
2. Update WHATSAPP_TOKEN in Railway env

## Frontend Deployment (Railway)

Frontend is served by the backend as a static build. To deploy:
```bash
# 1. Build frontend
cd frontend && npm run build

# 2. Commit dist/ OR let Railway build it
# Railway command: cd frontend && npm run build && cd ../backend && npm start

# 3. Verify
curl https://revio-app-production.up.railway.app/health
```

## Environment Variables (Railway)

All must be set in Railway dashboard → Environment:
```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://apghalkivuvyhbmethxk.supabase.co
SUPABASE_SERVICE_KEY=...
ANTHROPIC_API_KEY=...
LOBBY_TOKEN_ISLA_PALMA=...
LOBBY_TOKEN_TAYRONA=...
WOMPI_PUBLIC_KEY_ISLA=...
WOMPI_PRIVATE_KEY_ISLA=...
WOMPI_EVENT_SECRET_ISLA=...
WOMPI_PUBLIC_KEY_TAYRONA=...
WOMPI_PRIVATE_KEY_TAYRONA=...
WOMPI_EVENT_SECRET_TAYRONA=PENDING
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
SMTP_HOST=PENDING
SMTP_PORT=587
SMTP_USER=PENDING
SMTP_PASS=PENDING
FRONTEND_URL=https://revio-app-production.up.railway.app
JWT_SECRET=...
```

## Quick Health Checks

```bash
# Backend health
curl https://revio-app-production.up.railway.app/health

# Login test
curl -X POST https://revio-app-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@misticatech.co","password":"MisticaTech2026!"}'

# Full integration tests
node backend/src/tests/integration-tests.js
```

## Database — Pending Migrations

Run in Supabase SQL Editor (project: apghalkivuvyhbmethxk):
1. `backend/supabase/migration_003_escalations.sql`
2. `backend/supabase/migration_005_settings.sql`
3. `backend/supabase/migration_006_saas_tables.sql`
4. `backend/supabase/migration_007_health_reports.sql`

## Architecture Notes

- **ESM only:** All files use `import/export`, never `require()`
- **Port:** Always 3001 (never change)
- **Auth:** `requireAuth` for `/api/dashboard/*`, `requireSuperadminAuth` for `/api/sa/*`
- **Multi-tenant:** Credentials in DB via `connectionService.js` (v1.9)
- **No password hashing:** By design (client decision)
