import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../models/supabase.js';
import wompi, { processWebhook } from '../integrations/wompi.js';
import { requireAuth } from '../middleware/auth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/payments/webhook — Webhook de Wompi
router.post('/webhook', webhookLimiter, async (req, res) => {
  // Wompi envía la firma en el header
  const signature = req.headers['x-event-checksum'];

  // Verificar firma (intentar con ambas propiedades)
  let verified = false;
  const slugs = ['isla-palma', 'tayrona'];

  for (const slug of slugs) {
    try {
      if (wompi.verifyWebhookSignature(req.body, signature, slug)) {
        verified = true;
        break;
      }
    } catch { /* intentar con la siguiente */ }
  }

  if (!verified) {
    console.warn('[Webhook] Firma Wompi inválida');
    return res.status(400).json({ error: 'Firma inválida' });
  }

  try {
    const result = await processWebhook(req.body);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error('[Webhook] Error procesando:', err.message);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

// GET /api/payments — Listar pagos (dashboard)
router.get('/', requireAuth, async (req, res) => {
  const { property_id, status } = req.query;
  try {
    const { supabase } = await import('../models/supabase.js');
    let q = supabase.from('payments').select('*, bookings(guest_name, checkin_date, checkout_date, property_id)');
    if (status) q = q.eq('status', status);
    if (property_id) q = q.eq('property_id', property_id);
    q = q.order('created_at', { ascending: false }).limit(100);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ payments: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/pending — Pagos pendientes con alerta
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const { supabase } = await import('../models/supabase.js');
    const { data, error } = await supabase
      .from('payments')
      .select('*, bookings(guest_name, guest_email, guest_phone, checkin_date, property_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({
      pending_payments: data,
      total: data.length,
      total_amount: data.reduce((sum, p) => sum + p.amount, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/generate — Generar link manualmente desde dashboard
router.post('/generate', requireAuth, async (req, res) => {
  const { booking_id } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id requerido' });

  try {
    const booking = await db.getBooking(booking_id);
    const propertySlug = booking.properties?.slug;
    if (!propertySlug) return res.status(400).json({ error: 'Propiedad no encontrada' });

    const paymentInfo = await wompi.createPaymentLink(propertySlug, {
      ...booking,
      property_slug: propertySlug
    });

    res.json({
      success: true,
      payment_link_url: paymentInfo.payment_link_url,
      reference: paymentInfo.reference,
      amount: paymentInfo.amount,
      expires_at: paymentInfo.expires_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/subscription/create — Crear link de pago para activar suscripción SaaS
router.post('/subscription/create', requireAuth, async (req, res) => {
  try {
    const { plan, billing_cycle = 'monthly' } = req.body;
    const { supabase } = await import('../models/supabase.js');

    // Obtener datos del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, email, plan')
      .eq('id', req.user.tenant_id)
      .single();

    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });

    const PRICES = {
      basico:     { monthly: 299000, annual: 2990000 },
      pro:        { monthly: 599000, annual: 5990000 },
      enterprise: { monthly: 1199000, annual: 11990000 },
    };

    const planKey = plan || tenant.plan || 'basico';
    const amount = PRICES[planKey]?.[billing_cycle] || PRICES.basico.monthly;
    const reference = `SUB-${tenant.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

    // Generar link de pago Wompi (usando la propiedad principal del tenant)
    const { data: properties } = await supabase
      .from('properties')
      .select('slug')
      .eq('tenant_id', tenant.id)
      .limit(1);

    const slug = properties?.[0]?.slug || 'isla-palma';

    const paymentData = await wompi.createPaymentLink(slug, {
      amount,
      currency: 'COP',
      reference,
      guest_name: tenant.name,
      guest_email: tenant.email,
      description: `Suscripción Revio Plan ${planKey} (${billing_cycle === 'annual' ? 'anual' : 'mensual'})`,
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/panel?subscription=activated`,
    });

    // Registrar intento de suscripción
    await supabase.from('settings').upsert({
      property_id: null,
      key: `subscription_intent_${tenant.id}`,
      value: { plan: planKey, billing_cycle, reference, amount, created_at: new Date().toISOString() }
    }, { onConflict: 'property_id,key' });

    res.json({
      success: true,
      payment_link_url: paymentData.payment_link_url,
      reference,
      amount,
      plan: planKey,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/subscription/cancel — Cancelar suscripción
router.post('/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const { supabase } = await import('../models/supabase.js');
    const { reason } = req.body;

    await supabase.from('tenants')
      .update({ status: 'cancelling', cancellation_reason: reason, cancellation_requested_at: new Date().toISOString() })
      .eq('id', req.user.tenant_id);

    res.json({
      success: true,
      message: 'Solicitud de cancelación recibida. Tu acceso continúa hasta el fin del periodo pagado.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/success — Página de éxito post-pago (redireccionada por Wompi)
router.get('/success', (req, res) => {
  const { id: transactionId } = req.query;
  res.json({
    success: true,
    message: '¡Pago recibido! Tu reserva está confirmada. Recibirás un email con los detalles.',
    transaction_id: transactionId
  });
});

export default router;
