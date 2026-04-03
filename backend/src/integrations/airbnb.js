/**
 * Airbnb API para hosts (Partner API / Open API)
 * Docs: https://www.airbnb.com/partner/partner-api
 *
 * Credenciales necesarias en .env:
 *   AIRBNB_CLIENT_ID=tu_client_id
 *   AIRBNB_CLIENT_SECRET=tu_client_secret
 *   AIRBNB_ACCESS_TOKEN_ISLA=tu_access_token
 *   AIRBNB_LISTING_ID_ISLA=123456789
 *   AIRBNB_ACCESS_TOKEN_TAYRONA=...
 *   AIRBNB_LISTING_ID_TAYRONA=...
 */
import axios from 'axios';

const AIRBNB_API_URL = 'https://api.airbnb.com/v2';

const CREDENTIALS = {
  'isla-palma': {
    access_token: process.env.AIRBNB_ACCESS_TOKEN_ISLA,
    listing_id: process.env.AIRBNB_LISTING_ID_ISLA
  },
  tayrona: {
    access_token: process.env.AIRBNB_ACCESS_TOKEN_TAYRONA,
    listing_id: process.env.AIRBNB_LISTING_ID_TAYRONA
  }
};

const CONFIGURED = (slug) => !!(CREDENTIALS[slug]?.access_token && CREDENTIALS[slug]?.access_token !== 'pendiente');

function getClient(propertySlug) {
  const creds = CREDENTIALS[propertySlug];
  if (!creds?.access_token) throw new Error(`Airbnb no configurado para: ${propertySlug}`);
  return axios.create({
    baseURL: AIRBNB_API_URL,
    headers: {
      'X-Airbnb-API-Key': process.env.AIRBNB_CLIENT_ID,
      Authorization: `Bearer ${creds.access_token}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

// ============================================================
// Obtener mensajes / threads no leídos
// ============================================================
export async function getUnreadMessages(propertySlug) {
  if (!CONFIGURED(propertySlug)) return [];

  const client = getClient(propertySlug);
  try {
    const { data } = await client.get('/threads', {
      params: {
        listing_id: CREDENTIALS[propertySlug].listing_id,
        role: 'host',
        unread: true,
        _limit: 50
      }
    });

    const threads = data.threads || data.result || [];
    return threads.map(t => {
      const lastMsg = t.messages?.[t.messages.length - 1] || t.last_message || {};
      return {
        platform: 'airbnb',
        platform_message_id: lastMsg.id || t.id,
        platform_reservation_id: t.reservation?.confirmation_code || t.reservation_id,
        guest_name: t.other_user?.first_name + ' ' + (t.other_user?.last_name || ''),
        body: lastMsg.message || lastMsg.localized_message || '',
        received_at: lastMsg.created_at,
        thread_id: t.id,
        raw: t
      };
    });
  } catch (err) {
    console.error('[Airbnb] Error obteniendo mensajes:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder en un thread de Airbnb
// ============================================================
export async function replyToThread(propertySlug, threadId, messageText) {
  if (!CONFIGURED(propertySlug)) {
    return { success: false, reason: 'airbnb_not_configured' };
  }

  const client = getClient(propertySlug);
  try {
    const { data } = await client.post(`/threads/${threadId}/messages`, {
      message: messageText
    });
    return { success: true, message_id: data.message?.id, response: data };
  } catch (err) {
    console.error('[Airbnb] Error respondiendo:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Obtener detalle de una reserva de Airbnb
// ============================================================
export async function getReservation(propertySlug, confirmationCode) {
  if (!CONFIGURED(propertySlug)) return null;
  const client = getClient(propertySlug);
  try {
    const { data } = await client.get(`/reservations/${confirmationCode}`);
    return data.reservation || data;
  } catch (err) {
    console.error('[Airbnb] Error obteniendo reserva:', err.message);
    return null;
  }
}

// ============================================================
// Webhook: procesar eventos de Airbnb
// ============================================================
export async function processWebhookEvent(payload, propertyId) {
  const eventType = payload.type || payload.event_type;
  const data = payload.data || payload;

  if (eventType === 'message.created') {
    return {
      type: 'message',
      data: {
        property_id: propertyId,
        platform: 'airbnb',
        platform_message_id: data.id || data.message_id,
        platform_reservation_id: data.reservation?.confirmation_code,
        guest_name: data.sender?.first_name || 'Huésped Airbnb',
        direction: 'inbound',
        body: data.message || data.localized_message || '',
        thread_id: data.thread_id,
        raw_payload: payload,
        status: 'unread'
      }
    };
  }

  if (eventType === 'reservation.created' || eventType === 'reservation.updated') {
    const res = data.reservation || data;
    return {
      type: 'reservation',
      data: {
        platform: 'airbnb',
        platform_reservation_id: res.confirmation_code,
        platform_status: res.status,
        guest_name: res.guest?.first_name + ' ' + (res.guest?.last_name || ''),
        guest_email: res.guest?.email,
        checkin_date: res.start_date || res.checkin_date,
        checkout_date: res.end_date || res.checkout_date,
        adults: res.adults || res.num_guests,
        children: res.children || 0,
        total_amount: res.payout_price?.amount || res.amount_earned,
        currency: res.payout_price?.currency || 'USD',
        raw_data: res
      }
    };
  }

  if (eventType === 'reservation.cancelled') {
    return {
      type: 'cancellation',
      data: { platform_reservation_id: data.confirmation_code, platform: 'airbnb', raw: payload }
    };
  }

  return { type: 'unknown', data: payload };
}

export default { getUnreadMessages, replyToThread, getReservation, processWebhookEvent, CONFIGURED };
