import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';
import { calculateDynamicRate, clearPricingCache } from '../services/pricingEngine.js';

const router = Router();

// ═══════════════════════════════════════════════════════
// RATE PLANS — CRUD (existing)
// ═══════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════
// DYNAMIC RATE CALCULATION (enhanced with pricingEngine)
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/calculate
router.get('/rate-plans/:propertyId/calculate', requireAuth, async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, channel = 'direct', numGuests } = req.query;
    if (!checkIn || !checkOut) return res.status(400).json({ error: 'checkIn and checkOut required' });

    const result = await calculateDynamicRate({
      propertyId: req.params.propertyId,
      roomTypeId: roomTypeId || null,
      checkIn,
      checkOut,
      channel,
      numGuests: numGuests ? Number(numGuests) : 1,
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rate-plans/:propertyId/calculate — same but accepts body (useful for complex queries)
router.post('/rate-plans/:propertyId/calculate', requireAuth, async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, channel = 'direct', numGuests = 1 } = req.body;
    if (!checkIn || !checkOut) return res.status(400).json({ error: 'checkIn and checkOut required' });

    const result = await calculateDynamicRate({
      propertyId: req.params.propertyId,
      roomTypeId: roomTypeId || null,
      checkIn,
      checkOut,
      channel,
      numGuests: Number(numGuests),
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rate-plans/:propertyId/clear-cache
router.post('/rate-plans/:propertyId/clear-cache', requireAuth, async (req, res) => {
  clearPricingCache(req.params.propertyId);
  res.json({ success: true, message: 'Pricing cache cleared' });
});

// ═══════════════════════════════════════════════════════
// SEASONS — CRUD
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/seasons
router.get('/rate-plans/:propertyId/seasons', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('start_date');
    if (error) throw error;
    res.json({ seasons: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rate-plans/:propertyId/seasons
router.post('/rate-plans/:propertyId/seasons', requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body, property_id: req.params.propertyId };
    const { data, error } = await supabase
      .from('seasons')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    clearPricingCache(req.params.propertyId);
    res.status(201).json({ season: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rate-plans/seasons/:id
router.put('/rate-plans/seasons/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (data?.property_id) clearPricingCache(data.property_id);
    res.json({ season: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rate-plans/seasons/:id
router.delete('/rate-plans/seasons/:id', requireAuth, async (req, res) => {
  try {
    // Get property_id before deleting for cache clear
    const { data: existing } = await supabase
      .from('seasons')
      .select('property_id')
      .eq('id', req.params.id)
      .single();
    const { error } = await supabase.from('seasons').delete().eq('id', req.params.id);
    if (error) throw error;
    if (existing?.property_id) clearPricingCache(existing.property_id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// DAY-OF-WEEK RULES — CRUD
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/dow-rules
router.get('/rate-plans/:propertyId/dow-rules', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('day_of_week_rules')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('day_of_week');
    if (error) throw error;
    res.json({ rules: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rate-plans/:propertyId/dow-rules — upsert all 7 days at once
router.put('/rate-plans/:propertyId/dow-rules', requireAuth, async (req, res) => {
  try {
    const { rules } = req.body; // [{ day_of_week: 0, multiplier: 1.0 }, ...]
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required' });

    const propertyId = req.params.propertyId;
    const rows = rules.map((r) => ({
      property_id: propertyId,
      day_of_week: r.day_of_week,
      multiplier: r.multiplier,
    }));

    const { data, error } = await supabase
      .from('day_of_week_rules')
      .upsert(rows, { onConflict: 'property_id,day_of_week' })
      .select();
    if (error) throw error;
    clearPricingCache(propertyId);
    res.json({ rules: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// OCCUPANCY RULES — CRUD
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/occupancy-rules
router.get('/rate-plans/:propertyId/occupancy-rules', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('occupancy_rules')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('min_pct');
    if (error) throw error;
    res.json({ rules: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rate-plans/:propertyId/occupancy-rules — replace all tiers
router.put('/rate-plans/:propertyId/occupancy-rules', requireAuth, async (req, res) => {
  try {
    const { rules } = req.body; // [{ min_pct, max_pct, multiplier }, ...]
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required' });

    const propertyId = req.params.propertyId;

    // Delete existing then insert (atomic replace)
    await supabase.from('occupancy_rules').delete().eq('property_id', propertyId);

    const rows = rules.map((r) => ({
      property_id: propertyId,
      min_pct: r.min_pct,
      max_pct: r.max_pct,
      multiplier: r.multiplier,
    }));

    const { data, error } = await supabase
      .from('occupancy_rules')
      .insert(rows)
      .select();
    if (error) throw error;
    clearPricingCache(propertyId);
    res.json({ rules: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// LOS DISCOUNTS — CRUD
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/los-discounts
router.get('/rate-plans/:propertyId/los-discounts', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('los_discounts')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('min_nights');
    if (error) throw error;
    res.json({ discounts: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rate-plans/:propertyId/los-discounts — replace all tiers
router.put('/rate-plans/:propertyId/los-discounts', requireAuth, async (req, res) => {
  try {
    const { discounts } = req.body; // [{ min_nights, discount_pct }, ...]
    if (!Array.isArray(discounts)) return res.status(400).json({ error: 'discounts array required' });

    const propertyId = req.params.propertyId;

    await supabase.from('los_discounts').delete().eq('property_id', propertyId);

    const rows = discounts.map((d) => ({
      property_id: propertyId,
      min_nights: d.min_nights,
      discount_pct: d.discount_pct,
    }));

    const { data, error } = await supabase
      .from('los_discounts')
      .insert(rows)
      .select();
    if (error) throw error;
    clearPricingCache(propertyId);
    res.json({ discounts: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
// PRICE OVERRIDES — CRUD (table from migration_010)
// ═══════════════════════════════════════════════════════

// GET /api/rate-plans/:propertyId/overrides
router.get('/rate-plans/:propertyId/overrides', requireAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.query;
    let query = supabase
      .from('price_overrides')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('date_from');
    if (roomTypeId) query = query.eq('room_type_id', roomTypeId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ overrides: Array.isArray(data) ? data : [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rate-plans/:propertyId/overrides
router.post('/rate-plans/:propertyId/overrides', requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body, property_id: req.params.propertyId };
    const { data, error } = await supabase
      .from('price_overrides')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    clearPricingCache(req.params.propertyId);
    res.status(201).json({ override: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rate-plans/overrides/:id
router.delete('/rate-plans/overrides/:id', requireAuth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('price_overrides')
      .select('property_id')
      .eq('id', req.params.id)
      .single();
    const { error } = await supabase.from('price_overrides').delete().eq('id', req.params.id);
    if (error) throw error;
    if (existing?.property_id) clearPricingCache(existing.property_id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
