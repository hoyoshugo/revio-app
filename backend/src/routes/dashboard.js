import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db, supabase } from '../models/supabase.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================================
// POST /api/dashboard/login
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (password !== user.password_hash) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, property_id: user.property_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, property_id: user.property_id }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/metrics
// ============================================================
router.get('/metrics', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const metrics = await db.getDashboardMetrics(pid || null);
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/conversations
// ============================================================
router.get('/conversations', requireAuth, async (req, res) => {
  const { status, limit = 50 } = req.query;
  const propertyId = req.query.property_id || req.user.property_id;
  try {
    const conversations = await db.getConversationsList(propertyId, { status, limit: parseInt(limit) });
    res.json({ conversations, total: conversations.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/conversations/:id
// ============================================================
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*, properties(name, slug, brand_primary_color)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    const messages = await db.getConversationMessages(req.params.id, 100);
    res.json({ conversation, messages });
  } catch (err) {
    res.status(404).json({ error: 'Conversación no encontrada' });
  }
});

// ============================================================
// GET /api/dashboard/occupancy
// ============================================================
router.get('/occupancy', requireAuth, async (req, res) => {
  const { property_slug } = req.query;
  try {
    if (property_slug) {
      const prop = await db.getProperty(property_slug);
      const { data } = await supabase
        .from('occupancy_cache')
        .select('*')
        .eq('property_id', prop.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(30);
      return res.json({ property: prop, occupancy_data: data || [] });
    }

    const props = await db.getAllProperties();
    const results = [];
    for (const p of props) {
      const { data } = await supabase
        .from('occupancy_cache')
        .select('*')
        .eq('property_id', p.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(30);
      results.push({ property: p, occupancy_data: data || [] });
    }
    res.json({ properties: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/weekly-report
// ============================================================
router.get('/weekly-report', requireAuth, async (req, res) => {
  const propertyId = req.query.property_id || req.user.property_id;
  if (!propertyId) return res.status(400).json({ error: 'property_id requerido' });
  try {
    const report = await db.getWeeklyReport(propertyId);
    const allProps = await db.getAllProperties();
    const property = allProps.find(p => p.id === propertyId);

    const totalRevenue = report.bookings.reduce((s, b) => s + (b.total_amount || 0), 0);
    const converted = report.conversations.filter(c => ['reserved', 'paid', 'checked_in'].includes(c.status)).length;
    const conversionRate = report.conversations.length
      ? ((converted / report.conversations.length) * 100).toFixed(1)
      : 0;
    const langDistribution = report.conversations.reduce((acc, c) => {
      const l = c.guest_language || 'es';
      acc[l] = (acc[l] || 0) + 1;
      return acc;
    }, {});

    res.json({
      property,
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      summary: {
        total_conversations: report.conversations.length,
        total_bookings: report.bookings.length,
        total_revenue: totalRevenue,
        conversion_rate: parseFloat(conversionRate),
        language_distribution: langDistribution,
        communications_sent: report.communications.filter(c => c.status === 'sent').length
      },
      bookings: report.bookings,
      conversations: report.conversations,
      communications: report.communications
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/properties
// ============================================================
router.get('/properties', requireSuperAdmin, async (req, res) => {
  try {
    const properties = await db.getAllProperties();
    res.json({ properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/dashboard/properties
// ============================================================
router.post('/properties', requireSuperAdmin, async (req, res) => {
  const { slug, name, plan, brand_name, location, maps_url, how_to_get_url, booking_url, whatsapp_number, languages, includes } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug y name son requeridos' });
  try {
    const { data, error } = await supabase
      .from('properties')
      .insert({ slug, name, plan, brand_name, location, maps_url, how_to_get_url, booking_url, whatsapp_number, languages, includes })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ property: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/me
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// ============================================================
// GET /api/dashboard/billing
// ============================================================
router.get('/billing', requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*, properties(id, is_active)')
      .eq('id', req.user.id)
      .single();

    // Get tenant via user's property
    const propId = user?.property_id || req.user.property_id;
    const { data: property } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', propId)
      .single();

    const tenantId = property?.tenant_id;
    if (!tenantId) return res.json({ plan: 'basico', property_count: 1, status: 'trial', trial_days_left: 14, discount_pct: 0 });

    // Try full join first; fall back to basic columns if extra_property_price doesn't exist (pre-migration_008)
    let tenant = null;
    const { data: tenantFull, error: tenantErr } = await supabase
      .from('tenants')
      .select('*, tenant_plans(name, price_monthly, extra_property_price)')
      .eq('id', tenantId)
      .single();
    if (tenantErr && tenantErr.message?.includes('extra_property_price')) {
      const { data: tenantBasic } = await supabase
        .from('tenants')
        .select('*, tenant_plans(name, price_monthly)')
        .eq('id', tenantId)
        .single();
      tenant = tenantBasic;
    } else {
      tenant = tenantFull;
    }

    const { data: properties } = await supabase
      .from('properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // tenant_discounts may not exist if migration_008 hasn't run yet
    let discounts = [];
    const { data: discountRows, error: discountErr } = await supabase
      .from('tenant_discounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    if (!discountErr) {
      discounts = discountRows || [];
    } else {
      // Fallback: read discount from settings table (stored per property)
      const propIds = (properties || []).map(p => p.id);
      if (propIds.length > 0) {
        const { data: settingRows } = await supabase
          .from('settings')
          .select('value')
          .in('property_id', propIds)
          .eq('key', 'tenant_discount');
        if (settingRows?.length > 0) {
          // De-duplicate: take one entry per unique type+value (tenant-level discount stored per-property)
          const seen = new Set();
          discounts = settingRows.map(s => s.value).filter(d => {
            if (!d) return false;
            const key = d.type + ':' + d.value;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      }
    }

    const propCount = (properties || []).length || 1;
    const trialEnd = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000)) : 0;

    // Sum up active percent discounts
    const activeDiscount = (discounts || [])
      .filter(d => d.type === 'percent_permanent' || d.type === 'percent_temporary')
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    // Determine plan key
    const planName = (tenant?.tenant_plans?.name || 'basico').toLowerCase();
    const planKey = planName.includes('enterprise') ? 'enterprise'
      : planName.includes('pro') ? 'pro' : 'basico';

    res.json({
      plan: planKey,
      plan_name: tenant?.tenant_plans?.name || 'Básico',
      property_count: propCount,
      status: tenant?.status || 'trial',
      trial_days_left: trialDaysLeft,
      next_billing_date: tenant?.next_billing_date || null,
      discount_pct: activeDiscount,
      invoice_history: [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/dashboard/kpis — Complete KPI + charts shape
// ============================================================
router.get('/kpis', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const today = new Date().toISOString().split('T')[0];

  const safeQuery = async (fn) => { try { return await fn(); } catch (e) { return { data: null, count: 0 }; } };

  const [
    roomsRes,
    arrivalsRes,
    departuresRes,
    revTodayRes,
    walletsRes,
    openOrdersRes,
    hkRes,
    lowStockRes,
  ] = await Promise.all([
    safeQuery(() => supabase.from('rooms').select('id,status').eq('property_id', pid)),
    safeQuery(() => supabase.from('reservations')
      .select('id, guests(first_name,last_name), rooms(name,number)')
      .eq('property_id', pid).eq('check_in', today).in('status', ['confirmed', 'checked_in']).limit(8)),
    safeQuery(() => supabase.from('reservations')
      .select('id, guests(first_name,last_name), rooms(name,number)')
      .eq('property_id', pid).eq('check_out', today).eq('status', 'checked_in').limit(8)),
    safeQuery(() => supabase.from('reservations')
      .select('total_amount').eq('property_id', pid).eq('payment_status', 'paid').gte('created_at', today + 'T00:00:00')),
    safeQuery(() => supabase.from('wristband_wallets')
      .select('balance').eq('property_id', pid).eq('is_active', true)),
    safeQuery(() => supabase.from('pos_orders')
      .select('id,order_number,total_amount,created_at').eq('property_id', pid).eq('status', 'open').limit(5)),
    safeQuery(() => supabase.from('housekeeping_tasks')
      .select('status').eq('property_id', pid).gte('created_at', today + 'T00:00:00')),
    safeQuery(() => supabase.from('pos_products')
      .select('name,stock,min_stock').eq('track_stock', true).limit(20)),
  ]);

  const rooms = roomsRes.data || [];
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const revenueToday = (revTodayRes.data || []).reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
  const wallets = walletsRes.data || [];
  const walletBalanceTotal = wallets.reduce((s, w) => s + parseFloat(w.balance || 0), 0);
  const hkCounts = { pending: 0, in_progress: 0, done: 0, verified: 0 };
  (hkRes.data || []).forEach(t => { if (hkCounts[t.status] !== undefined) hkCounts[t.status]++; });

  // 30-day charts
  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const { data: histRes } = await safeQuery(() =>
    supabase.from('reservations').select('check_in,check_out,total_amount,status')
      .eq('property_id', pid).gte('check_in', thirtyAgo.toISOString().split('T')[0])
  );
  const hist = histRes || [];

  const occupancy30d = [];
  const revenue30d = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    const occ = hist.filter(r => r.check_in <= dateStr && r.check_out > dateStr && r.status !== 'cancelled').length;
    const rev = hist.filter(r => r.check_in === dateStr && r.status !== 'cancelled')
      .reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    occupancy30d.push({ date: label, pct: totalRooms > 0 ? Math.round((occ / totalRooms) * 100) : 0 });
    revenue30d.push({ date: label, revenue: rev });
  }

  res.json({
    kpis: {
      occupancy_pct: occupancyPct,
      revenue_today: revenueToday,
      arrivals_today: (arrivalsRes.data || []).length,
      departures_today: (departuresRes.data || []).length,
      active_wallets: wallets.length,
      wallet_balance_total: walletBalanceTotal,
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
    },
    arrivals: arrivalsRes.data || [],
    departures: departuresRes.data || [],
    housekeeping: hkCounts,
    low_stock: (lowStockRes.data || []).filter(p => (p.stock || 0) <= (p.min_stock || 0)).slice(0, 5),
    open_pos_orders: openOrdersRes.data || [],
    occupancy_30d: occupancy30d,
    revenue_30d: revenue30d,
  });
});

export default router;
