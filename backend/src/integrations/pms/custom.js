/**
 * Custom / Generic PMS Adapter
 * Used for: Little Hotelier, Clock PMS, or any custom REST endpoint.
 *
 * The client configures:
 *   pms_endpoint: base URL of their PMS webhook/API
 *   pms_token:    bearer token or API key
 *   pms_auth_header: optional header name (default: Authorization)
 *
 * Revio sends standardized requests and maps the response via pms_field_map.
 */
import axios from 'axios';

function client(pmsConfig) {
  const endpoint = pmsConfig?.pms_endpoint;
  const token = pmsConfig?.pms_token;
  if (!endpoint) throw new Error('Custom PMS: pms_endpoint no configurado');
  const authHeader = pmsConfig?.pms_auth_header || 'Authorization';
  const authValue = pmsConfig?.pms_auth_prefix
    ? `${pmsConfig.pms_auth_prefix} ${token}`
    : `Bearer ${token}`;
  return axios.create({
    baseURL: endpoint,
    headers: {
      [authHeader]: token ? authValue : undefined,
      'Content-Type': 'application/json',
      'X-Revio-Client': 'Revio/1.0',
    },
    timeout: 15000,
  });
}

function mapResponse(data, fieldMap = {}) {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return data;
  const result = { ...data };
  for (const [from, to] of Object.entries(fieldMap)) {
    if (result[from] !== undefined) { result[to] = result[from]; delete result[from]; }
  }
  return result;
}

export async function getAvailability(propertySlug, pmsConfig, { checkin, checkout, adults = 1, children = 0 } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const path = pmsConfig?.pms_paths?.availability || '/availability';
    const { data } = await api.get(path, { params: { checkin, checkout, adults, children } });
    // Try to normalize to our common format
    const rooms = Array.isArray(data?.rooms || data?.data || data)
      ? (data?.rooms || data?.data || data).map(r => ({
          id: r.id || r.room_id || r.roomId,
          name: r.name || r.room_name || r.roomName || r.title,
          price_per_night: parseFloat(r.price || r.rate || r.price_per_night || 0),
          currency: r.currency || 'COP',
          available_units: r.available || r.availability || r.units || 1,
          capacity: r.capacity || r.max_guests || adults,
        }))
      : [];
    return { success: true, rooms, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message, rooms: [] };
  }
}

export async function createBooking(propertySlug, pmsConfig, bookingData, context = {}) {
  try {
    const api = client(pmsConfig);
    const path = pmsConfig?.pms_paths?.booking || '/bookings';
    const { data } = await api.post(path, {
      checkin: bookingData.checkin,
      checkout: bookingData.checkout,
      guest_name: bookingData.guest_name,
      guest_email: bookingData.guest_email,
      guests: bookingData.adults || 1,
      room_id: bookingData.room_id,
      total: bookingData.total,
      source: 'revio',
    });
    return { success: true, booking_id: data?.id || data?.booking_id || data?.reservation_id, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

export async function getOccupancy(propertySlug, pmsConfig, { date, endDate } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const path = pmsConfig?.pms_paths?.occupancy || '/occupancy';
    const { data } = await api.get(path, { params: { date, end_date: endDate } });
    return { success: true, occupancy: data, raw: data };
  } catch (err) {
    return { success: false, error: err.message, occupancy: null };
  }
}

export async function getReservations(propertySlug, pmsConfig, params = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const path = pmsConfig?.pms_paths?.reservations || '/reservations';
    const { data } = await api.get(path, { params });
    const list = Array.isArray(data?.reservations || data?.data || data) ? (data?.reservations || data?.data || data) : [];
    return { success: true, reservations: list, raw: data };
  } catch (err) {
    return { success: false, error: err.message, reservations: [] };
  }
}

export async function cancelBooking(propertySlug, pmsConfig, bookingId, reason = '', context = {}) {
  try {
    const api = client(pmsConfig);
    const path = pmsConfig?.pms_paths?.cancel || `/bookings/${bookingId}/cancel`;
    const { data } = await api.post(path, { reason });
    return { success: true, raw: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
