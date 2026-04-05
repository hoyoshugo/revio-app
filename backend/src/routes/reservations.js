import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/reservations ──
router.get('/', requireAuth, async (req, res) => {
  const { property_id, status, check_in, check_out, room_id, limit = 100 } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase.from('reservations')
      .select(`*, rooms(id,number,name), room_types(id,name), guests(id,first_name,last_name,email,phone)`)
      .eq('property_id', pid)
      .order('check_in', { ascending: true })
      .limit(parseInt(limit));
    if (status) q = q.eq('status', status);
    if (room_id) q = q.eq('room_id', room_id);
    if (check_in) q = q.gte('check_in', check_in);
    if (check_out) q = q.lte('check_out', check_out);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ reservations: data || [], total: data?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reservations/:id ──
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('reservations')
      .select(`*, rooms(*), room_types(*), guests(*)`)
      .eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Reserva no encontrada' });
  }
});

// ── POST /api/reservations — Crear reserva ──
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const {
    room_id, room_type_id, guest_id, check_in, check_out,
    adults, children, rate_per_night, total_amount, currency,
    status, source, channel_ref, color, special_requests, internal_notes
  } = req.body;
  if (!check_in || !check_out) return res.status(400).json({ error: 'check_in y check_out son requeridos' });

  // Verificar disponibilidad
  if (room_id) {
    const { data: conflicts } = await supabase.from('reservations')
      .select('id').eq('room_id', room_id).neq('status', 'cancelled')
      .lte('check_in', check_out).gte('check_out', check_in);
    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({ error: 'Habitación no disponible en esas fechas', conflicts });
    }
  }

  try {
    const { data, error } = await supabase.from('reservations').insert({
      property_id: pid, room_id, room_type_id, guest_id, check_in, check_out,
      adults: adults || 1, children: children || 0,
      rate_per_night: rate_per_night || 0, total_amount: total_amount || 0,
      currency: currency || 'COP', status: status || 'confirmed',
      source: source || 'direct', channel_ref, color: color || '#6366F1',
      special_requests, internal_notes, created_by: req.user.id
    }).select(`*, rooms(id,number,name), guests(id,first_name,last_name,email,phone)`).single();
    if (error) throw error;
    // Update room status
    if (room_id && (!status || status === 'confirmed')) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', room_id);
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reservations/:id — Actualizar (incluye drag-drop) ──
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = [
    'room_id','check_in','check_out','adults','children','rate_per_night',
    'total_amount','status','source','color','special_requests','internal_notes'
  ];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  // Si cambia room_id, verificar disponibilidad en nuevas fechas
  if (updates.room_id || updates.check_in || updates.check_out) {
    const { data: current } = await supabase.from('reservations').select('*').eq('id', req.params.id).single();
    const checkIn  = updates.check_in  || current.check_in;
    const checkOut = updates.check_out || current.check_out;
    const roomId   = updates.room_id   || current.room_id;
    if (roomId) {
      const { data: conflicts } = await supabase.from('reservations')
        .select('id').eq('room_id', roomId).neq('id', req.params.id)
        .neq('status', 'cancelled').lte('check_in', checkOut).gte('check_out', checkIn);
      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({ error: 'Habitación ocupada en esas fechas', conflicts });
      }
    }
  }

  try {
    const { data, error } = await supabase.from('reservations')
      .update(updates).eq('id', req.params.id)
      .select(`*, rooms(id,number,name), guests(id,first_name,last_name,email,phone)`).single();
    if (error) throw error;

    // Auto-update room status on check-in / check-out
    if (data.room_id) {
      if (updates.status === 'checked_in') {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', data.room_id);
      } else if (updates.status === 'checked_out' || updates.status === 'cancelled') {
        await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', data.room_id);
        // Auto-create housekeeping task
        await supabase.from('housekeeping_tasks').insert({
          property_id: data.property_id, room_id: data.room_id, reservation_id: data.id,
          type: 'checkout_clean', status: 'pending', scheduled_for: updates.status === 'checked_out'
            ? data.check_out : new Date().toISOString().split('T')[0]
        });
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reservations/:id ──
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'cancelled' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (data.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', data.room_id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reservations/:id/checkin ──
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'checked_in' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (data.room_id) await supabase.from('rooms').update({ status: 'occupied' }).eq('id', data.room_id);
    res.json({ success: true, reservation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reservations/:id/checkout ──
router.post('/:id/checkout', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'checked_out' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (data.room_id) {
      await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', data.room_id);
      await supabase.from('housekeeping_tasks').insert({
        property_id: data.property_id, room_id: data.room_id, reservation_id: data.id,
        type: 'checkout_clean', status: 'pending', scheduled_for: data.check_out
      });
    }
    res.json({ success: true, reservation: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
