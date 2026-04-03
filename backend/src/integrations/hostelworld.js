/**
 * Hostelworld API (Channel Manager API)
 * Docs: https://www.hostelworldgroup.com/distribution-api
 *
 * Credenciales necesarias en .env:
 *   HOSTELWORLD_API_KEY_ISLA=tu_api_key
 *   HOSTELWORLD_PROPERTY_ID_ISLA=tu_property_id
 *   HOSTELWORLD_API_KEY_TAYRONA=...
 *   HOSTELWORLD_PROPERTY_ID_TAYRONA=...
 */
import axios from 'axios';

const HW_API_URL = process.env.HOSTELWORLD_API_URL || 'https://api.hostelworld.com/2.0';

const CREDENTIALS = {
  'isla-palma': {
    api_key: process.env.HOSTELWORLD_API_KEY_ISLA,
    property_id: process.env.HOSTELWORLD_PROPERTY_ID_ISLA
  },
  tayrona: {
    api_key: process.env.HOSTELWORLD_API_KEY_TAYRONA,
    property_id: process.env.HOSTELWORLD_PROPERTY_ID_TAYRONA
  }
};

const CONFIGURED = (slug) => !!(CREDENTIALS[slug]?.api_key && CREDENTIALS[slug]?.api_key !== 'pendiente');

function getClient(propertySlug) {
  const creds = CREDENTIALS[propertySlug];
  if (!creds?.api_key) throw new Error(`Hostelworld no configurado para: ${propertySlug}`);
  return axios.create({
    baseURL: HW_API_URL,
    headers: {
      'X-API-Key': creds.api_key,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 15000
  });
}

// ============================================================
// Obtener mensajes no leídos de Hostelworld
// ============================================================
export async function getUnreadMessages(propertySlug) {
  if (!CONFIGURED(propertySlug)) return [];

  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);

  try {
    const { data } = await client.get(`/properties/${creds.property_id}/messages`, {
      params: { status: 'unread', limit: 50 }
    });

    return (data.messages || []).map(m => ({
      platform: 'hostelworld',
      platform_message_id: m.id,
      platform_reservation_id: m.booking_id || m.reservation_id,
      guest_name: m.guest?.name || m.guest_name,
      body: m.content || m.message,
      received_at: m.created_at,
      raw: m
    }));
  } catch (err) {
    console.error('[Hostelworld] Error obteniendo mensajes:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder un mensaje en Hostelworld
// ============================================================
export async function replyToMessage(propertySlug, reservationId, messageText) {
  if (!CONFIGURED(propertySlug)) {
    return { success: false, reason: 'hostelworld_not_configured' };
  }

  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);

  try {
    const { data } = await client.post(`/properties/${creds.property_id}/messages`, {
      booking_id: reservationId,
      content: messageText
    });
    return { success: true, message_id: data.id, response: data };
  } catch (err) {
    console.error('[Hostelworld] Error enviando mensaje:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Obtener reserva de Hostelworld
// ============================================================
export async function getReservation(propertySlug, bookingId) {
  if (!CONFIGURED(propertySlug)) return null;
  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);
  try {
    const { data } = await client.get(`/properties/${creds.property_id}/bookings/${bookingId}`);
    return data;
  } catch (err) {
    console.error('[Hostelworld] Error obteniendo reserva:', err.message);
    return null;
  }
}

// ============================================================
// Webhook: procesar eventos de Hostelworld
// ============================================================
export async function processWebhookEvent(payload, propertyId) {
  const eventType = payload.event || payload.notification_type;
  const booking = payload.booking || payload.reservation || {};

  if (eventType === 'new_message' || eventType === 'MESSAGE') {
    return {
      type: 'message',
      data: {
        property_id: propertyId,
        platform: 'hostelworld',
        platform_message_id: payload.message_id || payload.id,
        platform_reservation_id: payload.booking_id || booking.id,
        guest_name: booking.guest?.name || payload.guest_name,
        direction: 'inbound',
        body: payload.message || payload.content || '',
        raw_payload: payload,
        status: 'unread'
      }
    };
  }

  if (eventType === 'new_booking' || eventType === 'BOOKING') {
    return {
      type: 'reservation',
      data: {
        platform: 'hostelworld',
        platform_reservation_id: booking.id,
        platform_status: booking.status,
        guest_name: booking.guest?.name,
        guest_email: booking.guest?.email,
        guest_phone: booking.guest?.phone,
        checkin_date: booking.checkin,
        checkout_date: booking.checkout,
        adults: booking.guests || booking.adults,
        total_amount: booking.total_price || booking.amount,
        currency: booking.currency || 'COP',
        raw_data: booking
      }
    };
  }

  if (eventType === 'cancelled_booking' || eventType === 'CANCELLATION') {
    return {
      type: 'cancellation',
      data: { platform_reservation_id: booking.id, platform: 'hostelworld', raw: payload }
    };
  }

  return { type: 'unknown', data: payload };
}

export default { getUnreadMessages, replyToMessage, getReservation, processWebhookEvent, CONFIGURED };
