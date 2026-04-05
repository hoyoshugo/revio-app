import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/housekeeping ──
router.get('/', requireAuth, async (req, res) => {
  const { property_id, status, date, assigned_to } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase.from('housekeeping_tasks')
      .select(`*, rooms(id,number,name,floor), users!assigned_to(id,name,email)`)
      .eq('property_id', pid)
      .order('scheduled_for', { ascending: true });
    if (status) q = q.eq('status', status);
    if (date) q = q.eq('scheduled_for', date);
    if (assigned_to) q = q.eq('assigned_to', assigned_to);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ tasks: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/housekeeping ──
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { room_id, reservation_id, type, priority, assigned_to, scheduled_for, notes, checklist } = req.body;
  if (!room_id) return res.status(400).json({ error: 'room_id es requerido' });
  try {
    const { data, error } = await supabase.from('housekeeping_tasks').insert({
      property_id: pid, room_id, reservation_id, type: type || 'daily_clean',
      priority: priority || 'normal', assigned_to,
      scheduled_for: scheduled_for || new Date().toISOString().split('T')[0],
      notes, checklist: checklist || []
    }).select(`*, rooms(id,number,name)`).single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/housekeeping/:id ──
router.patch('/:id', requireAuth, async (req, res) => {
  const { status, assigned_to, notes, checklist, photos } = req.body;
  const updates = {};
  if (status)      { updates.status = status; }
  if (assigned_to) { updates.assigned_to = assigned_to; }
  if (notes)       { updates.notes = notes; }
  if (checklist)   { updates.checklist = checklist; }
  if (photos)      { updates.photos = photos; }
  if (status === 'in_progress') updates.started_at = new Date().toISOString();
  if (status === 'done')        updates.completed_at = new Date().toISOString();

  try {
    const { data, error } = await supabase.from('housekeeping_tasks')
      .update(updates).eq('id', req.params.id)
      .select(`*, rooms(id,number,name,status)`).single();
    if (error) throw error;

    // Si la tarea está done, actualizar el estado de la habitación a available
    if (status === 'done' && data.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', data.room_id);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/housekeeping/stats ──
router.get('/stats/today', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase.from('housekeeping_tasks')
      .select('status').eq('property_id', pid).eq('scheduled_for', today);
    if (error) throw error;
    const stats = (data || []).reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, { pending: 0, in_progress: 0, done: 0, skipped: 0 });
    res.json({ stats, total: data?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
