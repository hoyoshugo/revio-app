import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/pos/revenue-centers ──
router.get('/revenue-centers', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('revenue_centers')
      .select('*').eq('property_id', pid).eq('is_active', true).order('sort_order');
    if (error) throw error;
    res.json({ revenue_centers: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pos/revenue-centers ──
router.post('/revenue-centers', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { name, type, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name es requerido' });
  try {
    const { data, error } = await supabase.from('revenue_centers')
      .insert({ property_id: pid, name, type: type || 'bar', description, icon: icon || 'store' })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pos/products ──
router.get('/products', requireAuth, async (req, res) => {
  const { revenue_center_id, category } = req.query;
  const pid = req.user.property_id;
  try {
    let q = supabase.from('products').select('*')
      .eq('property_id', pid).eq('is_available', true).order('sort_order');
    if (revenue_center_id) q = q.eq('revenue_center_id', revenue_center_id);
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ products: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pos/products ──
router.post('/products', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { name, description, category, price, revenue_center_id, sku, photo_url, stock } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name y price requeridos' });
  try {
    const { data, error } = await supabase.from('products').insert({
      property_id: pid, name, description, category, price, revenue_center_id, sku, photo_url, stock
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/pos/products/:id ──
router.patch('/products/:id', requireAuth, async (req, res) => {
  const allowed = ['name','description','category','price','is_available','photo_url','stock','sort_order'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('products').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pos/orders ──
router.get('/orders', requireAuth, async (req, res) => {
  const { status, revenue_center_id, date, limit = 50 } = req.query;
  const pid = req.user.property_id;
  try {
    let q = supabase.from('pos_orders')
      .select(`*, revenue_centers(id,name,type), guests(id,first_name,last_name), pos_order_items(*, products(name,category))`)
      .eq('property_id', pid).order('created_at', { ascending: false }).limit(parseInt(limit));
    if (status) q = q.eq('status', status);
    if (revenue_center_id) q = q.eq('revenue_center_id', revenue_center_id);
    if (date) q = q.gte('created_at', date).lte('created_at', date + 'T23:59:59');
    const { data, error } = await q;
    if (error) throw error;
    res.json({ orders: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pos/orders — Nueva orden ──
router.post('/orders', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { revenue_center_id, guest_id, reservation_id, items, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items requeridos' });
  }
  try {
    // Calcular totales
    const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
    const taxes = Math.round(subtotal * 0.08 * 100) / 100; // 8% IVA
    const total = subtotal + taxes;

    const { data: order, error: orderErr } = await supabase.from('pos_orders').insert({
      property_id: pid, revenue_center_id, guest_id, reservation_id,
      subtotal, taxes, total, currency: 'COP', status: 'open',
      notes, created_by: req.user.id
    }).select().single();
    if (orderErr) throw orderErr;

    const itemRows = items.map(i => ({
      order_id: order.id, product_id: i.product_id,
      product_name: i.product_name, unit_price: i.unit_price, quantity: i.quantity, notes: i.notes
    }));
    const { error: itemsErr } = await supabase.from('pos_order_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    const { data: full } = await supabase.from('pos_orders')
      .select(`*, pos_order_items(*, products(name,category)), guests(id,first_name,last_name)`)
      .eq('id', order.id).single();
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pos/orders/:id/items — Agregar items ──
router.post('/orders/:id/items', requireAuth, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items requeridos' });
  try {
    const itemRows = items.map(i => ({
      order_id: req.params.id, product_id: i.product_id,
      product_name: i.product_name, unit_price: i.unit_price, quantity: i.quantity
    }));
    await supabase.from('pos_order_items').insert(itemRows);
    // Recalcular totales
    const { data: allItems } = await supabase.from('pos_order_items')
      .select('unit_price,quantity').eq('order_id', req.params.id);
    const subtotal = (allItems || []).reduce((s, i) => s + (i.unit_price * i.quantity), 0);
    const taxes = Math.round(subtotal * 0.08 * 100) / 100;
    const { data, error } = await supabase.from('pos_orders')
      .update({ subtotal, taxes, total: subtotal + taxes })
      .eq('id', req.params.id).select(`*, pos_order_items(*), guests(id,first_name,last_name)`).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/pos/orders/:orderId/items/:itemId ──
router.delete('/orders/:orderId/items/:itemId', requireAuth, async (req, res) => {
  try {
    await supabase.from('pos_order_items').delete().eq('id', req.params.itemId);
    const { data: allItems } = await supabase.from('pos_order_items')
      .select('unit_price,quantity').eq('order_id', req.params.orderId);
    const subtotal = (allItems || []).reduce((s, i) => s + (i.unit_price * i.quantity), 0);
    const taxes = Math.round(subtotal * 0.08 * 100) / 100;
    const { data } = await supabase.from('pos_orders')
      .update({ subtotal, taxes, total: subtotal + taxes })
      .eq('id', req.params.orderId).select(`*, pos_order_items(*)`).single();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/pos/orders/:id/pay ──
router.patch('/orders/:id/pay', requireAuth, async (req, res) => {
  const { payment_method, wallet_id } = req.body;
  if (!payment_method) return res.status(400).json({ error: 'payment_method requerido' });
  try {
    const { data: order, error } = await supabase.from('pos_orders')
      .update({ status: 'paid', payment_method }).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Si es pago por wallet, descontar saldo
    if (payment_method === 'wallet' && wallet_id) {
      const { data: wallet } = await supabase.from('wristband_wallets').select('balance').eq('id', wallet_id).single();
      if (wallet) {
        const newBalance = wallet.balance - order.total;
        if (newBalance < 0) return res.status(400).json({ error: 'Saldo insuficiente en billetera' });
        await supabase.from('wristband_wallets').update({ balance: newBalance }).eq('id', wallet_id);
        await supabase.from('wallet_transactions').insert({
          wallet_id, property_id: order.property_id, type: 'charge',
          amount: -order.total, balance_after: newBalance,
          description: `Orden POS #${order.order_number}`, pos_order_id: order.id,
          created_by: req.user.id
        });
      }
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/pos/orders/:id/cancel ──
router.patch('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pos_orders')
      .update({ status: 'cancelled' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
