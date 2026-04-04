/**
 * LobbyPMS Adapter — wraps existing lobbyPMS integration
 * Implements the common PMS interface.
 */
import * as lobby from '../lobbyPMS.js';

export async function getAvailability(propertySlug, pmsConfig, { checkin, checkout, adults = 1, children = 0 } = {}, context = {}) {
  return lobby.getAvailableRooms(propertySlug, { checkin, checkout, adults, children }, context);
}

export async function createBooking(propertySlug, pmsConfig, bookingData, context = {}) {
  return lobby.createBooking(propertySlug, bookingData, context);
}

export async function getOccupancy(propertySlug, pmsConfig, { date, endDate } = {}, context = {}) {
  return lobby.getDailyOccupancy(propertySlug, { date, endDate }, context);
}

export async function getReservations(propertySlug, pmsConfig, params = {}, context = {}) {
  return lobby.listBookings(propertySlug, params, context);
}

export async function cancelBooking(propertySlug, pmsConfig, bookingId, reason = '', context = {}) {
  return lobby.cancelBooking(propertySlug, bookingId, reason, context);
}
