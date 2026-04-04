import axios from 'axios';
import crypto from 'crypto';
import { db } from '../models/supabase.js';
import { getWompiConfig } from '../services/connectionService.js';

const WOMPI_API_URL = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';

/**
 * Resuelve las claves de Wompi desde la BD.
 * Acepta (propertyId, propertySlug) para compatibilidad con código legacy.
 * El propertyId (UUID) es preferido; el slug es fallback.
 */
async function resolveKeys(propertyId, propertySlug) {
  const config = await getWompiConfig(propertyId, propertySlug);
  if (!config?.public_key || !config?.private_key) {
    throw new Error(`Claves Wompi no configuradas para: ${propertySlug || propertyId}`);
  }
  return config;
}

function wompiClientWith(privateKey) {
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
  const keys = await resolveKeys(booking.property_id, propertySlug);
  const client = wompiClientWith(keys.private_key);

  const reference = generateReference(booking.id);
  const amountInCents = Math.round(booking.total_amount * 100);

  // Datos del link de pago Wompi
  const payload = {
    name: `Reserva ${booking.property_slug || propertySlug} — ${booking.guest_name}`,
    description: `Check-in: ${booking.checkin_date} | Check-out: ${booking.checkout_date} | ${booking.room_name || booking.room_type}`,
    single_use: true,
    collect_shipping: false,
    currency: 'COP',
    amount_in_cents: amountInCents,
    redirect_url: options.redirect_url || (process.env.FRONTEND_URL + '/payment/success'),
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
      payment_link_url: data.data?.url || buildFallbackUrl(keys.public_key, reference, amountInCents),
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
export async function getTransactionStatus(propertySlug, transactionId, propertyId = null) {
  const keys = await resolveKeys(propertyId, propertySlug);
  const client = wompiClientWith(keys.private_key);
  const { data } = await client.get(`/transactions/${transactionId}`);
  return data;
}

// ============================================================
// Webhook: verificar firma
// Acepta propertyId directo o intenta resolver por slug
// ============================================================
export async function verifyWebhookSignature(payload, signature, propertySlug, propertyId = null) {
  try {
    const keys = await resolveKeys(propertyId, propertySlug);
    const expected = crypto
      .createHmac('sha256', keys.private_key)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
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
