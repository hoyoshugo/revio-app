import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/users — list users for the current property's tenant
router.get('/', requireAuth, async (req, res) => {
  try {
    const { role, active } = req.query;
    const propertyId = req.user.property_id;
    if (!propertyId) return res.json([]);

    // Get tenant_id from property
    const { data: prop } = await supabase.from('properties').select('tenant_id').eq('id', propertyId).single();
    if (!prop?.tenant_id) return res.json([]);

    let query = supabase.from('users').select('id, full_name, email, role, active, created_at, last_login_at')
      .eq('tenant_id', prop.tenant_id)
      .order('full_name');

    if (role) query = query.eq('role', role);
    if (active !== undefined) query = query.eq('active', active === 'true');

    const { data, error } = await query;
    if (error) return res.json([]);
    res.json(data || []);
  } catch (e) {
    res.json([]);
  }
});

// PATCH /api/users/:id — update role or active status
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['role', 'active', 'full_name'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const { data, error } = await supabase.from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, full_name, email, role, active')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
