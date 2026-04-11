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
async function getConnectionSetting(propertyId) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('property_id', propertyId)
    .eq('key', 'connections')
    .maybeSingle();
  return data?.value || {};
}

export async function pingChannel(propertyId, channelKey) {
  const connections = await getConnectionSetting(propertyId);

  // Recuperar la fila del canal para tener ical/profile si aplican
  const { data: channelRow } = await supabase
    .from('property_channels')
    .select('*')
    .eq('property_id', propertyId)
    .eq('channel_key', channelKey)
    .maybeSingle();

  const token = connections.whatsapp?.token || process.env.FACEBOOK_PAGE_TOKEN;

  try {
    switch (channelKey) {
      case 'whatsapp': {
        const phoneId = connections.whatsapp?.phone_id || process.env.WHATSAPP_PHONE_ID;
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
        await updateChannelHealth(propertyId, channelKey, 'error', `HTTP ${r.status}`);
        return { status: 'error', error: `HTTP ${r.status}` };
      }

      case 'instagram':
      case 'facebook': {
        if (!token) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        const r = await fetch(`${GRAPH}/me?fields=id,name`, {
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

      case 'google_business':
        await updateChannelHealth(propertyId, channelKey, 'unchecked', 'requires_oauth');
        return { status: 'unchecked', note: 'requires_oauth' };

      case 'tripadvisor':
        await updateChannelHealth(propertyId, channelKey, 'unchecked', 'api_readonly');
        return { status: 'unchecked', note: 'api_readonly' };

      case 'booking':
      case 'airbnb':
      case 'hostelworld':
      case 'expedia':
      case 'despegar': {
        const icalUrl = channelRow?.ical_url || connections.ical?.[`${channelKey}_url`];
        if (!icalUrl) {
          await updateChannelHealth(propertyId, channelKey, 'not_configured');
          return { status: 'not_configured' };
        }
        try {
          const r = await fetch(icalUrl, { method: 'HEAD' });
          if (r.ok || r.status === 405) {
            // 405 = método no permitido, pero URL existe; hacer GET corto
            await updateChannelHealth(propertyId, channelKey, 'connected');
            return { status: 'connected' };
          }
          await updateChannelHealth(propertyId, channelKey, 'error', `HTTP ${r.status}`);
          return { status: 'error', error: `HTTP ${r.status}` };
        } catch (e) {
          await updateChannelHealth(propertyId, channelKey, 'error', e.message);
          return { status: 'error', error: e.message };
        }
      }

      default:
        await updateChannelHealth(propertyId, channelKey, 'unchecked', 'unknown_channel');
        return { status: 'unchecked', error: 'unknown_channel' };
    }
  } catch (e) {
    await updateChannelHealth(propertyId, channelKey, 'error', e.message);
    return { status: 'error', error: e.message };
  }
}

// ── INBOX ───────────────────────────────────────────────
export async function getUnifiedInbox(propertyId, { limit = 50, channelKey = null } = {}) {
  let query = supabase
    .from('unified_inbox')
    .select('*')
    .eq('property_id', propertyId)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (channelKey) query = query.eq('channel_key', channelKey);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function insertInboxMessage(row) {
  try {
    await supabase.from('unified_inbox').insert(row);
  } catch (e) {
    console.error('[ChannelService] insertInboxMessage error:', e.message);
  }
}
