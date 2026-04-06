---
name: swarm-coordinator
description: |
  Coordinador del enjambre de agentes en Revio. Orquesta modulos en paralelo.
  Activar cuando se quiera trabajar en varios modulos simultaneamente.
triggers:
  - swarm
  - enjambre
  - multiples sesiones
  - paralelizar
  - coordinar agentes
  - sub-agentes
  - velocidad exponencial
status: activo
priority: P0
---

# Swarm Coordinator — Revio

## Como usar el enjambre en paralelo

### Sesiones simultaneas recomendadas
```
Sesion 1: Revenue Agent (P0 — produccion)
Sesion 2: Inventarios backend (P1 — 1.5 semanas)
Sesion 3: PMS tarifas dinamicas (P1 — paralelo)
Sesion 4: QA + Testing (siempre activo)
```

### Protocolo de trabajo
1. Cada sesion lee su skill antes de empezar
2. Los cambios se sincronizan via GitHub (git pull antes de empezar)
3. Railway despliega automaticamente en cada push
4. Nunca dos sesiones modificando el mismo archivo

### Reglas del enjambre
- NUNCA dos sesiones en el mismo archivo simultaneamente
- SIEMPRE hacer git pull antes de empezar
- SIEMPRE hacer commit y push al terminar
- Usar ramas git por modulo:
  - git checkout -b module/inventory
  - git checkout -b module/pms-rates
  - git checkout -b module/pos-frontend

### Skills por modulo
```
.claude/skills/revio-inventory/   -- 1.5 semanas (P1 inmediato)
.claude/skills/revio-pms/         -- 5 semanas (P1)
.claude/skills/revio-nfc/         -- 2 semanas (P1, 55% hecho)
.claude/skills/revio-accounting/  -- 12 semanas (DIAN bloqueante)
.claude/skills/revio-marketing/   -- 4 semanas (Meta review primero)
.claude/skills/revio-financial/   -- 4 semanas (despues de contable)
```

## Velocidad exponencial

```
1 agente secuencial = 44 semanas para todo el ecosistema
4 agentes paralelos = ~12 semanas para todo el ecosistema
Factor de velocidad: ~3.6x
```

Especializar un agente por modulo = 5x mas rapido (no necesita leer contexto ajeno)
Trabajar en paralelo = 3-4x mas velocidad
**Total estimado: ~15x mas velocidad con enjambre especializado vs agente generico**

## Orden optimo del enjambre (AHORA)

```
HOY — Sesion 1:
  skill: revio-inventory
  tarea: crear backend/src/routes/inventory.js
  tiempo: 1-2 dias

HOY — Sesion 2:
  skill: revio-nfc
  tarea: completar PWA offline para meseros
  tiempo: 2-3 dias

Semana 1-2 — Sesion 1:
  skill: revio-pms
  tarea: motor de tarifas dinamicas
  tiempo: 2 semanas

Semana 1-2 — Sesion 2:
  skill: revio-accounting
  tarea: iniciar proceso DIAN (burocracia, no codigo)
  + PUC seeder + tablas base
```
