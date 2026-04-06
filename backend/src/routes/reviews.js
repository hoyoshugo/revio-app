import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/reviews — list reviews by property
router.get('/', requireAuth, async (req, res) => {
  try {
    const propertyId = req.query.property_id || req.user.property_id;
    const { guest_id, limit = 50, offset = 0 } = req.query;

    let query = supabase.from('guest_reviews')
      .select('*, guests(first_name, last_name, email)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (guest_id) query = query.eq('guest_id', guest_id);

    const { data, error } = await query;
    if (error) {
      // Table may not exist yet — return empty gracefully
      return res.json({ reviews: [], total: 0 });
    }
    res.json({ reviews: data || [], total: data?.length || 0 });
  } catch (e) {
    res.json({ reviews: [], total: 0 });
  }
});

// POST /api/reviews — create review
router.post('/', requireAuth, async (req, res) => {
  try {
    const propertyId = req.user.property_id;
    const { data, error } = await supabase.from('guest_reviews')
      .insert({ ...req.body, property_id: propertyId })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/reviews/:id/respond — save AI/manual response
router.patch('/:id/respond', requireAuth, async (req, res) => {
  try {
    const { response } = req.body;
    const { data, error } = await supabase.from('guest_reviews')
      .update({ response, responded_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
