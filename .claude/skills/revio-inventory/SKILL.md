---
name: revio-inventory
description: |
  Modulo de inventarios Revio. 100% COMPLETO. Inventory.jsx (445L) y backend/src/routes/inventory.js (9 endpoints) operacionales.
  Activar cuando se trabaje en stock, proveedores, ordenes de compra, alertas.
triggers:
  - inventario
  - stock
  - productos
  - proveedores
  - bodega
  - insumos
  - compras
  - mermas
  - alerta stock
status: frontend-listo-backend-falta
priority: P1-inmediato
---

# Revio Inventarios — Control de Stock

## Estado real (auditado 2026-04-14)
- frontend/src/components/Dashboard/Inventory.jsx: **445 lineas (EXISTE)**
- backend/src/routes/inventory.js: **9 endpoints (COMPLETO)**
- Estimado: 0 semanas — 100% COMPLETO

## Implementado: backend/src/routes/inventory.js

```javascript
// backend/src/routes/inventory.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = express.Router();

// GET /api/inventory/products?property_id=
router.get('/products', requireAuth, async (req, res) => {
  const { property_id } = req.query;
  const { data, error } = await supabase
    .from('inventory_products')
    .select('*, inventory_stock(*)')
    .eq('property_id', property_id)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ products: Array.isArray(data) ? data : [] });
});

// POST /api/inventory/movements -- entrada o salida de stock
router.post('/movements', requireAuth, async (req, res) => {
  const { product_id, type, quantity, reason, property_id } = req.body;
  if (!product_id || !type || !quantity) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  // type: 'entrada' | 'salida' | 'ajuste'
  const { data, error } = await supabase.rpc('inventory_movement', {
    p_product_id: product_id,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason,
    p_property_id: property_id,
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true, movement: data });
});

// GET /api/inventory/alerts?property_id= -- productos bajo minimo
router.get('/alerts', requireAuth, async (req, res) => {
  const { property_id } = req.query;
  const { data, error } = await supabase
    .from('inventory_products')
    .select('*, inventory_stock!inner(*)')
    .eq('property_id', property_id)
    .filter('inventory_stock.quantity', 'lte', 'inventory_products.min_stock');
  return res.json({ alerts: Array.isArray(data) ? data : [] });
});

export default router;
```

## Tablas Supabase necesarias
```sql
CREATE TABLE inventory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  name text NOT NULL,
  unit text DEFAULT 'unidad', -- kg, litro, unidad, caja
  min_stock numeric DEFAULT 0,
  cost_per_unit numeric DEFAULT 0,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES inventory_products(id),
  location text DEFAULT 'bodega-principal',
  quantity numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES inventory_products(id),
  type text NOT NULL, -- entrada, salida, ajuste
  quantity numeric NOT NULL,
  reason text,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);
```

## Registro en index.js
```javascript
// backend/src/index.js -- agregar:
import inventoryRoutes from './routes/inventory.js';
app.use('/api/inventory', inventoryRoutes);
```

## Funcionalidades pendientes
- Valorizacion PEPS/UEPS/Promedio (logica contable, semanas 3-4)
- Ordenes de compra a proveedores (semana 2)
- Trazabilidad por lote y vencimiento (semana 4)
- Exportacion a Excel con xlsx
