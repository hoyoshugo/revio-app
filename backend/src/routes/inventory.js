import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/inventory/items ─────────────────────────────────────
// Lista items con filtros opcionales: categoria, bodega, stock_min
router.get('/items', requireAuth, async (req, res) => {
  const { property_id, categoria, bodega, stock_min } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase
      .from('inventory_items')
      .select('*')
      .eq('property_id', pid)
      .eq('is_active', true)
      .order('nombre', { ascending: true });

    if (categoria) q = q.eq('categoria', categoria);
    if (bodega) q = q.eq('bodega', bodega);
    if (stock_min === 'true') q = q.filter('stock_actual', 'lte', supabase.raw('stock_minimo'));

    const { data, error } = await q;
    if (error) throw error;
    res.json({ items: Array.isArray(data) ? data : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/inventory/items/:id ─────────────────────────────────
router.get('/items/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const pid = req.user.property_id;
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('property_id', pid)
      .eq('is_active', true)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item no encontrado' });
    res.json({ item: data });
  } catch (err) {
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Item no encontrado' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/inventory/items ────────────────────────────────────
// Crear nuevo item de inventario
router.post('/items', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { nombre, sku, categoria, stock_actual, stock_minimo, precio_costo, bodega, proveedor } = req.body;

  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        property_id: pid,
        nombre,
        sku: sku || null,
        categoria: categoria || 'General',
        stock_actual: stock_actual ?? 0,
        stock_minimo: stock_minimo ?? 0,
        precio_costo: precio_costo ?? 0,
        bodega: bodega || null,
        proveedor: proveedor || null,
        is_active: true
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/inventory/items/:id ─────────────────────────────────
router.put('/items/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const pid = req.user.property_id;
  const { nombre, sku, categoria, stock_actual, stock_minimo, precio_costo, bodega, proveedor } = req.body;

  try {
    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (sku !== undefined) updates.sku = sku;
    if (categoria !== undefined) updates.categoria = categoria;
    if (stock_actual !== undefined) updates.stock_actual = stock_actual;
    if (stock_minimo !== undefined) updates.stock_minimo = stock_minimo;
    if (precio_costo !== undefined) updates.precio_costo = precio_costo;
    if (bodega !== undefined) updates.bodega = bodega;
    if (proveedor !== undefined) updates.proveedor = proveedor;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .eq('property_id', pid)
      .eq('is_active', true)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item no encontrado' });
    res.json({ item: data });
  } catch (err) {
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Item no encontrado' });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/inventory/items/:id ──────────────────────────────
// Soft delete: marca is_active = false
router.delete('/items/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const pid = req.user.property_id;
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('property_id', pid)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item no encontrado' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Item no encontrado' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/inventory/movements ────────────────────────────────
// Registrar movimiento (entrada/salida/ajuste) y actualizar stock
router.post('/movements', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { item_id, tipo, cantidad, motivo, user_id } = req.body;

  if (!item_id || !tipo || cantidad === undefined) {
    return res.status(400).json({ error: 'item_id, tipo y cantidad son requeridos' });
  }
  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser: entrada, salida o ajuste' });
  }
  if (typeof cantidad !== 'number' || cantidad === 0) {
    return res.status(400).json({ error: 'cantidad debe ser un numero distinto de cero' });
  }

  try {
    // Obtener stock actual del item (verificar que pertenece al property)
    const { data: item, error: itemErr } = await supabase
      .from('inventory_items')
      .select('id, stock_actual, nombre')
      .eq('id', item_id)
      .eq('property_id', pid)
      .eq('is_active', true)
      .single();
    if (itemErr || !item) return res.status(404).json({ error: 'Item no encontrado' });

    // Calcular nuevo stock
    let nuevo_stock;
    if (tipo === 'ajuste') {
      nuevo_stock = cantidad; // ajuste = setea el valor absoluto
    } else if (tipo === 'entrada') {
      nuevo_stock = item.stock_actual + cantidad;
    } else {
      // salida
      nuevo_stock = item.stock_actual - cantidad;
      if (nuevo_stock < 0) return res.status(400).json({ error: 'Stock insuficiente' });
    }

    // Registrar movimiento
    const { data: movement, error: movErr } = await supabase
      .from('inventory_movements')
      .insert({
        property_id: pid,
        item_id,
        tipo,
        cantidad,
        stock_anterior: item.stock_actual,
        stock_nuevo: nuevo_stock,
        motivo: motivo || null,
        user_id: user_id || req.user.id || null
      })
      .select()
      .single();
    if (movErr) throw movErr;

    // Actualizar stock del item
    await supabase
      .from('inventory_items')
      .update({ stock_actual: nuevo_stock, updated_at: new Date().toISOString() })
      .eq('id', item_id);

    res.status(201).json({ movement, stock_nuevo: nuevo_stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/inventory/movements ─────────────────────────────────
// Historial de movimientos con filtros: item_id, tipo, desde, hasta
router.get('/movements', requireAuth, async (req, res) => {
  const { property_id, item_id, tipo, desde, hasta, limit = 100 } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase
      .from('inventory_movements')
      .select('*, inventory_items(nombre, sku, categoria)')
      .eq('property_id', pid)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (item_id) q = q.eq('item_id', item_id);
    if (tipo) q = q.eq('tipo', tipo);
    if (desde) q = q.gte('created_at', desde);
    if (hasta) q = q.lte('created_at', hasta);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ movements: Array.isArray(data) ? data : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/inventory/alerts ─────────────────────────────────────
// Items con stock_actual <= stock_minimo
router.get('/alerts', requireAuth, async (req, res) => {
  const { property_id } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, nombre, sku, categoria, stock_actual, stock_minimo, bodega, proveedor')
      .eq('property_id', pid)
      .eq('is_active', true)
      .order('categoria', { ascending: true });

    if (error) throw error;
    const items = Array.isArray(data) ? data : [];
    const alerts = items.filter(i => i.stock_actual <= i.stock_minimo);
    res.json({ alerts, total: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/inventory/report ─────────────────────────────────────
// Resumen por categoria: cantidad de items, valor total, alertas
router.get('/report', requireAuth, async (req, res) => {
  const { property_id } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('categoria, stock_actual, stock_minimo, precio_costo')
      .eq('property_id', pid)
      .eq('is_active', true);

    if (error) throw error;
    const items = Array.isArray(data) ? data : [];

    // Agrupar por categoria
    const byCategory = {};
    let valor_total = 0;
    let alertas_total = 0;

    for (const item of items) {
      const cat = item.categoria || 'General';
      if (!byCategory[cat]) {
        byCategory[cat] = { categoria: cat, cantidad_items: 0, valor_total: 0, items_en_alerta: 0 };
      }
      const valor_item = (item.stock_actual || 0) * (item.precio_costo || 0);
      byCategory[cat].cantidad_items++;
      byCategory[cat].valor_total += valor_item;
      if (item.stock_actual <= item.stock_minimo) {
        byCategory[cat].items_en_alerta++;
        alertas_total++;
      }
      valor_total += valor_item;
    }

    res.json({
      por_categoria: Object.values(byCategory),
      totales: {
        items: items.length,
        valor_total: Math.round(valor_total),
        alertas: alertas_total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
