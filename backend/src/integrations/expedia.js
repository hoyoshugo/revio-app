/**
 * Expedia Partner Central API (EPC)
 * Docs: https://developers.expediagroup.com/docs/products/rapid
 *
 * .env requerido:
 *   EXPEDIA_API_KEY_ISLA=pendiente
 *   EXPEDIA_SECRET_ISLA=pendiente
 *   EXPEDIA_PROPERTY_ID_ISLA=pendiente
 *   EXPEDIA_API_KEY_TAYRONA=pendiente
 *   EXPEDIA_SECRET_TAYRONA=pendiente
 *   EXPEDIA_PROPERTY_ID_TAYRONA=pendiente
 */
import axios from 'axios';
import crypto from 'crypto';

const EPC_API_URL = 'https://services.expediapartnercentral.com';

const CREDENTIALS = {
  'isla-palma': {
    api_key: process.env.EXPEDIA_API_KEY_ISLA,
    secret: process.env.EXPEDIA_SECRET_ISLA,
    property_id: process.env.EXPEDIA_PROPERTY_ID_ISLA
  },
  tayrona: {
    api_key: process.env.EXPEDIA_API_KEY_TAYRONA,
    secret: process.env.EXPEDIA_SECRET_TAYRONA,
    property_id: process.env.EXPEDIA_PROPERTY_ID_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.api_key && CREDENTIALS[slug]?.api_key !== 'pendiente');

function getClient(slug) {
  const { api_key, secret } = CREDENTIALS[slug];
  // Expedia usa Basic Auth con api_key:secret
  const token = Buffer.from(`${api_key}:${secret}`).toString('base64');
  return axios.create({
    baseURL: EPC_API_URL,
    headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000
  });
}

export async function getUnreadMessages(slug) {
  if (!CONFIGURED(slug)) return [];
  const { property_id } = CREDENTIALS[slug];
  try {
    const { data } = await getClient(slug).get(`/properties/${property_id}/messages`, {
      params: { status: 'unread', limit: 50 }
    });
    return (data.messages || []).map(m => ({
      platform: 'expedia',
      platform_message_id: m.id,
      platform_reservation_id: m.reservation_id,
      guest_name: m.guest_name || m.traveler_name,
      body: m.body || m.message,
      received_at: m.sent_at,
      raw: m
    }));
  } catch (err) {
    console.error('[Expedia] Error mensajes:', err.response?.data || err.message);
    return [];
  }
}

export async function replyToMessage(slug, reservationId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'expedia_not_configured' };
  const { property_id } = CREDENTIALS[slug];
  try {
    const { data } = await getClient(slug).post(`/properties/${property_id}/messages`, {
      reservation_id: reservationId, body: text
    });
    return { success: true, message_id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function processWebhookEvent(payload, propertyId) {
  const type = payload.event_type || payload.type;
  const res = payload.reservation || payload.booking || {};

  if (type === 'message.received') {
    return {
      type: 'message',
      data: {
        property_id: propertyId, platform: 'expedia',
        platform_message_id: payload.message_id,
        platform_reservation_id: res.id || payload.reservation_id,
        guest_name: res.primary_guest?.first_name || 'Huésped Expedia',
        direction: 'inbound', body: payload.body || '', raw_payload: payload, status: 'unread'
      }
    };
  }
  if (type === 'reservation.created' || type === 'reservation.modified') {
    return {
      type: 'reservation',
      data: {
        platform: 'expedia', platform_reservation_id: res.id,
        platform_status: res.status,
        guest_name: `${res.primary_guest?.first_name || ''} ${res.primary_guest?.last_name || ''}`.trim(),
        guest_email: res.primary_guest?.email,
        checkin_date: res.check_in_date, checkout_date: res.check_out_date,
        adults: res.adults, total_amount: res.amount_charged,
        currency: res.currency || 'USD', raw_data: res
      }
    };
  }
  if (type === 'reservation.cancelled') {
    return { type: 'cancellation', data: { platform_reservation_id: res.id, platform: 'expedia', raw: payload } };
  }
  return { type: 'unknown', data: payload };
}

export default { getUnreadMessages, replyToMessage, processWebhookEvent, CONFIGURED };
