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

// GET /api/scheduled-reports
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { data, error } = await supabase.from('scheduled_reports').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scheduled-reports
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { name, frequency, send_time, notify_phones, report_type, include_fields } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const { data, error } = await supabase.from('scheduled_reports').insert({
      tenant_id: tenantId, property_id: req.user.property_id,
      name, frequency: frequency || 'daily', send_time: send_time || '08:00',
      notify_phones: notify_phones || [], report_type: report_type || 'reservations',
      include_fields: include_fields || [],
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/scheduled-reports/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const allowed = ['name', 'frequency', 'send_time', 'notify_phones', 'report_type', 'include_fields', 'is_active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('scheduled_reports').update(updates)
      .eq('id', req.params.id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scheduled-reports/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const { error } = await supabase.from('scheduled_reports').delete()
      .eq('id', req.params.id).eq('tenant_id', tenantId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
