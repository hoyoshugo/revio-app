Write-Host "Iniciando Revio..." -ForegroundColor Cyan
Write-Host ""

# Kill existing processes
try { npx kill-port 3001 2>$null | Out-Null } catch {}
try { npx kill-port 5173 2>$null | Out-Null } catch {}
Start-Sleep -Seconds 1

$ROOT = "C:\Users\hoyos\OneDrive\Documentos\PROYECTOS CLAUDE\mystica-ai-agent"

# Start backend
Write-Host "Iniciando backend (puerto 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$ROOT\backend'; npm run dev`""

Start-Sleep -Seconds 3

# Start frontend
Write-Host "Iniciando frontend (puerto 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"Set-Location '$ROOT\frontend'; npm run dev`""

Start-Sleep -Seconds 4

# Open browser
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Revio iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "  SuperAdmin:  http://localhost:5173/superadmin/login" -ForegroundColor Cyan
Write-Host "  Health:      http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "  Produccion:  https://revio-app-production.up.railway.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tests: node backend/src/tests/integration-tests.js" -ForegroundColor DarkGray
Write-Host ""
