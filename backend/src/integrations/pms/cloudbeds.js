/**
 * Cloudbeds PMS Adapter
 * API: https://hotels.cloudbeds.com/api/v1.2/docs
 *
 * Authentication: OAuth2 Bearer token (pms_token)
 * Base URL: https://api.cloudbeds.com/api/v1.2
 */
import axios from 'axios';

const BASE_URL = 'https://api.cloudbeds.com/api/v1.2';

function client(pmsConfig) {
  const token = pmsConfig?.pms_token;
  if (!token) throw new Error('Cloudbeds: pms_token no configurado');
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

export async function getAvailability(propertySlug, pmsConfig, { checkin, checkout, adults = 1, children = 0 } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.get('/getAvailableRoomTypes', {
      params: {
        startDate: checkin,
        endDate: checkout,
        adults,
        children,
        propertyID: pmsConfig?.pms_property_id,
      }
    });
    // Normalize to common format
    const rooms = (data?.data || []).map(rt => ({
      id: rt.roomTypeID,
      name: rt.roomTypeName,
      description: rt.roomTypeDescription,
      capacity: rt.maxGuests,
      price_per_night: parseFloat(rt.roomRate || 0),
      currency: data?.currency || 'COP',
      available_units: rt.freeRooms,
    }));
    return { success: true, rooms, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message, rooms: [] };
  }
}

export async function createBooking(propertySlug, pmsConfig, bookingData, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.post('/postReservation', {
      propertyID: pmsConfig?.pms_property_id,
      startDate: bookingData.checkin,
      endDate: bookingData.checkout,
      guestFirstName: bookingData.guest_name?.split(' ')[0] || bookingData.guest_name,
      guestLastName: bookingData.guest_name?.split(' ').slice(1).join(' ') || '',
      guestEmail: bookingData.guest_email,
      rooms: [{ roomTypeID: bookingData.room_id, quantity: 1 }],
      adults: bookingData.adults || 1,
    });
    return { success: true, booking_id: data?.reservationID, raw: data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

export async function getOccupancy(propertySlug, pmsConfig, { date, endDate } = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.get('/getHotelDetails', {
      params: { propertyID: pmsConfig?.pms_property_id }
    });
    return { success: true, occupancy: data?.data, raw: data };
  } catch (err) {
    return { success: false, error: err.message, occupancy: null };
  }
}

export async function getReservations(propertySlug, pmsConfig, params = {}, context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.get('/getReservations', {
      params: { propertyID: pmsConfig?.pms_property_id, ...params }
    });
    return { success: true, reservations: data?.data || [], raw: data };
  } catch (err) {
    return { success: false, error: err.message, reservations: [] };
  }
}

export async function cancelBooking(propertySlug, pmsConfig, bookingId, reason = '', context = {}) {
  try {
    const api = client(pmsConfig);
    const { data } = await api.put('/putReservation', {
      propertyID: pmsConfig?.pms_property_id,
      reservationID: bookingId,
      status: 'canceled',
    });
    return { success: true, raw: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
