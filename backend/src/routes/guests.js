import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/guests ──
router.get('/', requireAuth, async (req, res) => {
  const { property_id, search, limit = 50, offset = 0 } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase.from('guests').select('*').eq('property_id', pid)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (search) {
      q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,document_number.ilike.%${search}%`);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ guests: data || [], total: count || data?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/guests/:id ──
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: guest, error } = await supabase.from('guests').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    const { data: reservations } = await supabase.from('reservations')
      .select('*, rooms(number,name)').eq('guest_id', req.params.id)
      .order('check_in', { ascending: false }).limit(20);
    const { data: wallet } = await supabase.from('wristband_wallets')
      .select('*').eq('guest_id', req.params.id).eq('is_active', true).maybeSingle();
    res.json({ ...guest, reservations: reservations || [], wallet });
  } catch (err) {
    res.status(404).json({ error: 'Huésped no encontrado' });
  }
});

// ── POST /api/guests ──
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { first_name, last_name, email, phone, nationality, document_type, document_number,
    date_of_birth, gender, address, city, country, language, tags, notes } = req.body;
  if (!first_name) return res.status(400).json({ error: 'first_name es requerido' });
  try {
    const { data, error } = await supabase.from('guests').insert({
      property_id: pid, first_name, last_name, email, phone, nationality,
      document_type: document_type || 'CC', document_number, date_of_birth,
      gender, address, city, country: country || 'Colombia',
      language: language || 'es', tags: tags || [], notes
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/guests/:id ──
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['first_name','last_name','email','phone','nationality','document_type',
    'document_number','date_of_birth','gender','address','city','country','language','tags','notes'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('guests').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
