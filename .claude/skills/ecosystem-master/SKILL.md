---
name: ecosystem-master
description: |
  Orquestador maestro del ecosistema 3H Enterprise. Conoce TODOS los proyectos
  activos, su estado y como coordinarse entre ellos. Activar cuando el usuario
  pida trabajo que involucre multiples proyectos o vision global del ecosistema.
triggers:
  - ecosistema
  - todos los proyectos
  - enjambre
  - swarm
  - coordinacion
  - arquitectura global
  - 3H Enterprise
  - vision global
version: 2.0.0
author: 3H Enterprise SAS
---

# Ecosystem Master Agent

## Empresa
**TRES HACHE ENTERPRISE SAS**
- NIT: 901696556-6
- Email: info@treshache.co
- Propietario: Hugo Hoyos

## Proyectos activos

### 1. Revio — Revenue Agent SaaS (produccion)
- Path: mystica-ai-agent/
- URL: https://revio-app-production.up.railway.app
- GitHub: github.com/hoyoshugo/revio-app
- Estado: 26/26 tests pasando (2026-04-14)
- Stack: Node.js ESM + React 18 + Supabase + Railway
- Version: v2.3

### 2. Caribbean Treasures Next.js
- Path: caribbean-treasures-nextjs/
- Stack: Next.js 16.2.2 + React 19.2.4 + Supabase + Wompi

### 3. Caribbean Treasures Velo
- Path: caribbean-treasures-velo/
- Stack: Wix Editor + Velo (NO npm, NO node)

### 4. Trading Agent
- Path: trading-agent/
- Stack: Python 3.11 + IBKR + Claude API

### 5. Gastro Inventory (nuevo — detectado 2026-04-05)
- Path: gastro-inventory/
- Stack: por verificar

## Modulos del ecosistema Revio

| Modulo | Estado | Prioridad | Skill |
|--------|--------|-----------|-------|
| Revenue Agent | Produccion | P0 | revio-master |
| PMS Hotelero | Avanzado 35% | P1 | revio-pms |
| Inventarios | COMPLETO (9 endpoints) | P1 | revio-inventory |
| Contable (Siigo) | Planificado | P2 | revio-accounting |
| Financiero | Planificado | P2 | revio-financial |
| Marketing IA | Planificado | P2 | revio-marketing |
| NFC Ventas | Planificado | P3 | revio-nfc |

## Reglas de coordinacion entre proyectos
1. NUNCA modificar un proyecto desde el contexto de otro
2. Cada proyecto tiene su propio CLAUDE.md con contexto
3. Antes de trabajar en un modulo, leer su skill especifico
4. Los datos de clientes SIEMPRE en Supabase, nunca en codigo
5. Cada modulo es independiente — un cliente puede comprar solo los que necesita

## Stack comun a todos los proyectos Node.js
- Node.js 22 ESM (backend) — imports con .js obligatorio
- React 18 + Vite + Tailwind (frontend Revio)
- Supabase PostgreSQL (BD)
- Railway (deploy)

## Comandos globales
```bash
# Health check Revio produccion
curl https://revio-app-production.up.railway.app/health

# Tests Revio
node mystica-ai-agent/backend/src/tests/integration-tests.js

# Deploy Revio (autodeploy en push)
cd mystica-ai-agent && git push origin main
```
