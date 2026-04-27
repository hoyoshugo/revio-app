import axios from 'axios';
import { db } from '../models/supabase.js';
import { getLobbyPMSToken } from '../services/connectionService.js';

// Use Cloudflare Worker proxy if configured (stable IP, solves Railway dynamic IP issue)
const LOBBY_API_URL = process.env.LOBBYPMS_PROXY_URL
  ? `${process.env.LOBBYPMS_PROXY_URL}/proxy`
  : (process.env.LOBBY_API_URL || 'https://api.lobbypms.com');
const MAX_RETRIES = 3;

// E-AGENT-12 H-AGT-4 (2026-04-26): TTL diferenciado per endpoint.
// Antes 10min uniforme: la availability cacheada podía mostrar un cuarto
// libre que ya estaba sold-out → confirm_booking fallaba o duplicaba.
// Endpoints booking-bound usan TTL corto; endpoints estáticos quedan largos.
const CACHE_TTL_AVAILABILITY = 60 * 1000;        // 1 min para availability
const CACHE_TTL_OCCUPANCY    = 5 * 60 * 1000;    // 5 min para occupancy
const CACHE_TTL_DEFAULT      = 10 * 60 * 1000;   // 10 min para rate plans, configs

function ttlFor(endpoint) {
  if (!endpoint) return CACHE_TTL_DEFAULT;
  if (endpoint.includes('available-rooms')) return CACHE_TTL_AVAILABILITY;
  if (endpoint.includes('daily-occupancy')) return CACHE_TTL_OCCUPANCY;
  return CACHE_TTL_DEFAULT;
}

// In-memory cache: { [slug_endpoint]: { data, ts } }
const _cache = new Map();

function cacheKey(slug, endpoint) { return `${slug}:${endpoint}`; }

function fromCache(slug, endpoint) {
  const hit = _cache.get(cacheKey(slug, endpoint));
  if (hit && Date.now() - hit.ts < ttlFor(endpoint)) return hit.data;
  return null;
}

function toCache(slug, endpoint, data) {
  _cache.set(cacheKey(slug, endpoint), { data, ts: Date.now() });
}

/**
 * Resuelve el token de LobbyPMS desde la BD (settings table).
 * Fallback a ENV var para compatibilidad durante migración.
 * context.propertyId es el UUID de la propiedad (requerido para BD).
 */
async function resolveToken(propertySlug, propertyId) {
  const token = await getLobbyPMSToken(propertyId, propertySlug);
  if (!token) throw new Error(`Token LobbyPMS no configurado para: ${propertySlug}`);
  return token;
}

async function lobbyClientFor(propertySlug, propertyId) {
  const token = await resolveToken(propertySlug, propertyId);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  // Add proxy secret header when using Cloudflare Worker
  if (process.env.LOBBYPMS_PROXY_URL && process.env.LOBBYPMS_PROXY_SECRET) {
    headers['X-Proxy-Secret'] = process.env.LOBBYPMS_PROXY_SECRET;
  }
  return axios.create({
    baseURL: LOBBY_API_URL,
    headers,
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

      // No reintentar en errores de cliente (4xx) salvo 408/429
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) break;

      if (attempt < MAX_RETRIES) {
        // E-AGENT-12 H-AGT-4: exponential backoff con jitter.
        // Antes era linear (1s, 2s, 3s) sin jitter → thundering herd
        // si N requests fallan al mismo tiempo, reintentan al unísono.
        // Ahora 1s * 2^(attempt-1) ± 30% jitter: 1s±300ms, 2s±600ms, 4s±1200ms.
        const base = 1000 * Math.pow(2, attempt - 1);
        const jitter = base * (Math.random() * 0.6 - 0.3); // -30% a +30%
        const delay = Math.max(200, Math.round(base + jitter));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // E-AGENT-12 H-AGT-4: NO servir cache para flows booking-bound.
  // Antes retornaba cached data en cualquier endpoint cuando todos los
  // retries fallaban — incluyendo availability cacheada → confirm_booking
  // sobre stock stale. Ahora solo cache fallback en endpoints "seguros"
  // (rate plans, configs); availability falla loud.
  const endpoint = context.endpoint || 'unknown';
  const isBookingBound = endpoint.includes('available-rooms') ||
                         endpoint.includes('reservations') ||
                         endpoint.includes('payment');
  if (!isBookingBound) {
    const cached = fromCache(propertySlug, endpoint);
    if (cached) {
      console.warn(`[LobbyPMS] Using cached data for ${propertySlug}:${endpoint} (IP whitelist issue?)`);
      return cached;
    }
  }

  throw lastError;
}

// ============================================================
// GET /api/v2/available-rooms — Disponibilidad con fechas
// context debe incluir { propertyId } para resolver el token desde BD
// ============================================================
export async function getAvailableRooms(propertySlug, { checkin, checkout, adults = 1, children = 0 }, context = {}) {
  const client = await lobbyClientFor(propertySlug, context.propertyId);
  const endpoint = '/api/v2/available-rooms';
  // LobbyPMS API v2 uses start_date/end_date (not checkin/checkout)
  const params = { start_date: checkin, end_date: checkout, adults };
  if (children > 0) params.children = children;

  // E-AGENT-12 H-AGT-4: NO cache fallback en availability — el agente debe
  // saber explícitamente que no pudo verificar disponibilidad en lugar de
  // confirmar sobre stock stale.
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
}

// ============================================================
// GET /api/v1/rate-plans — Tarifas vigentes
// ============================================================
export async function getRatePlans(propertySlug, context = {}) {
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
export async function calculateDiscount(propertySlug, checkinDate, context = {}) {
  try {
    const occupancyData = await getDailyOccupancy(propertySlug, { date: checkinDate }, context);
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
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
  const client = await lobbyClientFor(propertySlug, context.propertyId);
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
