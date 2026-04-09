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

// GET /api/approval-requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { status, type } = req.query;
    let q = supabase.from('approval_requests').select('*').eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ requests: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/approval-requests
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { type, description, guest_name, guest_contact, amount_cop, details, notify_phone, expires_at } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'type y description requeridos' });
    const { data, error } = await supabase.from('approval_requests').insert({
      tenant_id: tenantId, property_id: req.user.property_id,
      type, description, requested_by: req.user.email || req.user.name,
      guest_name, guest_contact, amount_cop, details: details || {},
      notify_phone, expires_at,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/approval-requests/:id — aprobar / rechazar
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const { status, approval_note } = req.body;
    const updates = { status, approval_note, approved_by: req.user.email || req.user.name };
    if (status === 'approved' || status === 'rejected') updates.approved_at = new Date().toISOString();
    const { data, error } = await supabase.from('approval_requests').update(updates)
      .eq('id', req.params.id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
