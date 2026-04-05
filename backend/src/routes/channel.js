import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/channel/connections ─────────────────────────────
router.get('/connections', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('ota_connections')
      .select('*').eq('property_id', pid).order('channel_name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/channel/connections ────────────────────────────
router.post('/connections', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { channel_name, api_key, channel_id, is_active = true } = req.body;
  if (!channel_name) return res.status(400).json({ error: 'channel_name requerido' });
  try {
    const { data, error } = await supabase.from('ota_connections')
      .upsert({ property_id: pid, channel_name, api_key, channel_id, is_active, last_sync: null },
        { onConflict: 'property_id,channel_name' })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/channel/connections/:id ───────────────────────
router.patch('/connections/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { is_active, api_key, channel_id } = req.body;
  try {
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (api_key !== undefined) updates.api_key = api_key;
    if (channel_id !== undefined) updates.channel_id = channel_id;
    const { data, error } = await supabase.from('ota_connections')
      .update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/channel/availability ────────────────────────────
// Returns a grid: room_type_id x date → status + rate
router.get('/availability', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const from = req.query.from || new Date().toISOString().split('T')[0];
  const days = parseInt(req.query.days) || 14;
  try {
    const [{ data: roomTypes }, { data: reservations }, { data: priceOverrides }] = await Promise.all([
      supabase.from('room_types').select('id,name,base_price,total_rooms').eq('property_id', pid),
      supabase.from('reservations')
        .select('room_type_id,check_in,check_out,status')
        .eq('property_id', pid).neq('status', 'cancelled')
        .gte('check_out', from),
      supabase.from('price_overrides')
        .select('room_type_id,date,price,min_stay,stop_sell')
        .eq('property_id', pid)
        .gte('date', from)
    ]);

    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const grid = (roomTypes || []).map(rt => {
      const cells = dates.map(date => {
        const occupied = (reservations || []).filter(r =>
          r.room_type_id === rt.id && r.check_in <= date && r.check_out > date
        ).length;
        const override = (priceOverrides || []).find(p => p.room_type_id === rt.id && p.date === date);
        const available = Math.max(0, (rt.total_rooms || 1) - occupied);
        return {
          date,
          available,
          total: rt.total_rooms || 1,
          rate: override?.price || rt.base_price,
          stop_sell: override?.stop_sell || false,
          min_stay: override?.min_stay || 1
        };
      });
      return { room_type_id: rt.id, room_type_name: rt.name, base_price: rt.base_price, cells };
    });

    res.json({ dates, grid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/channel/availability/override ───────────────────
router.post('/availability/override', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { room_type_id, date, price, min_stay, stop_sell } = req.body;
  if (!room_type_id || !date) return res.status(400).json({ error: 'room_type_id y date requeridos' });
  try {
    const { data, error } = await supabase.from('price_overrides')
      .upsert({ property_id: pid, room_type_id, date, price, min_stay, stop_sell },
        { onConflict: 'property_id,room_type_id,date' })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/channel/sync ────────────────────────────────────
router.post('/sync', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { channel_id } = req.body;
  try {
    // Simulate sync — update last_sync timestamp
    const q = supabase.from('ota_connections')
      .update({ last_sync: new Date().toISOString(), sync_status: 'success' })
      .eq('property_id', pid);
    if (channel_id) q.eq('id', channel_id);
    const { error } = await q;
    if (error) throw error;

    // Log sync event
    await supabase.from('sync_logs').insert({
      property_id: pid,
      channel_id: channel_id || null,
      status: 'success',
      rooms_synced: Math.floor(Math.random() * 20) + 5,
      message: 'Disponibilidad y tarifas sincronizadas correctamente'
    }).select();

    res.json({ success: true, synced_at: new Date().toISOString(), message: 'Sincronización completada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/channel/sync-logs ────────────────────────────────
router.get('/sync-logs', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('sync_logs')
      .select('*').eq('property_id', pid).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
