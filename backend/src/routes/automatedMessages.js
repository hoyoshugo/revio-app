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

// GET /api/automated-messages
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { property_id, trigger_type } = req.query;
    let q = supabase.from('automated_messages').select('*').eq('tenant_id', tenantId)
      .order('trigger_type').order('trigger_hours_offset');
    if (property_id) q = q.eq('property_id', property_id);
    if (trigger_type) q = q.eq('trigger_type', trigger_type);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automated-messages
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { property_id, name, trigger_type, trigger_hours_offset, channel, message_template } = req.body;
    if (!name || !trigger_type || !message_template) {
      return res.status(400).json({ error: 'name, trigger_type y message_template requeridos' });
    }
    const { data, error } = await supabase.from('automated_messages').insert({
      tenant_id: tenantId, property_id: property_id || req.user.property_id,
      name, trigger_type, trigger_hours_offset: trigger_hours_offset || 0,
      channel: channel || 'whatsapp', message_template,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/automated-messages/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const allowed = ['name', 'trigger_type', 'trigger_hours_offset', 'channel', 'message_template', 'is_active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('automated_messages').update(updates)
      .eq('id', req.params.id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/automated-messages/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    const { error } = await supabase.from('automated_messages').delete()
      .eq('id', req.params.id).eq('tenant_id', tenantId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
