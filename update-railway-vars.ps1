# ============================================================
# RAILWAY VARIABLES UPDATE — Ejecutar después de 'railway login'
# ============================================================
# Uso:
#   railway login
#   .\update-railway-vars.ps1

$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZ2hhbGtpdnV2eWhibWV0aHhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE1ODg4NiwiZXhwIjoyMDkwNzM0ODg2fQ.95JUmFGR_o7Ry05cxU4JFQtPCuc-yQZhX6IPQJlM6Jo"

# OPCIONAL: Para que la migración_009 se ejecute automáticamente en el próximo deploy,
# agrega también la SUPABASE_DB_URL (la encuentras en Supabase → Settings → Database → URI)
# $DB_URL = "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

Write-Host "Actualizando variables en Railway..." -ForegroundColor Cyan

railway variables set "SUPABASE_SERVICE_KEY=$SERVICE_KEY" `
  --service revio-app `
  --environment production

# Si tienes la DB URL, descomenta estas líneas:
# railway variables set "SUPABASE_DB_URL=$DB_URL" `
#   --service revio-app `
#   --environment production

Write-Host ""
Write-Host "Verificando..." -ForegroundColor Yellow
railway variables --service revio-app | Select-String "SUPABASE_SERVICE"

Write-Host ""
Write-Host "Redesplegando..." -ForegroundColor Yellow
railway redeploy --service revio-app

Write-Host ""
Write-Host "Done! El backend se redesplegara con el service_role key correcto." -ForegroundColor Green
Write-Host "Espera 2-3 min y verifica: https://revio-app-production.up.railway.app/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Nota: Si agregas SUPABASE_DB_URL, la tabla property_knowledge" -ForegroundColor DarkGray
Write-Host "      se creara automaticamente en el siguiente deploy." -ForegroundColor DarkGray
