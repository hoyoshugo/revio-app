import axios from 'axios';
import { db } from '../models/supabase.js';

const LOBBY_API_URL = process.env.LOBBY_API_URL || 'https://api.lobbypms.com';
const MAX_RETRIES = 3;

// In-memory cache: { [slug_endpoint]: { data, ts } }
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(slug, endpoint) { return `${slug}:${endpoint}`; }

function fromCache(slug, endpoint) {
  const hit = _cache.get(cacheKey(slug, endpoint));
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  return null;
}

function toCache(slug, endpoint, data) {
  _cache.set(cacheKey(slug, endpoint), { data, ts: Date.now() });
}

// Tokens por propiedad, leídos desde env
const TOKENS = {
  'isla-palma': process.env.LOBBY_TOKEN_ISLA_PALMA,
  tayrona: process.env.LOBBY_TOKEN_TAYRONA
};

function getToken(propertySlug) {
  const token = TOKENS[propertySlug];
  if (!token) throw new Error(`Token LobbyPMS no configurado para: ${propertySlug}`);
  return token;
}

function lobbyClient(propertySlug) {
  return axios.create({
    baseURL: LOBBY_API_URL,
    headers: {
      Authorization: `Bearer ${getToken(propertySlug)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 10000
  });
}

async function withRetry(fn, propertySlug, context = {}) {
  const start = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();

      await db.logApiCall({
        property_id: context.propertyId,
        conversation_id: context.conversationId,
        service: 'lobbypms',
        method: context.method,
        endpoint: context.endpoint,
        request_data: context.requestData,
        response_data: result,
        status_code: 200,
        response_time_ms: Date.now() - start,
        success: true
      });

      return result;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;

      await db.logApiCall({
        property_id: context.propertyId,
        service: 'lobbypms',
        method: context.method,
        endpoint: context.endpoint,
        request_data: context.requestData,
        response_data: err.response?.data,
        status_code: status,
        response_time_ms: Date.now() - start,
        success: false,
        error_message: err.message
      });

      // No reintentar en errores de cliente (4xx)
      if (status >= 400 && status < 500) break;

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // Return cached data as fallback when all retries fail
  const cached = fromCache(propertySlug, context.endpoint || 'unknown');
  if (cached) {
    console.warn(`[LobbyPMS] Using cached data for ${propertySlug}:${context.endpoint} (IP whitelist issue?)`);
    return cached;
  }

  throw lastError;
}

// ============================================================
// GET /api/v2/available-rooms — Disponibilidad con fechas
// ============================================================
export async function getAvailableRooms(propertySlug, { checkin, checkout, adults = 1, children = 0 }, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = '/api/v2/available-rooms';
  // LobbyPMS API v2 uses start_date/end_date (not checkin/checkout)
  const params = { start_date: checkin, end_date: checkout, adults };
  if (children > 0) params.children = children;

  try {
    const result = await withRetry(
      async () => {
        const { data } = await client.get(endpoint, { params });
        return data;
      },
      propertySlug,
      { ...context, method: 'GET', endpoint, requestData: params }
    );
    toCache(propertySlug, endpoint, result);
    return result;
  } catch (err) {
    const cached = fromCache(propertySlug, endpoint);
    if (cached) {
      console.warn(`[LobbyPMS] getAvailableRooms fallback to cache for ${propertySlug}`);
      return cached;
    }
    throw err;
  }
}

// ============================================================
// GET /api/v1/rate-plans — Tarifas vigentes
// ============================================================
export async function getRatePlans(propertySlug, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = '/api/v1/rate-plans';

  return withRetry(
    async () => {
      const { data } = await client.get(endpoint);
      return data;
    },
    propertySlug,
    { ...context, method: 'GET', endpoint }
  );
}

// ============================================================
// GET /api/v1/daily-occupancy — Ocupación para decisión de descuentos
// ============================================================
export async function getDailyOccupancy(propertySlug, { date, endDate } = {}, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = '/api/v1/daily-occupancy';
  const params = { date: date || new Date().toISOString().split('T')[0] };
  if (endDate) params.end_date = endDate;

  return withRetry(
    async () => {
      const { data } = await client.get(endpoint, { params });
      return data;
    },
    propertySlug,
    { ...context, method: 'GET', endpoint, requestData: params }
  );
}

// Calcula si aplica descuento (ocupación < 60% → máximo 15%)
export async function calculateDiscount(propertySlug, checkinDate) {
  try {
    const occupancyData = await getDailyOccupancy(propertySlug, { date: checkinDate });
    const occupancyPct = occupancyData?.occupancy_percentage
      || occupancyData?.data?.occupancy_percentage
      || 100;

    if (occupancyPct < 60) {
      return { eligible: true, max_discount: 15, occupancy: occupancyPct };
    }
    return { eligible: false, occupancy: occupancyPct };
  } catch {
    return { eligible: false, error: true };
  }
}

// ============================================================
// POST /api/v1/customer/{type} — Crear cliente
// ============================================================
export async function createCustomer(propertySlug, type = 'individual', customerData, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = `/api/v1/customer/${type}`;

  return withRetry(
    async () => {
      const { data } = await client.post(endpoint, customerData);
      return data;
    },
    propertySlug,
    { ...context, method: 'POST', endpoint, requestData: customerData }
  );
}

// ============================================================
// POST /api/v1/booking — Crear reserva confirmada
// ============================================================
export async function createBooking(propertySlug, bookingData, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = '/api/v1/booking';

  return withRetry(
    async () => {
      const { data } = await client.post(endpoint, bookingData);
      return data;
    },
    propertySlug,
    { ...context, method: 'POST', endpoint, requestData: bookingData }
  );
}

// ============================================================
// GET /api/v1/bookings — Listar reservas
// ============================================================
export async function listBookings(propertySlug, params = {}, context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = '/api/v1/bookings';

  return withRetry(
    async () => {
      const { data } = await client.get(endpoint, { params });
      return data;
    },
    propertySlug,
    { ...context, method: 'GET', endpoint, requestData: params }
  );
}

// ============================================================
// POST /api/v1/cancel-booking/{id} — Cancelar reserva
// ============================================================
export async function cancelBooking(propertySlug, bookingId, reason = '', context = {}) {
  const client = lobbyClient(propertySlug);
  const endpoint = `/api/v1/cancel-booking/${bookingId}`;

  return withRetry(
    async () => {
      const { data } = await client.post(endpoint, { reason });
      return data;
    },
    propertySlug,
    { ...context, method: 'POST', endpoint, requestData: { bookingId, reason } }
  );
}

// ============================================================
// Helper: Formatea disponibilidad para el agente IA
// ============================================================
export function formatRoomsForAgent(roomsData, language = 'es') {
  const noRooms = {
    es: 'No hay habitaciones disponibles para esas fechas.',
    en: 'No rooms available for those dates.',
    fr: 'Aucune chambre disponible pour ces dates.',
    de: 'Keine Zimmer für diese Daten verfügbar.'
  };

  // LobbyPMS API v2: { data: [{ date, categories: [{ name, available_rooms, plans }] }] }
  const days = roomsData?.data;
  if (Array.isArray(days) && days.length > 0) {
    // Aggregate room categories across all days (take first day as reference for categories)
    const firstDay = days[0];
    const categories = firstDay?.categories || [];
    const available = categories.filter(c => c.available_rooms > 0);
    if (available.length === 0) return noRooms[language] || noRooms.es;

    const header = language === 'en'
      ? `Available rooms (${days.length} night${days.length > 1 ? 's' : ''}):\n`
      : `Habitaciones disponibles (${days.length} noche${days.length > 1 ? 's' : ''}):\n`;

    return header + available.map(cat => {
      const stdPlan = cat.plans?.find(p => p.name === 'STANDARD_RATE') || cat.plans?.[0];
      const price2 = stdPlan?.prices?.find(p => p.people === 2)?.value || stdPlan?.prices?.[0]?.value;
      const price1 = stdPlan?.prices?.find(p => p.people === 1)?.value;
      const priceStr = price2
        ? `COP ${Number(price2).toLocaleString('es-CO')} (2 personas)`
        : price1
          ? `COP ${Number(price1).toLocaleString('es-CO')} (1 persona)`
          : 'precio a consultar';
      return `• **${cat.name}**: ${priceStr} — ${cat.available_rooms} disponible${cat.available_rooms > 1 ? 's' : ''}`;
    }).join('\n');
  }

  // Legacy format fallback: flat array of rooms
  const rooms = roomsData?.rooms || roomsData || [];
  if (!Array.isArray(rooms) || rooms.length === 0) return noRooms[language] || noRooms.es;
  return rooms.map(r => {
    const price = r.price || r.rate || r.total_price;
    return `• **${r.name || r.room_type}**: ${price ? `COP ${Number(price).toLocaleString('es-CO')}` : 'precio a consultar'}`;
  }).join('\n');
}

export default {
  getAvailableRooms,
  getRatePlans,
  getDailyOccupancy,
  calculateDiscount,
  createCustomer,
  createBooking,
  listBookings,
  cancelBooking,
  formatRoomsForAgent
};
