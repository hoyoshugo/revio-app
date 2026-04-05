import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function dateRange(from, to, pid) {
  const f = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const t = to   || new Date().toISOString().split('T')[0];
  return { f, t };
}

// ── GET /api/reports/occupancy ───────────────────────────────
router.get('/occupancy', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { f, t } = dateRange(req.query.from, req.query.to);
  try {
    const [{ data: rooms }, { data: reservations }] = await Promise.all([
      supabase.from('rooms').select('id,room_type_id').eq('property_id', pid).eq('is_active', true),
      supabase.from('reservations').select('check_in,check_out,room_type_id,rate_per_night,total_amount,source,status')
        .eq('property_id', pid).neq('status', 'cancelled')
        .gte('check_in', f).lte('check_out', t)
    ]);

    const totalRooms = rooms?.length || 1;
    const days = Math.ceil((new Date(t) - new Date(f)) / 86400000) || 1;

    // Daily occupancy
    const dailyMap = {};
    for (let d = new Date(f); d <= new Date(t); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const occupied = (reservations || []).filter(r => r.check_in <= ds && r.check_out > ds).length;
      dailyMap[ds] = { date: ds, occupancy: Math.round((occupied / totalRooms) * 100), occupied_rooms: occupied, total_rooms: totalRooms };
    }

    // By room type
    const byType = {};
    for (const r of rooms || []) {
      const res_for_type = (reservations || []).filter(x => x.room_type_id === r.room_type_id);
      if (!byType[r.room_type_id]) byType[r.room_type_id] = { room_type_id: r.room_type_id, count: 0, reservations: 0 };
      byType[r.room_type_id].count++;
      byType[r.room_type_id].reservations = res_for_type.length;
    }

    // By source
    const bySource = (reservations || []).reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {});

    const totalRevenue = (reservations || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const occupiedNights = (reservations || []).reduce((s, r) => {
      return s + Math.ceil((new Date(r.check_out) - new Date(r.check_in)) / 86400000);
    }, 0);
    const avgRate = occupiedNights > 0 ? totalRevenue / occupiedNights : 0;
    const avgOcc  = Object.values(dailyMap).reduce((s, d) => s + d.occupancy, 0) / days;

    res.json({
      summary: {
        avg_occupancy_pct: Math.round(avgOcc),
        adr: Math.round(avgRate),
        revpar: Math.round(avgRate * avgOcc / 100),
        total_reservations: reservations?.length || 0,
        total_revenue: totalRevenue,
        period_days: days
      },
      daily: Object.values(dailyMap),
      by_source: Object.entries(bySource).map(([source, count]) => ({ source, count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/revenue ─────────────────────────────────
router.get('/revenue', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { f, t } = dateRange(req.query.from, req.query.to);
  try {
    const [{ data: reservations }, { data: posOrders }] = await Promise.all([
      supabase.from('reservations').select('check_in,check_out,total_amount,source,room_type_id')
        .eq('property_id', pid).neq('status', 'cancelled').gte('check_in', f).lte('check_out', t),
      supabase.from('pos_orders').select('created_at,total,revenue_center_id,revenue_centers(name,type)')
        .eq('property_id', pid).eq('status', 'paid')
        .gte('created_at', f + 'T00:00:00').lte('created_at', t + 'T23:59:59')
    ]);

    // Daily revenue
    const dailyMap = {};
    for (let d = new Date(f); d <= new Date(t); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const res_rev = (reservations || []).filter(r => r.check_in === ds).reduce((s, r) => s + (r.total_amount || 0), 0);
      const pos_rev = (posOrders || []).filter(o => o.created_at?.startsWith(ds)).reduce((s, o) => s + (o.total || 0), 0);
      dailyMap[ds] = { date: ds, reservations: res_rev, pos: pos_rev, total: res_rev + pos_rev };
    }

    // By source
    const bySource = (reservations || []).reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + (r.total_amount || 0);
      return acc;
    }, {});

    // By revenue center (POS)
    const byCenter = (posOrders || []).reduce((acc, o) => {
      const name = o.revenue_centers?.name || 'Otro';
      acc[name] = (acc[name] || 0) + (o.total || 0);
      return acc;
    }, {});

    const totalRes = (reservations || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalPos = (posOrders || []).reduce((s, o) => s + (o.total || 0), 0);

    res.json({
      summary: { total: totalRes + totalPos, reservations: totalRes, pos: totalPos },
      daily: Object.values(dailyMap),
      by_source: Object.entries(bySource).map(([source, amount]) => ({ source, amount })),
      by_revenue_center: Object.entries(byCenter).map(([name, amount]) => ({ name, amount })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/pos ─────────────────────────────────────
router.get('/pos', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { f, t } = dateRange(req.query.from, req.query.to);
  try {
    const { data: items } = await supabase.from('pos_order_items')
      .select('product_name,unit_price,quantity,subtotal,pos_orders(status,created_at,revenue_centers(name,type))')
      .gte('pos_orders.created_at', f + 'T00:00:00')
      .lte('pos_orders.created_at', t + 'T23:59:59');

    const { data: orders } = await supabase.from('pos_orders')
      .select('total,status,created_at,revenue_centers(name,type)')
      .eq('property_id', pid).eq('status', 'paid')
      .gte('created_at', f + 'T00:00:00').lte('created_at', t + 'T23:59:59');

    // Top products
    const productMap = {};
    for (const item of items || []) {
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
      productMap[item.product_name].quantity += item.quantity;
      productMap[item.product_name].revenue += item.subtotal || 0;
    }
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

    // Hourly heatmap (0-23h)
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const rev = (orders || [])
        .filter(o => new Date(o.created_at).getHours() === h)
        .reduce((s, o) => s + o.total, 0);
      return { hour: h, revenue: rev };
    });

    res.json({
      top_products: topProducts,
      hourly_heatmap: hourly,
      total_orders: orders?.length || 0,
      total_revenue: (orders || []).reduce((s, o) => s + o.total, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/wallets ─────────────────────────────────
router.get('/wallets', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { f, t } = dateRange(req.query.from, req.query.to);
  try {
    const { data: txns } = await supabase.from('wallet_transactions')
      .select('type,amount,balance_after,created_at,wristband_wallets(guest_name,guests(first_name,last_name))')
      .eq('property_id', pid)
      .gte('created_at', f + 'T00:00:00').lte('created_at', t + 'T23:59:59');

    const { data: wallets } = await supabase.from('wristband_wallets')
      .select('balance,guest_name,guests(first_name,last_name)').eq('property_id', pid).eq('is_active', true);

    const totalLoaded  = (txns || []).filter(t => t.type === 'topup').reduce((s, t) => s + t.amount, 0);
    const totalSpent   = Math.abs((txns || []).filter(t => t.type === 'charge').reduce((s, t) => s + t.amount, 0));
    const totalRefunded = (txns || []).filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0);
    const avgBalance   = wallets?.length ? wallets.reduce((s, w) => s + (w.balance || 0), 0) / wallets.length : 0;

    // Daily volume
    const dailyMap = {};
    for (const txn of txns || []) {
      const ds = txn.created_at?.split('T')[0];
      if (!ds) continue;
      if (!dailyMap[ds]) dailyMap[ds] = { date: ds, loaded: 0, spent: 0 };
      if (txn.type === 'topup') dailyMap[ds].loaded += txn.amount;
      if (txn.type === 'charge') dailyMap[ds].spent += Math.abs(txn.amount);
    }

    res.json({
      summary: { total_loaded: totalLoaded, total_spent: totalSpent, total_refunded: totalRefunded, avg_balance: avgBalance, active_wallets: wallets?.length || 0 },
      daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/housekeeping ────────────────────────────
router.get('/housekeeping', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { f, t } = dateRange(req.query.from, req.query.to);
  try {
    const { data: tasks } = await supabase.from('housekeeping_tasks')
      .select('type,status,priority,scheduled_for,started_at,completed_at,users!assigned_to(name)')
      .eq('property_id', pid)
      .gte('scheduled_for', f).lte('scheduled_for', t);

    const byStatus = (tasks || []).reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const byType   = (tasks || []).reduce((acc, t) => { acc[t.type]   = (acc[t.type]   || 0) + 1; return acc; }, {});
    const byStaff  = (tasks || []).reduce((acc, t) => {
      const n = t.users?.name || 'Sin asignar';
      acc[n] = (acc[n] || 0) + 1; return acc;
    }, {});

    const completedWithTime = (tasks || []).filter(t => t.started_at && t.completed_at);
    const avgTime = completedWithTime.length
      ? completedWithTime.reduce((s, t) => s + (new Date(t.completed_at) - new Date(t.started_at)) / 60000, 0) / completedWithTime.length
      : 0;

    res.json({
      summary: { total: tasks?.length || 0, by_status: byStatus, avg_completion_min: Math.round(avgTime) },
      by_type: Object.entries(byType).map(([type, count]) => ({ type, count })),
      by_staff: Object.entries(byStaff).map(([name, count]) => ({ name, count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
