// /api/properties — Multi-property management (ESM)
import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/properties — list all properties for current tenant
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get tenant_id from the user's current property
    const { data: prop } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', req.user.property_id)
      .single();

    if (!prop?.tenant_id) {
      // Fallback: return just the current property
      const { data: current } = await supabase
        .from('properties')
        .select('*')
        .eq('id', req.user.property_id)
        .single();
      return res.json(current ? [current] : []);
    }

    const { data, error } = await supabase
      .from('properties')
      .select('id, name, slug, brand_name, brand_logo_url, location, plan, is_active, check_in_time, check_out_time, currency, timezone')
      .eq('tenant_id', prop.tenant_id)
      .eq('is_active', true)
      .order('name');

    if (error) return res.json([]);
    res.json(data || []);
  } catch (e) {
    res.json([]);
  }
});

// GET /api/properties/:id — single property with room types and rooms
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, room_types(*), rooms(id, room_number, floor, status, is_active)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/properties — create property (admin only)
router.post('/', requireAuth, async (req, res) => {
  try {
    // Get tenant_id from current user's property
    const { data: prop } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', req.user.property_id)
      .single();

    const { data, error } = await supabase
      .from('properties')
      .insert({ ...req.body, tenant_id: prop?.tenant_id, is_active: true })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/properties/:id — update property
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update(req.body)
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
