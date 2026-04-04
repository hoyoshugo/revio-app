/**
 * PMS Adapter — Universal interface for Property Management Systems
 * Revio SaaS · TRES HACHE ENTERPRISE SAS
 *
 * Supported PMS types:
 *   lobbypms | cloudbeds | mews | little_hotelier | clock | custom
 *
 * All adapters implement the same interface:
 *   getAvailability(params)  → rooms with prices
 *   createBooking(data)      → booking confirmation
 *   getOccupancy(params)     → occupancy by date range
 *   getReservations(params)  → list of reservations
 *   cancelBooking(id, reason)→ cancellation result
 */

import * as lobbyPMSAdapter from './lobbypms.js';
import * as cloudbedsAdapter from './cloudbeds.js';
import * as mewsAdapter from './mews.js';
import * as customAdapter from './custom.js';

const ADAPTERS = {
  lobbypms:       lobbyPMSAdapter,
  cloudbeds:      cloudbedsAdapter,
  mews:           mewsAdapter,
  little_hotelier: customAdapter, // uses custom webhook adapter
  clock:          customAdapter,
  custom:         customAdapter,
};

/**
 * Get the PMS config for a property from its settings.
 * Returns: { pms_type, pms_token, pms_endpoint, pms_extra }
 */
export async function getPMSConfig(propertyId, supabase) {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .eq('property_id', propertyId)
    .in('key', ['pms_config', 'lobbypms_token', 'pms_type']);

  const config = {};
  for (const row of rows || []) {
    if (row.key === 'pms_config') Object.assign(config, row.value || {});
    if (row.key === 'lobbypms_token') config.pms_type = config.pms_type || 'lobbypms';
    if (row.key === 'pms_type') config.pms_type = row.value;
  }

  // Default to lobbypms if not configured
  if (!config.pms_type) config.pms_type = 'lobbypms';
  return config;
}

/**
 * Get adapter for a given property.
 * @param {string} propertySlug - used for lobbypms env-based tokens
 * @param {object} pmsConfig    - from getPMSConfig()
 */
function getAdapter(propertySlug, pmsConfig = {}) {
  const type = (pmsConfig.pms_type || 'lobbypms').toLowerCase();
  const adapter = ADAPTERS[type] || customAdapter;
  return { adapter, type };
}

/**
 * Universal: get available rooms
 * @param {string} propertySlug
 * @param {object} pmsConfig
 * @param {object} params  { checkin, checkout, adults, children }
 * @param {object} context { propertyId, conversationId }
 */
export async function getAvailability(propertySlug, pmsConfig, params, context = {}) {
  const { adapter, type } = getAdapter(propertySlug, pmsConfig);
  return adapter.getAvailability(propertySlug, pmsConfig, params, context);
}

/**
 * Universal: create a booking
 */
export async function createBooking(propertySlug, pmsConfig, bookingData, context = {}) {
  const { adapter } = getAdapter(propertySlug, pmsConfig);
  return adapter.createBooking(propertySlug, pmsConfig, bookingData, context);
}

/**
 * Universal: get occupancy data
 */
export async function getOccupancy(propertySlug, pmsConfig, params, context = {}) {
  const { adapter } = getAdapter(propertySlug, pmsConfig);
  return adapter.getOccupancy(propertySlug, pmsConfig, params, context);
}

/**
 * Universal: list reservations
 */
export async function getReservations(propertySlug, pmsConfig, params, context = {}) {
  const { adapter } = getAdapter(propertySlug, pmsConfig);
  return adapter.getReservations(propertySlug, pmsConfig, params, context);
}

/**
 * Universal: cancel a booking
 */
export async function cancelBooking(propertySlug, pmsConfig, bookingId, reason = '', context = {}) {
  const { adapter } = getAdapter(propertySlug, pmsConfig);
  return adapter.cancelBooking(propertySlug, pmsConfig, bookingId, reason, context);
}

export const PMS_TYPES = [
  { value: 'lobbypms',       label: 'LobbyPMS',        logo: '🏨', description: 'Integración completa — Colombia y LATAM' },
  { value: 'cloudbeds',      label: 'Cloudbeds',        logo: '☁️', description: 'API REST v1.2 — Global' },
  { value: 'mews',           label: 'Mews',             logo: '🌐', description: 'Open API — Europa y LATAM' },
  { value: 'little_hotelier',label: 'Little Hotelier',  logo: '🏡', description: 'Integración vía webhook' },
  { value: 'clock',          label: 'Clock PMS',        logo: '🕐', description: 'Integración vía webhook' },
  { value: 'custom',         label: 'Otro / Custom',    logo: '⚙️', description: 'Endpoint y token propios' },
];

export default { getAvailability, createBooking, getOccupancy, getReservations, cancelBooking, getPMSConfig, PMS_TYPES };
