# REVIO — Analisis de Complejidad y Roadmap
Generado: 2026-04-05 | Base: 32.365 lineas de codigo real auditado

## Estado del codigo actual

| Area | Lineas |
|------|--------|
| Backend (src/) | 12.989 |
| Frontend (src/) | 19.376 |
| **TOTAL** | **32.365** |

## Analisis de modulos con datos reales

| Modulo | Estado | Progreso | Lineas existentes | Dificultad | Sin swarm | Con swarm |
|--------|--------|----------|-------------------|-----------|-----------|-----------|
| Revenue Agent | Produccion | 90% | 2.480 | 6/10 | listo | listo |
| PMS Hotelero | Avanzado | 35% | 1.907 | 8/10 | 8-12 sem | 5 sem |
| Wallets/NFC | Muy avanzado | 55% | 785 | 7/10 | 3-5 sem | 2 sem |
| POS Terminal | Backend OK | 45% | 325 | 4/10 | 1-2 sem | 1 sem |
| Inventarios | Frontend OK | 20% | 445 | 5/10 | 2-3 sem | 1.5 sem |
| Marketing IA | Sin iniciar | 0% | 0 | 7/10 | 6-10 sem | 4 sem |
| Financiero | Sin iniciar | 0% | 0 | 7/10 | 6-10 sem | 4 sem |
| Contable | Inicio | 5% | 159 | 10/10 | 16-28 sem | 12 sem |

**Total acumulado:** 44 sem sin swarm / 30 sem con swarm (reduccion ~32%)

## Sorpresas del audit vs estimacion inicial

| Modulo | Estimado | Real | Diferencia |
|--------|----------|------|-----------|
| PMS | 8% | 35% | +27% -- GanttCalendar 690L, GuestDetail 588L |
| Wallets/NFC | 0% | 55% | +55% -- WalletPanel 549L ya existe |
| POS Terminal | 0% | 45% | +45% -- pos.js 325L completo |
| Inventarios | 25% | 20% | -5% -- backend (inventory.js) falta |

## Orden de desarrollo recomendado

1. **HOY**: Vender Revenue Agent (90% completo)
2. **Semana 1**: Inventarios backend (routes/inventory.js, 1.5 semanas)
3. **Semanas 1-2**: POS Terminal frontend completo
4. **Semanas 2-6**: PMS completar (tarifas dinamicas, DIAN, channel manager)
5. **Semanas 3-5**: Wallets/NFC completar (NFC real + PWA meseros)
6. **Semanas 6-10**: Marketing IA (Meta API + Google Ads)
7. **Ultimo**: Contable DIAN (el mas complejo, iniciar habilitacion HOY)

## Bloqueantes criticos

| Bloqueante | Modulo | Tiempo de espera | Accion |
|-----------|--------|-----------------|--------|
| DIAN habilitacion | Contable | 4-8 semanas burocracia | Iniciar HOY |
| WhatsApp OTP | Revenue Agent | Inmediato (manual) | Hacer hoy |
| Meta API review | Marketing | 2-4 semanas | Iniciar antes de desarrollar |
| NFC hardware | Wallets | Inmediato | Conseguir dispositivo |

## Accion mas valiosa hoy

Conseguir el primer cliente pagador de Revenue Agent.
- Precio sugerido: $299.000 COP/mes (Plan Basico)
- 1 cliente cubre el costo de Railway en 2 meses
- Revenue Agent ya funciona al 90% -- suficiente para demostrar valor

## Rutas de archivos clave auditados

```
backend/src/agents/hotelAgent.js       -- 617 lineas (Revenue Agent core)
backend/src/routes/superadmin.js       -- 707 lineas (admin)
backend/src/routes/dashboard.js        -- 414 lineas (metricas)
frontend/src/components/Dashboard/GanttCalendar.jsx -- 690 lineas (PMS)
frontend/src/components/Dashboard/GuestDetail.jsx   -- 588 lineas (PMS)
frontend/src/components/Dashboard/WalletPanel.jsx   -- 549 lineas (NFC)
frontend/src/components/Dashboard/SandboxPanel.jsx  -- 408 lineas (IA)
backend/src/routes/pos.js              -- 325 lineas (POS)
frontend/src/components/Dashboard/Inventory.jsx     -- 445 lineas (stock)
```
