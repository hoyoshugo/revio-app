/**
 * Channel Service — gestiona:
 *  · tenant_provider_selections (proveedor activo por categoría)
 *  · property_channels          (canales configurados + capacidades)
 *  · ping de cada canal según su tipo
 */
import { supabase } from '../models/supabase.js';

const GRAPH = 'https://graph.facebook.com/v22.0';

// ── PROVIDER SELECTIONS ────────────────────────────────
export async function getProviderSelections(propertyId) {
  const { data, error } = await supabase
    .from('tenant_provider_selections')
    .select('category, provider_key, is_active, configured_at')
    .eq('property_id', propertyId);
  if (error) return {};
  const map = {};
  for (const row of data || []) {
    if (row.is_active) map[row.category] = row.provider_key;
  }
  return map;
}

export async function saveProviderSelection(propertyId, category, providerKey) {
  // Desactivar cualquier otro proveedor activo en esta categoría
  await supabase
    .from('tenant_provider_selections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('category', category);

  const { data, error } = await supabase
    .from('tenant_provider_selections')
    .upsert(
      {
        property_id: propertyId,
        category,
        provider_key: providerKey,
        is_active: true,
        configured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id,category' }
    )
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}

// ── PROPERTY CHANNELS ──────────────────────────────────
export async function getPropertyChannels(propertyId) {
  const { data, error } = await supabase
    .from('property_channels')
    .select('*')
    .eq('property_id', propertyId)
    .order('channel_type');
  if (error) return [];
  return data || [];
}

export async function saveChannelConfig(propertyId, channelKey, payload) {
  const update = {
    property_id: propertyId,
    channel_key: channelKey,
    updated_at: new Date().toISOString(),
  };
  if (payload.channel_type)    update.channel_type = payload.channel_type;
  if (payload.credentials)     update.credentials = payload.credentials;
  if (payload.ical_url !== undefined) update.ical_url = payload.ical_url;
  if (payload.profile_url !== undefined) update.profile_url = payload.profile_url;
  if (payload.status)          update.status = payload.status;
  if (payload.can_receive_messages !== undefined) update.can_receive_messages = payload.can_receive_messages;
  if (payload.can_send_messages !== undefined)    update.can_send_messages = payload.can_send_messages;
  if (payload.can_reply_reviews !== undefined)    update.can_reply_reviews = payload.can_reply_reviews;
  if (payload.can_sync_calendar !== undefined)    update.can_sync_calendar = payload.can_sync_calendar;

  // Determinar channel_type si no viene
  if (!update.channel_type) {
    const messaging = ['whatsapp','instagram','facebook','google_business'];
    const otas      = ['booking','airbnb','hostelworld','expedia','despegar'];
    const reviews   = ['tripadvisor'];
    if (messaging.includes(channelKey)) update.channel_type = 'messaging';
    else if (otas.includes(channelKey)) update.channel_type = 'ota';
    else if (reviews.includes(channelKey)) update.channel_type = 'review';
    else update.channel_type = 'messaging';
  }

  const { data, error } = await supabase
    .from('property_channels')
    .upsert(update, { onConflict: 'property_id,channel_key' })
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}

async function updateChannelHealth(propertyId, channelKey, status, errorMessage = null) {
  await supabase
    .from('property_channels')
    .update({
      status,
      last_checked_at: new Date().toISOString(),
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('property_id', propertyId)
    .eq('channel_key', channelKey);
}

// ── PING ────────────────────────────────────────────────
export async function pingChannel(propertyId, channelKey) {
  const { getWhatsAppConfig, getSetting } = await import('./connectionService.js');

  // Leer connections key del frontend como fallback
  const { data: connSetting } = await supabase
    .from('settings').select('value').eq('property_id', propertyId).eq('key', 'connections').maybeSingle();
  const conn = connSetting?.value || {};

  // Recuperar la fila del canal para tener ical/profile si aplican
  const { data: channelRow } = await supabase
    .from('property_channels')
    .select('*')
    .eq('property_id', propertyId)
    .eq('channel_key', channelKey)
    .maybeSingle();

  try {
    switch (channelKey) {
      case 'whatsapp': {
        const waCfg = await getWhatsAppConfig(propertyId);
        const token = waCfg?.access_token;
        const phoneId = waCfg?.phone_number_id;
        if (!token || !phoneId) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        const r = await fetch(`${GRAPH}/${phoneId}?fields=display_phone_number,code_verification_status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          await updateChannelHealth(propertyId, channelKey, 'connected');
          return { status: 'connected', metadata: j };
        }
        const body = await r.text();
        await updateChannelHealth(propertyId, channelKey, 'error', `HTTP ${r.status}: ${body.slice(0, 100)}`);
        return { status: 'error', error: `HTTP ${r.status}` };
      }

      case 'instagram': {
        const metaCfg = await getSetting(propertyId, 'meta_config');
        const token = metaCfg?.access_token || conn.facebook?.page_token || process.env.FACEBOOK_PAGE_TOKEN;
        const igId = metaCfg?.instagram_id || conn.instagram?.business_id || channelRow?.credentials?.instagram_id;
        if (!token || !igId) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        const r = await fetch(`${GRAPH}/${igId}?fields=id,name,username`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          await updateChannelHealth(propertyId, channelKey, 'connected');
          return { status: 'connected', metadata: j };
        }
        await updateChannelHealth(propertyId, channelKey, 'error', `HTTP ${r.status}`);
        return { status: 'error', error: `HTTP ${r.status}` };
      }

      case 'facebook': {
        const metaCfg = await getSetting(propertyId, 'meta_config');
        const token = metaCfg?.access_token || conn.facebook?.page_token || process.env.FACEBOOK_PAGE_TOKEN;
        const pageId = metaCfg?.page_id || conn.facebook?.page_id || channelRow?.credentials?.page_id;
        if (!token || !pageId) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        const r = await fetch(`${GRAPH}/${pageId}?fields=id,name`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          await updateChannelHealth(propertyId, channelKey, 'connected');
          return { status: 'connected', metadata: j };
        }
        await updateChannelHealth(propertyId, channelKey, 'error', `HTTP ${r.status}`);
        return { status: 'error', error: `HTTP ${r.status}` };
      }

      case 'google_business': {
        const googleCfg = await getSetting(propertyId, 'google_config');
        if (!googleCfg?.refresh_token || !googleCfg?.client_id || !googleCfg?.client_secret) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        // Get fresh access token and test
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: googleCfg.client_id,
              client_secret: googleCfg.client_secret,
              refresh_token: googleCfg.refresh_token,
              grant_type: 'refresh_token',
            }),
          });
          if (!tokenRes.ok) {
            await updateChannelHealth(propertyId, channelKey, 'error', 'token_refresh_failed');
            return { status: 'error', error: 'token_refresh_failed' };
          }
          const { access_token } = await tokenRes.json();
          const accountsRes = await fetch('https://mybusinessaccoun