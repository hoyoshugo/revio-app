/**
 * Booking.com Connectivity API
 * Docs: https://developers.booking.com/api/
 *
 * Credenciales necesarias en .env:
 *   BOOKING_USERNAME_ISLA=tu_username
 *   BOOKING_PASSWORD_ISLA=tu_password
 *   BOOKING_HOTEL_ID_ISLA=123456
 *   BOOKING_USERNAME_TAYRONA=...
 *   BOOKING_PASSWORD_TAYRONA=...
 *   BOOKING_HOTEL_ID_TAYRONA=...
 */
import axios from 'axios';
import { db } from '../models/supabase.js';

const BOOKING_API_URL = 'https://supply-xml.booking.com';

const CREDENTIALS = {
  'isla-palma': {
    username: process.env.BOOKING_USERNAME_ISLA,
    password: process.env.BOOKING_PASSWORD_ISLA,
    hotel_id: process.env.BOOKING_HOTEL_ID_ISLA
  },
  tayrona: {
    username: process.env.BOOKING_USERNAME_TAYRONA,
    password: process.env.BOOKING_PASSWORD_TAYRONA,
    hotel_id: process.env.BOOKING_HOTEL_ID_TAYRONA
  }
};

const CONFIGURED = (slug) => !!(CREDENTIALS[slug]?.username && CREDENTIALS[slug]?.username !== 'pendiente');

function getClient(propertySlug) {
  const creds = CREDENTIALS[propertySlug];
  if (!creds?.username) throw new Error(`Booking.com no configurado para: ${propertySlug}`);
  return axios.create({
    baseURL: BOOKING_API_URL,
    auth: { username: creds.username, password: creds.password },
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 15000
  });
}

// ============================================================
// Obtener mensajes no leídos de Booking.com
// ============================================================
export async function getUnreadMessages(propertySlug) {
  if (!CONFIGURED(propertySlug)) return [];

  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);

  try {
    // Endpoint de mensajes de la Connectivity API
    const { data } = await client.get('/hotels/messages', {
      params: {
        hotel_id: creds.hotel_id,
        status: 'unread',
        limit: 50
      }
    });

    return (data.messages || []).map(m => ({
      platform: 'booking',
      platform_message_id: m.id || m.message_id,
      platform_reservation_id: m.reservation_id,
      guest_name: m.booker_name || m.guest_name,
      body: m.message || m.text,
      received_at: m.created_at || m.date,
      raw: m
    }));
  } catch (err) {
    console.error('[Booking.com] Error obteniendo mensajes:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder un mensaje en Booking.com
// ============================================================
export async function replyToMessage(propertySlug, reservationId, messageText) {
  if (!CONFIGURED(propertySlug)) {
    return { success: false, reason: 'booking_not_configured' };
  }

  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);

  try {
    const { data } = await client.post('/hotels/messages/send', {
      hotel_id: creds.hotel_id,
      reservation_id: reservationId,
      message: messageText
    });

    return { success: true, message_id: data.message_id, response: data };
  } catch (err) {
    console.error('[Booking.com] Error enviando mensaje:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Obtener detalle de una reserva de Booking.com
// ============================================================
export async function getReservation(propertySlug, reservationId) {
  if (!CONFIGURED(propertySlug)) return null;

  const creds = CREDENTIALS[propertySlug];
  const client = getClient(propertySlug);

  try {
    const { data } = await client.get(`/hotels/reservations/${reservationId}`, {
      params: { hotel_id: creds.hotel_id }
    });
    return data;
  } catch (err) {
    console.error('[Booking.com] Error obteniendo reserva:', err.message);
    return null;
  }
}

// ============================================================
// Webhook: procesar evento recibido de Booking.com
// El endpoint POST /api/ota/webhook/booking recibe estos eventos
// ============================================================
export async function processWebhookEvent(payload, propertyId) {
  const eventType = payload.event || payload.type;
  const reservation = payload.reservation || payload.booking || {};

  const normalizedMessage = {
    property_id: propertyId,
    platform: 'booking',
    platform_message_id: payload.id || payload.message_id,
    platform_reservation_id: reservation.id || payload.reservation_id,
    guest_name: reservation.booker?.name || reservation.guest_name,
    direction: 'inbound',
    body: payload.message?.text || payload.message || '',
    raw_payload: payload,
    status: 'unread'
  };

  if (eventType === 'MESSAGE' || eventType === 'new_message') {
    return { type: 'message', data: normalizedMessage };
  }
  if (eventType === 'RESERVATION' || eventType === 'new_booking') {
    return {
      type: 'reservation',
      data: {
        platform: 'booking',
        platform_reservation_id: reservation.id,
        guest_name: reservation.booker?.name || reservation.guest_name,
        guest_email: reservation.booker?.email,
        guest_phone: reservation.booker?.phone,
        checkin_date: reservation.checkin_date || reservation.arrival_date,
        checkout_date: reservation.checkout_date || reservation.departure_date,
        adults: reservation.adults || reservation.number_of_adults,
        children: reservation.children || 0,
        total_amount: reservation.price?.total || reservation.total_price,
        commission_amount: reservation.commission,
        currency: reservation.price?.currency || 'COP',
        raw_data: reservation
      }
    };
  }
  if (eventType === 'CANCELLATION' || eventType === 'reservation_cancelled') {
    return { type: 'cancellation', data: { platform_reservation_id: reservation.id, raw: payload } };
  }

  return { type: 'unknown', data: payload };
}

export default { getUnreadMessages, replyToMessage, getReservation, processWebhookEvent, CONFIGURED };
