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

export default router;
