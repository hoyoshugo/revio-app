---
name: revio-accounting
description: |
  Modulo Contable Revio. 5% completo. El mas complejo del ecosistema (10/10).
  Bloqueante principal: habilitacion DIAN (4-8 semanas burocraticas).
  Activar cuando se trabaje en facturas DIAN, PUC, nomina, IVA, impuestos.
  ACCION INMEDIATA: iniciar habilitacion en muisca.dian.gov.co HOY.
triggers:
  - contabilidad
  - PUC
  - DIAN
  - IVA
  - retencion
  - nomina
  - balance
  - estado de resultados
  - activos fijos
  - exogena
  - factura electronica
status: inicio-5pct
priority: P2-iniciar-habilitacion-dian-hoy
---

# Revio Contable — Sistema Contable Colombia

## Estado real
- backend/src/routes/invoices.js: 159 lineas (basico)
- backend/src/routes/pos.js: 325 lineas (POS con pagos)
- **TOTAL: 5% completo — el mas complejo de todos los modulos**

## BLOQUEANTE CRITICO: Habilitacion DIAN

```
PROCESO DE HABILITACION (iniciar HOY):
1. Ir a: https://muisca.dian.gov.co
2. Registrarse como facturador electronico
3. Obtener certificado digital:
   - Certicamara: ~$500.000 COP/ano
   - Andes SCD: similar precio
4. Descargar set de pruebas DIAN
5. Enviar facturas de prueba (mimimum 3 exitosas)
6. Solicitar habilitacion en produccion
   ESPERA: 4-8 semanas tipicamente
7. Recibir ResolucionNumber para comenzar a facturar

SIN ESTA HABILITACION: no se puede facturar electronicamente en Colombia
```

## Componentes tecnicos

### XML UBL 2.1 (formato DIAN)
```javascript
// El formato es muy estricto -- usar libreria validada
// npm install xml2js
const buildInvoiceXML = (invoice) => {
  return {
    Invoice: {
      _attributes: { xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2' },
      ID: invoice.number,
      IssueDate: invoice.date,
      InvoiceTypeCode: '01', // Factura de venta
      DocumentCurrencyCode: 'COP',
      // ... muchos campos mas
    }
  };
};
```

### PUC Colombia (Plan Unico de Cuentas)
```javascript
// Seeder de PUC completo (~500 cuentas)
const PUC = [
  { code: '1105', name: 'Caja general', type: 'activo', nature: 'debito' },
  { code: '1110', name: 'Bancos', type: 'activo', nature: 'debito' },
  { code: '1305', name: 'Clientes', type: 'activo', nature: 'debito' },
  // ... 500+ cuentas mas
];
```

### Motor contable doble partida
```javascript
// Cada transaccion tiene debitos = creditos
const createJournalEntry = async (entries) => {
  const total = entries.reduce((sum, e) => sum + (e.debit - e.credit), 0);
  if (Math.abs(total) > 0.01) throw new Error('Asiento no cuadra');
  // Insertar en accounting_entries
};
```

## Tablas necesarias
```sql
-- Mas de 8 tablas: accounts, entries, entry_lines, invoices,
-- invoice_items, tax_configs, payroll, assets, asset_depreciation
```

## Integracion con modulos
- PMS: genera asiento automatico por cada reserva pagada
- POS/NFC: cada venta genera asiento de caja
- Inventarios: valorizacion de mermas y movimientos

## Tiempo estimado
- Sin enjambre: 16-28 semanas
- Con enjambre: 12 semanas
- Bloqueante: habilitacion DIAN (proceso independiente del desarrollo)

## Accion inmediata HOY
1. Abrir muisca.dian.gov.co con NIT 901696556-6
2. Registrar como facturador electronico
3. Cotizar certificado digital (Certicamara)
4. Iniciar el proceso aunque el modulo no este desarrollado aun
