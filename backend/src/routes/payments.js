import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../models/supabase.js';
import wompi, { processWebhook } from '../integrations/wompi.js';
import { requireAuth } from '../middleware/auth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/payments/webhook — Webhook de Wompi
//
// E-AGENT-10 B-AGT-3 (2026-04-26): firma Wompi verificada contra UNA SOLA
// clave per-tenant. Antes iteraba TODAS las claves; un payload firmado con
// la clave del tenant A se aceptaba como tenant B. Ahora resolvemos la
// propiedad por `transaction.reference` (que tiene prefijo MST-{shortBookingId})
// y solo verificamos contra la clave de ESE tenant.
//
// Idempotencia (M4): si transaction.id ya fue procesado (UNIQUE en payments),
// retornamos 200 sin reprocesar. Wompi reintenta APPROVED múltiples veces.
router.post('/webhook', webhookLimiter, async (req, res) => {
  const signature = req.headers['x-event-checksum'];
  const { supabase } = await import('../models/supabase.js');

  try {
    // 1. Extraer reference del payload para resolver tenant
    const reference = req.body?.data?.transaction?.reference;
    const transactionId = req.body?.data?.transaction?.id;
    if (!reference) {
      return res.status(400).json({ error: 'Falta transaction.reference' });
    }

    // 2. Lookup booking → property → slug. La reference es MST-{8chars}-{timestamp}
    //    y el booking.id corto coincide con esos 8 chars.
    const shortId = reference.replace(/^[A-Z]+-/, '').split('-')[0];
    const { data: payment } = await supabase
      .from('payments')
      .select('id, wompi_reference, wompi_transaction_id, status, bookings(property_id, properties(slug, tenant_id))')
      .eq('wompi_reference', reference)
      .maybeSingle();

    if (!payment?.bookings?.properties?.slug) {
      console.warn('[Wompi-webhook] No se encontró payment para reference:', reference, 'short:', shortId);
      return res.status(404).json({ error: 'Payment no encontrado' });
    }

    const slug = payment.bookings.properties.slug;
    const propertyId = payment.bookings.property_id;

    // 3. Verificar firma SOLO contra la clave del tenant correcto
    const ok = await wompi.verifyWebhookSignature(req.body, signature, slug, propertyId);
    if (!ok) {
      console.warn('[Wompi-webhook] Firma inválida para slug:', slug);
      return res.status(400).json({ error: 'Firma inválida' });
    }

    // 4. Idempotencia: si ya procesamos este transaction.id como APPROVED, ignorar
    if (
      transactionId &&
      payment.wompi_transaction_id === transactionId &&
      payment.status === 'approved'
    ) {
      return res.json({ received: true, ignored: 'duplicate_approved' });
    }

    const result = await processWebhook(req.body);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error('[Wompi-webhook] Error procesando:', err.message);
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
      description: `Suscripción Alzio Plan ${planKey} (${billing_cycle === 'annual' ? 'anual' : 'mensual'})`,
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
//
// E-AGENT-10 M4 (2026-04-26): verificar el pago contra Wompi antes de
// confirmar. Antes mostraba "¡Pago recibido!" sin importar si era real;
// un usuario podía spoofear la URL `?id=anything` y aparentar pago exitoso.
router.get('/success', async (req, res) => {
  const { id: transactionId } = req.query;
  if (!transactionId) {
    return res.status(400).json({ error: 'transaction id requerido', success: false });
  }

  try {
    // Buscar el payment local por wompi_transaction_id
    const { supabase } = await import('../models/supabase.js');
    const { data: payment } = await supabase
      .from('payments')
      .select('status, wompi_transaction_id, paid_at, bookings(property_id, properties(slug))')
      .eq('wompi_transaction_id', transactionId)
      .maybeSingle();

    if (!payment) {
      return res.status(202).json({
        success: false,
        pending_webhook: true,
        message: 'Estamos confirmando tu pago. Recibirás un email cuando se procese.',
      });
    }

    if (payment.status === 'approved') {
      return res.json({
        success: true,
        message: '¡Pago confirmado! Tu reserva está aprobada. Recibirás un email con los detalles.',
        transaction_id: transactionId,
        paid_at: payment.paid_at,
      });
    }

    // Pendiente / declinado
    res.json({
      success: false,
      status: payment.status,
      message: payment.status === 'declined'
        ? 'Tu pago fue rechazado. Intenta con otro método o contacta al hotel.'
        : 'Estamos confirmando tu pago. Recibirás un email cuando se procese.',
      transaction_id: transactionId,
    });
  } catch (err) {
    console.error('[Wompi-success] Error:', err.message);
    res.status(500).json({ success: false, error: 'Error verificando pago' });
  }
});

export default router;
