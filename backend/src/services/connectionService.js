/**
 * connectionService.js — Lee credenciales de integraciones desde la tabla `settings`.
 *
 * Arquitectura multitenancy: NINGUNA credencial de cliente vive en ENV ni en el código.
 * Todo se almacena en settings(property_id, key, value) y se lee desde aquí.
 *
 * Keys usadas:
 *   lobbypms_token      → string (API token de LobbyPMS)
 *   wompi_config        → { public_key, private_key }
 *   whatsapp_config     → { access_token, phone_number_id, waba_id }
 *   anthropic_config    → { api_key, model }
 *   openai_config       → { api_key, model }
 *   gemini_config       → { api_key, model }
 *   groq_config         → { api_key, model }
 *   meta_config         → { access_token, business_id, page_id, instagram_id }
 */
import { supabase } from '../models/supabase.js';
import { decrypt, encrypt } from './encryption.js';

// Cache en memoria: { "propertyId:key" → { value, ts } }
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function cacheGet(propertyId, key) {
  const hit = _cache.get(`${propertyId}:${key}`);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.value;
  return null;
}

function cachePut(propertyId, key, value) {
  _cache.set(`${propertyId}:${key}`, { value, ts: Date.now() });
}

function cacheInvalidate(propertyId, key) {
  _cache.delete(`${propertyId}:${key}`);
}

/**
 * Lee un valor de settings por propertyId y key.
 */
export async function getSetting(propertyId, key) {
  if (!propertyId) return null;

  const cached = cacheGet(propertyId, key);
  if (cached !== null) return cached;

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('property_id', propertyId)
    .eq('key', key)
    .maybeSingle();

  if (error || !data) {
    cachePut(propertyId, key, null);
    return null;
  }

  let value = data.value;
  if (typeof value === 'string' && value.includes(':')) {
    value = decrypt(value);
  }

  cachePut(propertyId, key, value);
  return value;
}

/**
 * Guarda un valor en settings. Encripta strings sensibles automáticamente.
 */
export async function saveSetting(propertyId, key, value, updatedBy = null) {
  if (!propertyId || !key) throw new Error('propertyId y key son requeridos');

  const sensitiveKeys = ['token', 'key', 'secret', 'password', 'api_key'];
  let storedValue = value;

  if (typeof value === 'string' && sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
    storedValue = encrypt(value);
  } else if (typeof value === 'object' && value !== null) {
    const encrypted = { ...value };
    for (const [field, fieldVal] of Object.entries(encrypted)) {
      if (typeof fieldVal === 'string' && sensitiveKeys.some(k => field.toLowerCase().includes(k))) {
        encrypted[field] = encrypt(fieldVal);
      }
    }
    storedValue = encrypted;
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      property_id: propertyId,
      key,
      value: storedValue,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    }, { onConflict: 'property_id,key' });

  if (error) throw error;

  cacheInvalidate(propertyId, key);
  return true;
}

export async function getLobbyPMSToken(propertyId, propertySlug) {
  const setting = await getSetting(propertyId, 'lobbypms_token');
  if (setting && typeof setting === 'string') return setting;
  const envKey = `LOBBY_TOKEN_${propertySlug?.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey] || null;
}

export async function getWompiConfig(propertyId, propertySlug) {
  const setting = await getSetting(propertyId, 'wompi_config');
  if (setting && typeof setting === 'object') {
    return {
      public_key: typeof setting.public_key === 'string' && setting.public_key.includes(':')
        ? decrypt(setting.public_key) : setting.public_key,
      private_key: typeof setting.private_key === 'string' && setting.private_key.includes(':')
        ? decrypt(setting.private_key) : setting.private_key,
    };
  }
  const slugKey = propertySlug?.toUpperCase().replace(/-/g, '_');
  return {
    public_key: process.env[`WOMPI_PUBLIC_KEY_${slugKey}`] || null,
    private_key: process.env[`WOMPI_PRIVATE_KEY_${slugKey}`] || null,
  };
}

export async function getWhatsAppConfig(propertyId) {
  const setting = await getSetting(propertyId, 'whatsapp_config');
  if (setting && typeof setting === 'object') {
    return {
      access_token: typeof setting.access_token === 'string' && setting.access_token.includes(':')
        ? decrypt(setting.access_token) : setting.access_token,
      phone_number_id: setting.phone_number_id,
      waba_id: setting.waba_id,
    };
  }
  return {
    access_token: process.env.WHATSAPP_TOKEN || null,
    phone_number_id: process.env.WHATSAPP_PHONE_ID || null,
    waba_id: process.env.WHATSAPP_WABA_ID || null,
  };
}

export async function getAIConfig(propertyId) {
  const setting = await getSetting(propertyId, 'anthropic_config');
  if (setting && typeof setting === 'object') {
    return {
      provider: 'anthropic',
      api_key: typeof setting.api_key === 'string' && setting.api_key.includes(':')
        ? decrypt(setting.api_key) : setting.api_key,
      model: setting.model || 'claude-sonnet-4-6',
    };
  }
  return {
    provider: 'anthropic',
    api_key: process.env.ANTHROPIC_API_KEY || null,
    model: 'claude-sonnet-4-6',
  };
}

export async function listConnections(propertyId) {
  const CONNECTION_KEYS = [
    'lobbypms_token', 'wompi_config', 'whatsapp_config',
    'anthropic_config', 'openai_config', 'gemini_config', 'groq_config',
    'meta_config', 'booking_config', 'airbnb_config', 'cloudbeds_config',
    'ota_ical_urls', 'google_config',
  ];

  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('key, updated_at, updated_by, scope')
    .eq('property_id', propertyId)
    .in('key', CONNECTION_KEYS);

  const settingsConnections = (settingsError ? [] : (settingsData || [])).map(row => ({
    key: row.key,
    status: 'connected',
    scope: row.scope || 'independent',
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  }));

  const { data: ownChannels, error: ownErr } = await supabase
    .from('channel_property_map')
    .select('channel, external_id, external_name, scope, is_active, updated_at')
    .eq('property_id', propertyId)
    .eq('is_active', true);

  const { data: sharedChannels, error: sharedErr } = await supabase
    .from('channel_property_map')
    .select('channel, external_id, external_name, scope, is_active, updated_at')
    .eq('scope', 'shared')
    .eq('is_active', true)
    .neq('property_id', propertyId);

  const ownList = ownErr ? [] : (ownChannels || []);
  const sharedList = sharedErr ? [] : (sharedChannels || []);
  const seenChannels = new Set(ownList.map(r => r.channel));
  const channelData = [
    ...ownList,
    ...sharedList.filter(r => !seenChannels.has(r.channel)),
  ];

  const CHANNEL_TO_KEY = {
    whatsapp: 'whatsapp_config',
    facebook: 'meta_facebook',
    instagram: 'meta_instagram',
  };

  const channelConnections = (channelData || []).map(row => ({
    key: CHANNEL_TO_KEY[row.channel] || `channel_${row.channel}`,
    status: 'connected',
    scope: row.scope || 'independent',
    updated_at: row.updated_at,
    updated_by: null,
    channel: row.channel,
    external_id: row.external_id,
    external_name: row.external_name,
  }));

  const settingsKeys = new Set(settingsConnections.map(c => c.key));
  const merged = [
    ...settingsConnections,
    ...channelConnections.filter(c => !settingsKeys.has(c.key)),
  ];

  return merged;
}

export async function getChannelMappings(propertyId) {
  const { data: own, error: ownErr } = await supabase
    .from('channel_property_map')
    .select('channel, external_id, external_name, scope, is_active')
    .eq('property_id', propertyId);

  const { data: shared, error: sharedErr } = await supabase
    .from('channel_property_map')
    .select('channel, external_id, external_name, scope, is_active')
    .eq('scope', 'shared')
    .eq('is_active', true)
    .neq('property_id', propertyId);

  const ownList = ownErr ? [] : (own || []);
  const sharedList = sharedErr ? [] : (shared || []);
  const seenChannels = new Set(ownList.map(r => r.channel));
  return [
    ...ownList,
    ...sharedList.filter(r => !seenChannels.has(r.channel)),
  ];
}

export async function saveChannelMapping(propertyId, channel, externalId, externalName, scope = 'independent') {
  const { data, error } = await supabase
    .from('channel_property_map')
    .upsert({
      property_id: propertyId,
      channel,
      external_id: externalId,
      external_name: externalName,
      scope,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'channel,external_id,property_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export default {
  getSetting,
  saveSetting,
  getLobbyPMSToken,
  getWompiConfig,
  getWhatsAppConfig,
  getAIConfig,
  listConnections,
  getChannelMappings,
  saveChannelMapping,
};
