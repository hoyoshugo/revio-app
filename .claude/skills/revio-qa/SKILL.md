---
name: revio-qa
description: |
  Testing y QA de Revio. 15/15 tests de integracion pasando.
  Pendiente: tests unitarios con Vitest y E2E con Playwright.
  Activar cuando se trabaje en tests, QA, cobertura, regresion.
triggers:
  - testing
  - pruebas
  - QA
  - E2E
  - unit test
  - Playwright
  - Vitest
  - regresion
  - cobertura
status: integracion-ok-unit-pendiente
priority: P1
---

# Revio QA

## Estado actual
- integration-tests.js: 15/15 tests pasando
- Tests unitarios: PENDIENTE (Vitest instalado en 2026-04-05)
- Tests E2E: PENDIENTE (Playwright instalado en 2026-04-05)

## Tests de integracion existentes
```bash
node backend/src/tests/integration-tests.js
```
Cubre: health check, auth, dashboard, Meta webhook, agente IA,
Wompi x2, WhatsApp token/phone, Anthropic.

## Tests unitarios con Vitest
```javascript
// backend/src/tests/unit/hotelAgent.test.js
import { describe, it, expect, vi } from 'vitest';
import { processMessage } from '../../agents/hotelAgent.js';

describe('hotelAgent', () => {
  it('responde en espanol por defecto', async () => {
    const result = await processMessage({
      message: 'Hola, quiero reservar',
      language: 'es',
      propertyId: 'test-property',
    });
    expect(result.response).toBeDefined();
    expect(result.language).toBe('es');
  });

  it('escala cuando el cliente pide hablar con humano', async () => {
    const result = await processMessage({
      message: 'Quiero hablar con una persona',
      propertyId: 'test-property',
    });
    expect(result.shouldEscalate).toBe(true);
  });
});
```

## Tests E2E con Playwright
```javascript
// tests/e2e/booking-flow.spec.js
import { test, expect } from '@playwright/test';

test('flujo completo de reserva', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('[data-testid="open-chat"]');
  await page.fill('[data-testid="chat-input"]', 'Quiero reservar para 2 personas');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="agent-response"]')).toBeVisible();
});
```

## Cobertura objetivo
- Revenue Agent: 90% (produccion)
- PMS: 85% (critico -- maneja dinero)
- Contable: 95% (critico -- DIAN)
- Otros modulos: 70%

## Comandos
```bash
# Tests integracion (ya funcionan)
node backend/src/tests/integration-tests.js

# Tests unitarios Vitest (una vez escritos)
cd backend && npx vitest run

# Tests E2E Playwright
npx playwright test

# Cobertura
cd backend && npx vitest run --coverage
```
