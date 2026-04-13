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

// ── PUT /api/reservations/:id — editar reserva ──
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('reservations')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ reservation: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/reservations/:id/checkin ──
router.post('/:id/checkin', requireAuth, async (req, res) => {
  try {
    const { id_type, id_number, notes } = req.body || {};

    // 1. Update reservation status
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'checked_in', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;

    // 2. Update room status
    if (data.room_id) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', data.room_id);
    }

    // 3. Insert check_in record
    await supabase.from('check_ins').insert({
      reservation_id: data.id,
      property_id: data.property_id,
      type: 'checkin',
      actual_at: new Date().toISOString(),
      room_id: data.room_id,
      guest_id: data.guest_id,
      staff_id: req.user?.email || 'system',
      notes,
      id_type,
      id_number,
    }).catch(() => {}); // table might not exist yet

    // 4. Create folio if none exists
    let folio = null;
    try {
      const { data: existingFolio } = await supabase
        .from('folios')
        .select('id')
        .eq('reservation_id', data.id)
        .maybeSingle();

      if (!existingFolio) {
        const year = new Date().getFullYear();
        const { count } = await supabase.from('folios')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', data.property_id)
          .gte('created_at', `${year}-01-01`);

        const folioNumber = `F-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
        const { data: newFolio } = await supabase.from('folios').insert({
          reservation_id: data.id,
          property_id: data.property_id,
          guest_id: data.guest_id,
          folio_number: folioNumber,
        }).select().single();
        folio = newFolio;

        // Auto-add room charge for all nights
        if (folio && data.rate_per_night && data.nights) {
          await supabase.from('charges').insert({
            folio_id: folio.id,
            property_id: data.property_id,
            type: 'room',
            description: `Habitación ${data.nights} noche(s)`,
            quantity: data.nights,
            unit_price: data.rate_per_night,
            total: data.rate_per_night * data.nights,
          });
          await supabase.from('folios').update({
            subtotal: data.rate_per_night * data.nights,
            taxes: Math.round(data.rate_per_night * data.nights * 0.19),
            total: Math.round(data.rate_per_night * data.nights * 1.19),
          }).eq('id', folio.id);
        }
      }
    } catch {} // tables might not exist

    res.json({ success: true, reservation: data, folio });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reservations/:id/checkout ──
router.post('/:id/checkout', requireAuth, async (req, res) => {
  try {
    // 1. Update reservation status
    const { data, error } = await supabase.from('reservations')
      .update({ status: 'checked_out', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;

    // 2. Update room + housekeeping
    if (data.room_id) {
      await supabase.from('rooms').update({ status: 'dirty' }).eq('id', data.room_id);
      await supabase.from('housekeeping').upsert({
        property_id: data.property_id,
        room_id: data.room_id,
        date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        priority: 'high',
      }, { onConflict: 'property_id,room_id,date' }).catch(() => {});
    }

    // 3. Insert check_out record
    await supabase.from('check_ins').insert({
      reservation_id: data.id,
      property_id: data.property_id,
      type: 'checkout',
      actual_at: new Date().toISOString(),
      room_id: data.room_id,
      guest_id: data.guest_id,
      staff_id: req.user?.email || 'system',
    }).catch(() => {});

    // 4. Get folio summary
    let folio = null;
    try {
      const { data: f } = await supabase
        .from('folios')
        .select('*, charges(*)')
        .eq('reservation_id', data.id)
        .maybeSingle();
      folio = f;
    } catch {}

    res.json({
      success: true,
      reservation: data,
      folio,
      pending_amount: folio?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reservations/arrivals — check-ins de hoy ──
router.get('/arrivals', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const pid = req.query.property_id || req.user.property_id;
    const { data } = await supabase
      .from('reservations')
      .select('*, rooms(number, name), room_types(name)')
      .eq('property_id', pid)
      .eq('check_in', today)
      .in('status', ['confirmed', 'pending']);
    res.json({ arrivals: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/reservations/departures — check-outs de hoy ──
router.get('/departures', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const pid = req.query.property_id || req.user.property_id;
    const { data } = await supabase
      .from('reservations')
      .select('*, rooms(number, name), room_types(name)')
      .eq('property_id', pid)
      .eq('check_out', today)
      .eq('status', 'checked_in');
    res.json({ departures: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/reservations/occupancy — estadísticas de ocupación ──
router.get('/occupancy', requireAuth, async (req, res) => {
  try {
    const pid = req.query.property_id || req.user.property_id;
    const today = new Date().toISOString().slice(0, 10);

    const { data: totalRooms } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('is_active', true);

    const { data: occupied } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .eq('status', 'checked_in');

    const totalCount = totalRooms || 0;
    const occupiedCount = occupied || 0;
    const rate = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

    res.json({
      total_rooms: totalCount,
      occupied: occupiedCount,
      available: totalCount - occupiedCount,
      occupancy_rate: rate,
      date: today,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
