import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = Router();

async function nextFolioNumber(propertyId) {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('folios')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .gte('created_at', `${year}-01-01`);
  return `F-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
}

// GET /api/folios/:reservationId
router.get('/folios/:reservationId', requireAuth, async (req, res) => {
  try {
    const { data: folio } = await supabase
      .from('folios')
      .select('*, charges(*)')
      .eq('reservation_id', req.params.reservationId)
      .order('created_at', { ascending: false })
      .maybeSingle();
    res.json({ folio });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/folios
router.post('/folios', requireAuth, async (req, res) => {
  try {
    const { reservation_id, property_id, guest_id } = req.body;
    const folioNumber = await nextFolioNumber(property_id);
    const { data, error } = await supabase
      .from('folios')
      .insert({ reservation_id, property_id, guest_id, folio_number: folioNumber })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ folio: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/folios/:folioId/charges
router.post('/folios/:folioId/charges', requireAuth, async (req, res) => {
  try {
    const { type, description, quantity = 1, unit_price, date } = req.body;
    const total = (quantity || 1) * unit_price;
    const { data: folio } = await supabase
      .from('folios')
      .select('property_id')
      .eq('id', req.params.folioId)
      .single();
    const { data, error } = await supabase
      .from('charges')
      .insert({
        folio_id: req.params.folioId,
        property_id: folio?.property_id,
        type, description,
        quantity: quantity || 1,
        unit_price,
        total,
        date: date || new Date().toISOString().slice(0, 10),
        created_by: req.user?.email || 'system',
      })
      .select()
      .single();
    if (error) throw error;
    // Recalcular totales
    await recalcFolio(req.params.folioId);
    res.status(201).json({ charge: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/folios/:folioId/charges/:chargeId
router.delete('/folios/:folioId/charges/:chargeId', requireAuth, async (req, res) => {
  try {
    await supabase.from('charges').delete().eq('id', req.params.chargeId);
    await recalcFolio(req.params.folioId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/folios/:folioId/close
router.put('/folios/:folioId/close', requireAuth, async (req, res) => {
  try {
    await recalcFolio(req.params.folioId);
    const { data, error } = await supabase
      .from('folios')
      .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.folioId)
      .select()
      .single();
    if (error) throw error;
    res.json({ folio: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/folios/:folioId/summary
router.get('/folios/:folioId/summary', requireAuth, async (req, res) => {
  try {
    const { data: charges } = await supabase
      .from('charges')
      .select('total, type')
      .eq('folio_id', req.params.folioId);
    const subtotal = (charges || [])
      .filter(c => c.type !== 'discount')
      .reduce((s, c) => s + Number(c.total), 0);
    const discounts = (charges || [])
      .filter(c => c.type === 'discount')
      .reduce((s, c) => s + Math.abs(Number(c.total)), 0);
    const taxes = Math.round(subtotal * 0.19 * 100) / 100;
    const total = subtotal - discounts + taxes;
    res.json({ subtotal, discounts, taxes, total, charges_count: (charges || []).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function recalcFolio(folioId) {
  const { data: charges } = await supabase
    .from('charges')
    .select('total, type')
    .eq('folio_id', folioId);
  const subtotal = (charges || [])
    .filter(c => c.type !== 'discount')
    .reduce((s, c) => s + Number(c.total), 0);
  const discounts = (charges || [])
    .filter(c => c.type === 'discount')
    .reduce((s, c) => s + Math.abs(Number(c.total)), 0);
  const taxes = Math.round(subtotal * 0.19 * 100) / 100;
  const total = subtotal - discounts + taxes;
  await supabase
    .from('folios')
    .update({ subtotal, taxes, discounts, total, updated_at: new Date().toISOString() })
    .eq('id', folioId);
}

export default router;
