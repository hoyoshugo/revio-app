import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/rooms — Listar habitaciones con tipo y estado ──
router.get('/', requireAuth, async (req, res) => {
  const { property_id, status, room_type_id } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase
      .from('rooms')
      .select('*, room_types(id,name,slug,capacity,base_price,amenities,photos)')
      .eq('property_id', pid)
      .eq('is_active', true)
      .order('number');
    if (status) q = q.eq('status', status);
    if (room_type_id) q = q.eq('room_type_id', room_type_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ rooms: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rooms/types — Tipos de habitación ──
router.get('/types', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .eq('property_id', pid)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    res.json({ room_types: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rooms/types — Crear tipo de habitación ──
router.post('/types', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { name, slug, description, capacity, beds, base_price, amenities, photos } = req.body;
  if (!name || !base_price) return res.status(400).json({ error: 'name y base_price son requeridos' });
  try {
    const { data, error } = await supabase
      .from('room_types')
      .insert({ property_id: pid, name, slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description, capacity: capacity || 2, beds: beds || [], base_price,
        amenities: amenities || [], photos: photos || [] })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/rooms/types/:id ──
router.patch('/types/:id', requireAuth, async (req, res) => {
  const allowed = ['name','description','capacity','beds','base_price','amenities','photos','is_active','sort_order'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase
      .from('room_types').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rooms/gantt/availability — Disponibilidad para Gantt ──
router.get('/gantt/availability', requireAuth, async (req, res) => {
  const { property_id, date_from, date_to } = req.query;
  const pid = property_id || req.user.property_id;
  if (!date_from || !date_to) return res.status(400).json({ error: 'date_from y date_to requeridos' });
  try {
    const [{ data: rooms }, { data: reservations }] = await Promise.all([
      supabase.from('rooms').select('*, room_types(id,name,base_price)')
        .eq('property_id', pid).eq('is_active', true).order('number'),
      supabase.from('reservations')
        .select('*, guests(id,first_name,last_name,email,phone), rooms(id,number,name)')
        .eq('property_id', pid)
        .neq('status', 'cancelled')
        .lte('check_in', date_to)
        .gte('check_out', date_from)
    ]);
    res.json({ rooms: rooms || [], reservations: reservations || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rooms/:id ──
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, room_types(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Habitación no encontrada' });
  }
});

// ── POST /api/rooms — Crear habitación ──
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { number, name, floor, capacity, room_type_id, notes } = req.body;
  if (!number) return res.status(400).json({ error: 'number es requerido' });
  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ property_id: pid, number, name, floor: floor || 1,
        capacity: capacity || 2, room_type_id, notes })
      .select('*, room_types(*)').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/rooms/:id ──
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['number','name','floor','capacity','room_type_id','status','notes','is_active'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase
      .from('rooms').update(updates).eq('id', req.params.id).select('*, room_types(*)').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/rooms/:id ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('rooms').update({ is_active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
