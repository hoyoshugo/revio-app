import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/settings/property ────────────────────────────────
router.get('/property', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('properties').select('*').eq('id', pid).single();
    if (error) throw error;
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/settings/property ─────────────────────────────
router.patch('/property', requireAuth, async (req, res) => {
  const { property_id, ...updates } = req.body;
  const pid = property_id || req.user.property_id;
  // Whitelist updatable fields
  const allowed = ['name', 'brand_name', 'location', 'phone', 'email', 'website',
    'description', 'check_in_time', 'check_out_time', 'currency', 'timezone', 'tax_rate',
    'brand_logo_url', 'cover_url'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('properties')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', pid).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/settings/users ───────────────────────────────────
router.get('/users', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('users')
      .select('id,name,email,role,is_active,last_login,created_at')
      .eq('property_id', pid).order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/settings/users ──────────────────────────────────
router.post('/users', requireAuth, async (req, res) => {
  const { property_id, name, email, password, role } = req.body;
  const pid = property_id || req.user.property_id;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email y password requeridos' });
  try {
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email ya registrado' });
    const { data, error } = await supabase.from('users')
      .insert({ property_id: pid, name, email: email.toLowerCase(), password_hash: password, role: role || 'staff', is_active: true })
      .select('id,name,email,role,is_active').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/settings/users/:id ────────────────────────────
router.patch('/users/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { is_active, role, name } = req.body;
  try {
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (role) updates.role = role;
    if (name) updates.name = name;
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select('id,name,email,role,is_active').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/settings/integrations ───────────────────────────
router.get('/integrations', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data } = await supabase.from('property_integrations')
      .select('key,value').eq('property_id', pid);
    const result = {};
    for (const row of data || []) {
      // Mask secret values — only return first 6 chars + ...
      result[row.key] = row.value ? row.value.slice(0, 6) + '...' : '';
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/settings/integrations ─────────────────────────
router.patch('/integrations', requireAuth, async (req, res) => {
  const { property_id, ...keys } = req.body;
  const pid = property_id || req.user.property_id;
  const ALLOWED_KEYS = ['anthropic_key', 'wompi_public', 'wompi_private', 'whatsapp_token', 'whatsapp_phone_id', 'lobbypms_key'];
  try {
    const upserts = Object.entries(keys)
      .filter(([k, v]) => ALLOWED_KEYS.includes(k) && v && !v.endsWith('...'))
      .map(([k, v]) => ({ property_id: pid, key: k, value: v }));
    if (upserts.length > 0) {
      const { error } = await supabase.from('property_integrations')
        .upsert(upserts, { onConflict: 'property_id,key' });
      if (error) throw error;
    }
    res.json({ success: true, updated: upserts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
