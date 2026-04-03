#!/usr/bin/env bash
# ============================================================
# MÍSTICA AI AGENT — Railway Deployment Script
# Ejecutar: bash deploy-railway.sh
# Requiere: railway CLI instalado + railway login completado
# ============================================================
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "🌊 Mística AI Agent — Deploy a Railway"
echo "========================================"

# Verificar Railway CLI
if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI no instalado. Instalar con: npm i -g @railway/cli"
  exit 1
fi

# Verificar login
railway whoami 2>/dev/null || {
  echo "❌ No estás logueado en Railway. Ejecuta: railway login"
  exit 1
}

echo ""
echo "📦 Creando proyecto en Railway..."
echo "   (Si ya existe, selecciona el proyecto existente)"

# ============================================================
# BACKEND
# ============================================================
echo ""
echo "🔧 Desplegando BACKEND..."
cd "$BACKEND"

# Crear servicio backend
railway service create mystica-backend 2>/dev/null || echo "   Servicio ya existe"
railway link 2>/dev/null || true

# Set env vars para backend
echo "   Configurando variables de entorno..."
railway variables set \
  NODE_ENV=production \
  PORT=3001 \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  JWT_SECRET="$JWT_SECRET" \
  SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-admin@misticatech.co}" \
  SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-MisticaTech2026!}" \
  JWT_SUPERADMIN_SECRET="${JWT_SUPERADMIN_SECRET:-MisticaTech2026SuperAdminSecretKey_XK9m}" \
  LOBBY_TOKEN_ISLA_PALMA="$LOBBY_TOKEN_ISLA_PALMA" \
  LOBBY_TOKEN_TAYRONA="$LOBBY_TOKEN_TAYRONA" \
  LOBBY_API_URL="${LOBBY_API_URL:-https://api.lobbypms.com}" \
  WOMPI_PUBLIC_KEY_ISLA="$WOMPI_PUBLIC_KEY_ISLA" \
  WOMPI_PRIVATE_KEY_ISLA="$WOMPI_PRIVATE_KEY_ISLA" \
  WOMPI_PUBLIC_KEY_TAYRONA="$WOMPI_PUBLIC_KEY_TAYRONA" \
  WOMPI_PRIVATE_KEY_TAYRONA="$WOMPI_PRIVATE_KEY_TAYRONA" \
  WOMPI_API_URL="${WOMPI_API_URL:-https://production.wompi.co/v1}" \
  WHATSAPP_NUMBER="${WHATSAPP_NUMBER:-+573234392420}" \
  WHATSAPP_TOKEN="${WHATSAPP_TOKEN:-pendiente}" \
  WHATSAPP_API_URL="${WHATSAPP_API_URL:-https://graph.facebook.com/v18.0}" \
  WHATSAPP_PHONE_ID="${WHATSAPP_PHONE_ID:-pendiente}" \
  ALERT_WHATSAPP="${ALERT_WHATSAPP:-+573234392420}" \
  LEARNING_WHATSAPP_1="${LEARNING_WHATSAPP_1:-+573057673770}" \
  LEARNING_WHATSAPP_2="${LEARNING_WHATSAPP_2:-+573006526427}" \
  ESCALATION_WHATSAPP_1="${ESCALATION_WHATSAPP_1:-+573057673770}" \
  ESCALATION_WHATSAPP_2="${ESCALATION_WHATSAPP_2:-+573006526427}" \
  META_VERIFY_TOKEN="${META_VERIFY_TOKEN:-mystica_webhook_2026}" \
  META_APP_SECRET="${META_APP_SECRET:-pendiente}" \
  EMAIL_FROM="${EMAIL_FROM:-Mística Tech <noreply@misticatech.co>}" 2>&1 | tail -3

echo "   Desplegando..."
railway up --detach

BACKEND_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "pendiente")
echo "   ✅ Backend URL: $BACKEND_URL"

# ============================================================
# FRONTEND
# ============================================================
echo ""
echo "🎨 Desplegando FRONTEND..."
cd "$FRONTEND"

# Crear servicio frontend
railway service create mystica-frontend 2>/dev/null || echo "   Servicio ya existe"

# Set VITE_API_URL para que el frontend apunte al backend en producción
railway variables set \
  VITE_API_URL="$BACKEND_URL" \
  NODE_ENV=production 2>&1 | tail -2

# Build y deploy
npm run build
railway up --detach

FRONTEND_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "pendiente")
echo "   ✅ Frontend URL: $FRONTEND_URL"

# ============================================================
# RESULTADO FINAL
# ============================================================
echo ""
echo "========================================"
echo "🌊 MÍSTICA AI AGENT — DESPLEGADO"
echo "========================================"
echo ""
echo "🔗 Dashboard:     $FRONTEND_URL"
echo "🔗 API Backend:   $BACKEND_URL"
echo "🔗 Health check:  $BACKEND_URL/health"
echo "🔗 Super Admin:   $FRONTEND_URL/superadmin/login"
echo ""
echo "📋 Credenciales:"
echo "   Superadmin: admin@misticatech.co / MisticaTech2026!"
echo ""
echo "⚠️  Pendiente configuración manual:"
echo "   1. WHATSAPP_TOKEN — obtener de Meta Business"
echo "   2. WHATSAPP_PHONE_ID — del panel de WhatsApp Business"
echo "   3. Configurar webhooks de Meta → $BACKEND_URL/api/social/webhook/meta"
echo "   4. APIs OTAs (Booking, Airbnb, etc) — requieren partnerships"
echo "========================================"
