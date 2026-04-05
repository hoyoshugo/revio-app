import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { createHash } from 'crypto';

const router = Router();

// ── GET /api/wallets ──
router.get('/', requireAuth, async (req, res) => {
  const { property_id, is_active, guest_id } = req.query;
  const pid = property_id || req.user.property_id;
  try {
    let q = supabase.from('wristband_wallets')
      .select('*, guests(id,first_name,last_name,phone,email), reservations(id,check_in,check_out)')
      .eq('property_id', pid).order('created_at', { ascending: false });
    if (is_active !== undefined) q = q.eq('is_active', is_active === 'true');
    if (guest_id) q = q.eq('guest_id', guest_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ wallets: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/wallets/:id ──
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: wallet, error } = await supabase.from('wristband_wallets')
      .select('*, guests(*), reservations(id,check_in,check_out,rooms(number,name))')
      .eq('id', req.params.id).single();
    if (error) throw error;
    const { data: transactions } = await supabase.from('wallet_transactions')
      .select('*').eq('wallet_id', req.params.id).order('created_at', { ascending: false }).limit(50);
    res.json({ ...wallet, transactions: transactions || [] });
  } catch (err) {
    res.status(404).json({ error: 'Billetera no encontrada' });
  }
});

// ── GET /api/wallets/code/:code — Buscar por código de brazalete ──
router.get('/code/:code', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('wristband_wallets')
      .select('*, guests(id,first_name,last_name,phone)')
      .eq('wristband_code', req.params.code).single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Brazalete no encontrado' });
  }
});

// ── POST /api/wallets — Crear billetera ──
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { guest_id, reservation_id, guest_name, initial_balance, wristband_code } = req.body;
  const code = wristband_code || `RV-${Date.now().toString(36).toUpperCase()}`;
  const qrData = JSON.stringify({ type: 'revio_wallet', code, property_id: pid });
  try {
    const { data, error } = await supabase.from('wristband_wallets').insert({
      property_id: pid, guest_id, reservation_id, guest_name,
      wristband_code: code, qr_data: qrData,
      balance: initial_balance || 0, is_active: true, activated_at: new Date().toISOString()
    }).select('*, guests(id,first_name,last_name)').single();
    if (error) throw error;
    if (initial_balance && initial_balance > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: data.id, property_id: pid, type: 'topup',
        amount: initial_balance, balance_after: initial_balance,
        description: 'Saldo inicial', created_by: req.user.id
      });
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallets/:id/topup — Recargar saldo ──
router.post('/:id/topup', requireAuth, async (req, res) => {
  const { amount, description, reference } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount debe ser positivo' });
  try {
    const { data: wallet, error: wErr } = await supabase.from('wristband_wallets')
      .select('balance,property_id').eq('id', req.params.id).single();
    if (wErr) throw wErr;
    const newBalance = wallet.balance + parseFloat(amount);
    await supabase.from('wristband_wallets').update({ balance: newBalance }).eq('id', req.params.id);
    const { data: txn, error: txErr } = await supabase.from('wallet_transactions').insert({
      wallet_id: req.params.id, property_id: wallet.property_id,
      type: 'topup', amount: parseFloat(amount), balance_after: newBalance,
      description: description || 'Recarga', reference, created_by: req.user.id
    }).select().single();
    if (txErr) throw txErr;
    res.json({ success: true, new_balance: newBalance, transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallets/:id/charge — Cobrar ──
router.post('/:id/charge', requireAuth, async (req, res) => {
  const { amount, description, pos_order_id } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount debe ser positivo' });
  try {
    const { data: wallet, error: wErr } = await supabase.from('wristband_wallets')
      .select('balance,property_id,is_active').eq('id', req.params.id).single();
    if (wErr || !wallet) return res.status(404).json({ error: 'Billetera no encontrada' });
    if (!wallet.is_active) return res.status(400).json({ error: 'Billetera inactiva' });
    if (wallet.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
    const newBalance = wallet.balance - parseFloat(amount);
    await supabase.from('wristband_wallets').update({ balance: newBalance }).eq('id', req.params.id);
    const { data: txn } = await supabase.from('wallet_transactions').insert({
      wallet_id: req.params.id, property_id: wallet.property_id,
      type: 'charge', amount: -parseFloat(amount), balance_after: newBalance,
      description, pos_order_id, created_by: req.user.id
    }).select().single();
    res.json({ success: true, new_balance: newBalance, transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/wallets/:id/deactivate ──
router.patch('/:id/deactivate', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('wristband_wallets')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, wallet: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/wallets/:id/transactions ──
router.get('/:id/transactions', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('wallet_transactions')
      .select('*').eq('wallet_id', req.params.id)
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ transactions: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
