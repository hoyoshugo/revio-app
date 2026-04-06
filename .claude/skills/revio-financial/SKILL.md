---
name: revio-financial
description: |
  Modulo Financiero Revio. 0% completo. Depende de modulo Contable.
  KPIs, presupuestos, flujo de caja, VPN/TIR, narrativa IA.
  No iniciar hasta que Contable tenga al menos 40% de avance.
triggers:
  - financiero
  - presupuesto
  - flujo caja
  - VPN
  - TIR
  - ROI
  - KPIs financieros
  - proyecciones
  - evaluacion proyectos
status: sin-iniciar-depende-contable
priority: P2
---

# Revio Financiero

## Estado: 0% completo | Depende de Modulo Contable

## Funcionalidades principales

### Dashboard de KPIs en tiempo real
```javascript
// KPIs hoteleros + financieros integrados
const KPI_DEFINITIONS = {
  // Hoteleros (datos del PMS)
  revpar: { formula: 'revenue / available_rooms', label: 'RevPAR' },
  adr:    { formula: 'revenue / occupied_rooms', label: 'ADR' },
  occupancy: { formula: 'occupied_rooms / available_rooms * 100', label: 'Ocupacion %' },
  // Financieros (datos del modulo Contable)
  liquidity: { formula: 'current_assets / current_liabilities', label: 'Razon corriente' },
  roe:        { formula: 'net_income / equity * 100', label: 'ROE %' },
  ebitda:     { formula: 'operating_income + depreciation', label: 'EBITDA' },
};
```

### Narrativa IA de resultados
```javascript
// Genera texto ejecutivo automaticamente con Claude
const generateNarrativeReport = async (kpis, previousPeriod) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{
      role: 'user',
      content: `Genera un informe ejecutivo en espanol de estos KPIs hoteleros:
        Periodo actual: ${JSON.stringify(kpis)}
        Periodo anterior: ${JSON.stringify(previousPeriod)}
        Identifica tendencias, alertas y recomendaciones. Max 300 palabras.`
    }]
  });
  return response.content[0].text;
};
```

### Evaluacion financiera de proyectos
```javascript
// VPN, TIR, Payback
const evaluateProject = (cashFlows, discountRate) => {
  const npv = cashFlows.reduce((sum, cf, year) =>
    sum + cf / Math.pow(1 + discountRate, year), 0);

  // TIR por iteracion (Newton-Raphson)
  let irr = 0.1;
  for (let i = 0; i < 1000; i++) {
    const npvAtRate = cashFlows.reduce((s, cf, y) => s + cf / Math.pow(1 + irr, y), 0);
    if (Math.abs(npvAtRate) < 0.01) break;
    irr -= npvAtRate / cashFlows.length * 0.1;
  }

  const payback = cashFlows.findIndex((_, i) =>
    cashFlows.slice(0, i+1).reduce((a,b) => a+b, 0) >= 0);

  return { npv, irr: irr * 100, paybackPeriods: payback };
};
```

## Dependencia critica
El modulo Financiero necesita datos del modulo Contable para:
- Balance General (activos, pasivos, patrimonio)
- Estado de Resultados (ingresos, costos, utilidad)
- Flujo de Caja real
NO DESARROLLAR hasta que Contable tenga al menos 40% de avance.

## Tiempo estimado
- 6-10 semanas sin swarm
- 4 semanas con swarm
