import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = Router();

// GET /api/rate-plans/:propertyId
router.get('/rate-plans/:propertyId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('type')
      .order('name');
    if (error) throw error;
    res.json({ plans: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rate-plans
router.post('/rate-plans', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rate_plans')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ plan: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rate-plans/:id
router.put('/rate-plans/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rate_plans')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ plan: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rate-plans/:id (soft delete)
router.delete('/rate-plans/:id', requireAuth, async (req, res) => {
  try {
    await supabase.from('rate_plans').update({ is_active: false }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rate-plans/:propertyId/calculate
router.get('/rate-plans/:propertyId/calculate', requireAuth, async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, channel = 'direct' } = req.query;
    if (!checkIn || !checkOut) return res.status(400).json({ error: 'checkIn and checkOut required' });

    const ciDate = new Date(checkIn);
    const coDate = new Date(checkOut);
    const nights = Math.max(1, Math.round((coDate - ciDate) / 86400000));
    const dayOfWeek = ciDate.getDay();

    // Find best matching plan
    const { data: plans } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .eq('is_active', true)
      .order('type');

    let bestPlan = null;
    let bestRate = null;

    for (const plan of plans || []) {
      // Check date range
      if (plan.valid_from && ciDate < new Date(plan.valid_from)) continue;
      if (plan.valid_to && ciDate > new Date(plan.valid_to)) continue;
      // Check min nights
      if (plan.min_nights && nights < plan.min_nights) continue;
      // Check channel
      if (plan.channels && !plan.channels.includes('all') && !plan.channels.includes(channel)) continue;
      // Check day of week
      if (plan.days_of_week?.length && !plan.days_of_week.includes(dayOfWeek)) continue;
      // Prefer seasonal/weekend over standard
      if (!bestPlan || (plan.type !== 'standard' && bestPlan.type === 'standard')) {
        bestPlan = plan;
        bestRate = Number(plan.base_rate) * (1 + (Number(plan.markup_percent) || 0) / 100);
      }
    }

    // Fallback to room_type base_price
    if (!bestRate && roomTypeId) {
      const { data: rt } = await supabase
        .from('room_types')
        .select('base_price')
        .eq('id', roomTypeId)
        .single();
      if (rt) bestRate = Number(rt.base_price);
    }

    res.json({
      rate_plan: bestPlan?.name || 'Tarifa base',
      rate_per_night: bestRate || 0,
      nights,
      total: (bestRate || 0) * nights,
      channel,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
