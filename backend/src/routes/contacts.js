import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function getTenantId(user) {
  if (user.tenant_id) return user.tenant_id;
  if (!user.property_id) return null;
  const { data } = await supabase.from('properties').select('tenant_id').eq('id', user.property_id).single();
  return data?.tenant_id || null;
}

// GET /api/contacts — listar contactos del tenant
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { search, tag, limit = 100 } = req.query;
    let q = supabase.from('contacts').select('*').eq('tenant_id', tenantId)
      .order('last_contact_at', { ascending: false }).limit(parseInt(limit));
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    if (tag) q = q.contains('tags', [tag]);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ contacts: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const { data, error } = await supabase.from('contacts').select('*')
      .eq('id', req.params.id).eq('tenant_id', tenantId).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Contacto no encontrado' });
  }
});

// POST /api/contacts
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { name, email, phone, nationality, language, source, tags, notes, marketing_consent } = req.body;
    if (!name && !email && !phone) return res.status(400).json({ error: 'name, email o phone requerido' });
    const { data, error } = await supabase.from('contacts').insert({
      tenant_id: tenantId, name, email, phone, nationality,
      language: language || 'es', source, tags: tags || [], notes,
      marketing_consent: marketing_consent || false,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const allowed = ['name', 'email', 'phone', 'nationality', 'language', 'source', 'tags', 'notes', 'marketing_consent', 'total_reservations', 'total_spent_cop'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.last_contact_at = new Date().toISOString();
    const { data, error } = await supabase.from('contacts').update(updates)
      .eq('id', req.params.id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const { error } = await supabase.from('contacts').delete()
      .eq('id', req.params.id).eq('tenant_id', tenantId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
