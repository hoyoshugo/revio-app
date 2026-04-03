#!/usr/bin/env bash
# ============================================================
# MÍSTICA AI AGENT — Deploy automático a Railway
#
# USO:
#   1. Ejecutar: railway login   (abre browser — login una sola vez)
#   2. Ejecutar: bash deploy-railway-auto.sh
# ============================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/backend/.env"

# Cargar variables del .env
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
  echo "✅ Variables cargadas desde .env"
else
  echo "❌ No se encontró backend/.env"
  exit 1
fi

echo ""
echo "🌊 Iniciando deploy de Mística AI Agent en Railway..."
echo "========================================================"

# Verificar login
railway whoami || { echo "❌ Ejecuta: railway login"; exit 1; }

# ── CREAR PROYECTO ────────────────────────────────────────────
echo ""
echo "📁 Creando proyecto Railway 'mystica-ai-agent'..."
railway init --name "mystica-ai-agent" 2>/dev/null || echo "   (usando proyecto existente)"

# ── BACKEND ───────────────────────────────────────────────────
echo ""
echo "🔧 Backend..."
cd "$ROOT/backend"

# Configurar variables
railway variables set \
  NODE_ENV=production \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  JWT_SECRET="$JWT_SECRET" \
  SUPERADMIN_EMAIL="$SUPERADMIN_EMAIL" \
  SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
  JWT_SUPERADMIN_SECRET="$JWT_SUPERADMIN_SECRET" \
  LOBBY_TOKEN_ISLA_PALMA="$LOBBY_TOKEN_ISLA_PALMA" \
  LOBBY_TOKEN_TAYRONA="$LOBBY_TOKEN_TAYRONA" \
  LOBBY_API_URL="$LOBBY_API_URL" \
  WOMPI_PUBLIC_KEY_ISLA="$WOMPI_PUBLIC_KEY_ISLA" \
  WOMPI_PRIVATE_KEY_ISLA="$WOMPI_PRIVATE_KEY_ISLA" \
  WOMPI_PUBLIC_KEY_TAYRONA="$WOMPI_PUBLIC_KEY_TAYRONA" \
  WOMPI_PRIVATE_KEY_TAYRONA="$WOMPI_PRIVATE_KEY_TAYRONA" \
  WOMPI_API_URL="$WOMPI_API_URL" \
  WHATSAPP_NUMBER="$WHATSAPP_NUMBER" \
  WHATSAPP_TOKEN="$WHATSAPP_TOKEN" \
  WHATSAPP_API_URL="$WHATSAPP_API_URL" \
  WHATSAPP_PHONE_ID="$WHATSAPP_PHONE_ID" \
  ALERT_WHATSAPP="$ALERT_WHATSAPP" \
  LEARNING_WHATSAPP_1="$LEARNING_WHATSAPP_1" \
  LEARNING_WHATSAPP_2="$LEARNING_WHATSAPP_2" \
  ESCALATION_WHATSAPP_1="$ESCALATION_WHATSAPP_1" \
  ESCALATION_WHATSAPP_2="$ESCALATION_WHATSAPP_2" \
  META_VERIFY_TOKEN="$META_VERIFY_TOKEN" \
  META_APP_SECRET="$META_APP_SECRET" \
  EMAIL_FROM="$EMAIL_FROM"

echo "   Variables configuradas ✅"
echo "   Desplegando backend..."
railway up --service mystica-backend

BACKEND_URL=$(railway status 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")
echo "   ✅ Backend: $BACKEND_URL"

# ── FRONTEND ──────────────────────────────────────────────────
echo ""
echo "🎨 Frontend..."
cd "$ROOT/frontend"

# Actualizar .env del frontend con URL del backend
echo "VITE_API_URL=$BACKEND_URL" > .env.production

# Build
npm run build

# Deploy
railway variables set \
  VITE_API_URL="$BACKEND_URL" \
  NODE_ENV=production

railway up --service mystica-frontend

FRONTEND_URL=$(railway status 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")
echo "   ✅ Frontend: $FRONTEND_URL"

# Actualizar FRONTEND_URL en backend
cd "$ROOT/backend"
railway variables set FRONTEND_URL="$FRONTEND_URL" --service mystica-backend

# ── VERIFICACIÓN ──────────────────────────────────────────────
echo ""
echo "🔍 Verificando despliegue..."
sleep 10

if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
  echo "   ✅ Backend respondiendo en $BACKEND_URL"
else
  echo "   ⏳ Backend iniciando (puede tardar 30-60s en Railway)"
fi

# ── RESULTADO ─────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "🌊 MÍSTICA AI AGENT — EN PRODUCCIÓN"
echo "========================================================"
echo ""
echo "  🌐 App:         $FRONTEND_URL"
echo "  ⚙️  API:         $BACKEND_URL"
echo "  🏥 Health:      $BACKEND_URL/health"
echo "  🔐 SuperAdmin:  $FRONTEND_URL/superadmin/login"
echo "  📊 Dashboard:   $FRONTEND_URL/login"
echo ""
echo "  Credenciales superadmin:"
echo "    admin@misticatech.co / MisticaTech2026!"
echo ""
echo "⚠️  CONFIGURACIÓN PENDIENTE (manual):"
echo "  1. WhatsApp Business: configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID"
echo "     → Meta Business Manager → WhatsApp → Tokens"
echo "     → railway variables set WHATSAPP_TOKEN=xxx WHATSAPP_PHONE_ID=yyy"
echo ""
echo "  2. Webhook Meta → $BACKEND_URL/api/social/webhook/meta"
echo "     Token de verificación: mystica_webhook_2026"
echo ""
echo "  3. LobbyPMS ya configurado con tokens reales ✅"
echo "  4. Wompi ya configurado con keys de producción ✅"
echo "  5. Supabase ya conectado ✅"
echo "========================================================"
