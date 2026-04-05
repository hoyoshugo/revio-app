import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { property_id, date_from, date_to } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase.from('events').select('*').eq('is_active', true).order('start_date');
    // Events that apply to all properties OR this specific property
    q = q.or(`property_id.eq.${pid},property_id.is.null`);
    if (date_from) q = q.gte('end_date', date_from);
    if (date_to)   q = q.lte('start_date', date_to);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ events: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { name, description, start_date, end_date, type, impact, color } = req.body;
  if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date y end_date requeridos' });
  try {
    const { data, error } = await supabase.from('events').insert({
      property_id: pid, name, description, start_date, end_date,
      type: type || 'local', impact: impact || 'medium', color: color || '#F59E0B'
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['name','description','start_date','end_date','type','impact','color','is_active'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('events').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('events').update({ is_active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
