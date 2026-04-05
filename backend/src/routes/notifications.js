import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/notifications ────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  try {
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('property_id', pid)
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications/read-all ─────────────────────────
router.post('/read-all', requireAuth, async (req, res) => {
  const pid = req.body.property_id || req.user.property_id;
  try {
    const { error } = await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('property_id', pid).is('read_at', null);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notifications (internal — create notification) ─
router.post('/', requireAuth, async (req, res) => {
  const { property_id, type, title, body, link } = req.body;
  const pid = property_id || req.user.property_id;
  if (!title) return res.status(400).json({ error: 'title requerido' });
  try {
    const { data, error } = await supabase.from('notifications')
      .insert({ property_id: pid, type: type || 'alert', title, body, link })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
