import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = Router();

// GET /api/housekeeping/:propertyId
router.get('/housekeeping/:propertyId', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('housekeeping')
      .select('*, rooms(number, name, room_type_id, room_types(name))')
      .eq('property_id', req.params.propertyId)
      .eq('date', date)
      .order('status');
    if (error) throw error;
    res.json({ tasks: data || [], date });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/housekeeping/:id/status
router.put('/housekeeping/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'in_progress') updates.started_at = new Date().toISOString();
    if (status === 'clean') updates.completed_at = new Date().toISOString();
    if (status === 'inspected') {
      updates.inspected_at = new Date().toISOString();
      updates.inspected_by = req.user?.email || 'admin';
    }
    const { data, error } = await supabase
      .from('housekeeping')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/housekeeping/:id/assign
router.put('/housekeeping/:id/assign', requireAuth, async (req, res) => {
  try {
    const { assigned_to } = req.body;
    const { data, error } = await supabase
      .from('housekeeping')
      .update({ assigned_to })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/housekeeping/generate — generar registros del día
router.post('/housekeeping/generate', requireAuth, async (req, res) => {
  try {
    const { property_id, date } = req.body;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('property_id', property_id)
      .eq('is_active', true);

    const inserts = (rooms || []).map(r => ({
      property_id,
      room_id: r.id,
      date: targetDate,
      status: 'pending',
      priority: 'normal',
    }));

    if (inserts.length > 0) {
      await supabase
        .from('housekeeping')
        .upsert(inserts, { onConflict: 'property_id,room_id,date', ignoreDuplicates: true });
    }

    res.json({ success: true, generated: inserts.length, date: targetDate });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/housekeeping/:propertyId/stats
router.get('/housekeeping/:propertyId/stats', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('housekeeping')
      .select('status')
      .eq('property_id', req.params.propertyId)
      .eq('date', date);

    const stats = { total: 0, pending: 0, in_progress: 0, clean: 0, inspected: 0, out_of_order: 0 };
    for (const row of data || []) {
      stats.total++;
      stats[row.status] = (stats[row.status] || 0) + 1;
    }
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
