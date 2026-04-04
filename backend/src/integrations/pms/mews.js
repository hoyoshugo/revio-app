/**
 * Mews PMS Adapter
 * API: https://mews-systems.gitbook.io/connector-api
 *
 * Authentication: ClientToken + AccessToken
 * Base URL: https://api.mews.com (production)
 */
import axios from 'axios';

const BASE_URL = 'https://api.mews.com/api/connector/v1';

function client(pmsConfig) {
  const token = pmsConfig?.pms_token;
  const clientToken = pmsConfig?.pms_client_token;
  if (!token) throw new Error('Mews: pms_token (AccessToken) no configurado');
  return {
    post: (endpoint, body) => axios.post(`${BASE_URL}${endpoint}`, {
      ClientToken: clientToken || 'DEMO',
      AccessToken: token,
      Client: 'Revio/1.0',
      ...body,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 })
  };
}

export async function getAvailability(propertySlug, pmsConfig, { checkin, checkout, adults = 1 } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.post('/availabilities/getByRateRoomCategory', {
      StartUtc: new Date(checkin).toISOString(),
      EndUtc: new Date(checkout).toISOString(),
      OccupancyData: [{ AgeCategoryId: null, PersonCount: adults }],
    });
    const rooms = (data?.RoomCategories || []).map(rc => ({
      id: rc.Id,
      name: rc.Names?.en || rc.Names?.es || rc.Name,
      capacity: rc.Capacity || adults,
      price_per_night: rc.MinimumPrice?.Value || 0,
      currency: rc.MinimumPrice?.Currency || 'COP',
      available_units: rc.AvailableCount,
    }));
    return { success: true, rooms, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.Message || err.message, rooms: [] };
  }
}

export async function createBooking(propertySlug, pmsConfig, bookingData, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.post('/reservations/add', {
      ServiceId: pmsConfig?.pms_service_id,
      StartUtc: new Date(bookingData.checkin).toISOString(),
      EndUtc: new Date(bookingData.checkout).toISOString(),
      AdultCount: bookingData.adults || 1,
      ChildCount: bookingData.children || 0,
      Customer: {
        Email: bookingData.guest_email,
        FirstName: bookingData.guest_name?.split(' ')[0] || '',
        LastName: bookingData.guest_name?.split(' ').slice(1).join(' ') || '',
      },
    });
    return { success: true, booking_id: data?.ReservationId, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.Message || err.message };
  }
}

export async function getOccupancy(propertySlug, pmsConfig, { date, endDate } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.post('/reservations/getAll', {
      StartUtc: date ? new Date(date).toISOString() : new Date().toISOString(),
      EndUtc: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
      States: ['Confirmed', 'Started'],
    });
    return { success: true, reservations: data?.Reservations || [], raw: data };
  } catch (err) {
    return { success: false, error: err.message, reservations: [] };
  }
}

export async function getReservations(propertySlug, pmsConfig, params = {}, context = {}) {
  return getOccupancy(propertySlug, pmsConfig, params, context);
}

export async function cancelBooking(propertySlug, pmsConfig, bookingId, reason = '', context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.post('/reservations/cancel', {
      ReservationIds: [bookingId],
      ChargeCancellationFee: false,
      Notes: reason,
    });
    return { success: true, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.Message || err.message };
  }
}
