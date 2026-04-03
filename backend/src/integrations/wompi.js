import axios from 'axios';
import crypto from 'crypto';
import { db } from '../models/supabase.js';

const WOMPI_API_URL = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';

// Claves por propiedad
const KEYS = {
  'isla-palma': {
    public: process.env.WOMPI_PUBLIC_KEY_ISLA,
    private: process.env.WOMPI_PRIVATE_KEY_ISLA
  },
  tayrona: {
    public: process.env.WOMPI_PUBLIC_KEY_TAYRONA,
    private: process.env.WOMPI_PRIVATE_KEY_TAYRONA
  }
};

function getKeys(propertySlug) {
  const keys = KEYS[propertySlug];
  if (!keys?.public || !keys?.private) {
    throw new Error(`Claves Wompi no configuradas para: ${propertySlug}`);
  }
  return keys;
}

function wompiClient(propertySlug) {
  const { private: privateKey } = getKeys(propertySlug);
  return axios.create({
    baseURL: WOMPI_API_URL,
    headers: {
      Authorization: `Bearer ${privateKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

// ============================================================
// Generar referencia única para cada pago
// ============================================================
function generateReference(bookingId) {
  const timestamp = Date.now();
  const short = bookingId.substring(0, 8);
  return `MST-${short}-${timestamp}`;
}

// ============================================================
// Crear link de pago para una reserva
// ============================================================
export async function createPaymentLink(propertySlug, booking, options = {}) {
  const { public: publicKey } = getKeys(propertySlug);
  const client = wompiClient(propertySlug);

  const reference = generateReference(booking.id);
  const amountInCents = Math.round(booking.total_amount * 100);

  // Datos del link de pago Wompi
  const payload = {
    name: `Reserva ${booking.property_slug || 'Mística'} — ${booking.guest_name}`,
    description: `Check-in: ${booking.checkin_date} | Check-out: ${booking.checkout_date} | ${booking.room_name || booking.room_type}`,
    single_use: true,
    collect_shipping: false,
    currency: 'COP',
    amount_in_cents: amountInCents,
    redirect_url: options.redirect_url || process.env.FRONTEND_URL + '/payment/success',
    reference,
    customer_data: {
      email: booking.guest_email,
      full_name: booking.guest_name,
      phone_number: booking.guest_phone?.replace(/\D/g, '') || undefined
    }
  };

  const start = Date.now();
  try {
    const { data } = await client.post('/payment_links', payload);

    // Calcular expiración (48 horas por defecto)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Guardar en Supabase
    const payment = await db.createPayment({
      booking_id: booking.id,
      property_id: booking.property_id,
      wompi_reference: reference,
      payment_link_id: data.data?.id,
      payment_link_url: data.data?.url || buildFallbackUrl(publicKey, reference, amountInCents),
      amount: booking.total_amount,
      amount_in_cents: amountInCents,
      currency: 'COP',
      status: 'pending',
      expires_at: expiresAt
    });

    await db.logApiCall({
      property_id: booking.property_id,
      service: 'wompi',
      method: 'POST',
      endpoint: '/payment_links',
      request_data: { reference, amount_in_cents: amountInCents },
      response_data: data,
      status_code: 200,
      response_time_ms: Date.now() - start,
      success: true
    });

    return {
      reference,
      payment_link_url: payment.payment_link_url,
      amount: booking.total_amount,
      expires_at: expiresAt,
      payment_id: payment.id
    };
  } catch (err) {
    await db.logApiCall({
      property_id: booking.property_id,
      service: 'wompi',
      method: 'POST',
      endpoint: '/payment_links',
      status_code: err.response?.status,
      error_message: err.message,
      success: false
    });
    throw new Error(`Error creando link de pago Wompi: ${err.response?.data?.error?.message || err.message}`);
  }
}

// URL de pago directo (fallback si la API no devuelve URL)
function buildFallbackUrl(publicKey, reference, amountInCents) {
  return `https://checkout.wompi.co/p/?public-key=${publicKey}&currency=COP&amount-in-cents=${amountInCents}&reference=${reference}`;
}

// ============================================================
// Verificar estado de un pago
// ============================================================
export async function getTransactionStatus(propertySlug, transactionId) {
  const client = wompiClient(propertySlug);
  const { data } = await client.get(`/transactions/${transactionId}`);
  return data;
}

// ============================================================
// Webhook: verificar firma y procesar pago
// ============================================================
export function verifyWebhookSignature(payload, signature, propertySlug) {
  const { private: privateKey } = getKeys(propertySlug);
  const expected = crypto
    .createHmac('sha256', privateKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

export async function processWebhook(webhookData) {
  const { event, data } = webhookData;

  if (event !== 'transaction.updated') return { ignored: true };

  const transaction = data?.transaction;
  if (!transaction) return { error: 'No transaction data' };

  const reference = transaction.reference;
  const status = transaction.status; // APPROVED, DECLINED, VOIDED, ERROR

  const statusMap = {
    APPROVED: 'approved',
    DECLINED: 'declined',
    VOIDED: 'voided',
    ERROR: 'error'
  };

  const normalizedStatus = statusMap[status] || 'pending';

  // Actualizar pago en Supabase
  const payment = await db.updatePayment(reference, {
    status: normalizedStatus,
    wompi_transaction_id: transaction.id,
    paid_at: status === 'APPROVED' ? new Date().toISOString() : null,
    webhook_data: webhookData
  });

  // Si fue aprobado, actualizar estado de la reserva
  if (status === 'APPROVED' && payment?.booking_id) {
    await db.updateBooking(payment.booking_id, { status: 'paid' });
  }

  return { processed: true, status: normalizedStatus, reference };
}

export default {
  createPaymentLink,
  getTransactionStatus,
  verifyWebhookSignature,
  processWebhook
};
