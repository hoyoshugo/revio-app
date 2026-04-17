/**
 * Integration Health — verifica credenciales haciendo ping real a cada API.
 * Se llama al guardar credenciales o al pedir "Verificar ahora" desde el UI.
 * Persiste en tabla integration_health.
 */
import { supabase } from '../models/supabase.js';

async function upsertHealth(propertyId, integrationKey, status, errorMessage = null, metadata = {}, responseTimeMs = null) {
  try {
    await supabase.from('integration_health').upsert(
      {
        property_id: propertyId,
        integration_key: integrationKey,
        status,
        last_checked_at: new Date().toISOString(),
        error_message: errorMessage,
        response_time_ms: responseTimeMs,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id,integration_key' }
    );
  } catch (e) {
    console.error('[IntegrationHealth] upsert failed:', e.message);
  }
}

// ── ANTHROPIC ──────────────────────────────────────────
export async function pingAnthropic(apiKey) {
  if (!apiKey) return { ok: false, error: 'no_api_key', status: 'not_configured' };
  const start = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    const ms = Date.now() - start;
    if (r.ok) return { ok: true, status: 'connected', responseTimeMs: ms };
    const body = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── WOMPI ──────────────────────────────────────────────
export async function pingWompi(publicKey) {
  if (!publicKey) return { ok: false, error: 'no_public_key', status: 'not_configured' };
  const start = Date.now();
  try {
    const r = await fetch(`https://production.wompi.co/v1/merchants/${publicKey}`);
    const ms = Date.now() - start;
    if (r.ok) {
      const data = await r.json();
      return {
        ok: true,
        status: 'connected',
        responseTimeMs: ms,
        metadata: { merchantName: data.data?.name, active: data.data?.active_3ds_enabled !== undefined },
      };
    }
    return { ok: false, error: `HTTP ${r.status}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── WHATSAPP ───────────────────────────────────────────
export async function pingWhatsApp(token, phoneId) {
  if (!token || !phoneId) return { ok: false, error: 'missing_credentials', status: 'not_configured' };
  const start = Date.now();
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${phoneId}?fields=display_phone_number,code_verification_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const ms = Date.now() - start;
    if (r.ok) {
      const data = await r.json();
      return {
        ok: true,
        status: 'connected',
        responseTimeMs: ms,
        metadata: {
          displayPhone: data.display_phone_number,
          verified: data.code_verification_status === 'VERIFIED',
        },
      };
    }
    const body = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── LOBBYPMS (vía fly.io proxy) ─────────────────────────
export async function pingLobbyPMS(apiToken) {
  if (!apiToken) return { ok: false, error: 'no_api_token', status: 'not_configured' };
  const proxyUrl = process.env.LOBBYPMS_PROXY_URL;
  const proxySecret = process.env.LOBBYPMS_PROXY_SECRET;
  if (!proxyUrl) return { ok: false, error: 'proxy_not_configured', status: 'error' };

  const start = Date.now();
  try {
    const r = await fetch(`${proxyUrl}/proxy/clients?api_token=${apiToken}`, {
      headers: { 'x-proxy-secret': proxySecret },
    });
    const ms = Date.now() - start;
    if (r.ok) return { ok: true, status: 'connected', responseTimeMs: ms };
    return { ok: false, error: `HTTP ${r.status}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── INSTAGRAM / FACEBOOK PAGE ──────────────────────────
export async function pingMetaPage(token, pageId) {
  if (!token || !pageId) return { ok: false, error: 'missing_credentials', status: 'not_configured' };
  const start = Date.now();
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${pageId}?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ms = Date.now() - start;
    if (r.ok) {
      const data = await r.json();
      return { ok: true, status: 'connected', responseTimeMs: ms, metadata: { name: data.name, id: data.id } };
    }
    const body = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── GOOGLE BUSINESS PROFILE ───────────────────────────
export async function pingGoogleBusiness(googleConfig) {
  if (!googleConfig?.refresh_token || !googleConfig?.client_id || !googleConfig?.client_secret) {
    return { ok: false, error: 'not_configured', status: 'not_configured' };
  }
  const start = Date.now();
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: googleConfig.client_id,
        client_secret: googleConfig.client_secret,
        refresh_token: googleConfig.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!tokenRes.ok) {
      return { ok: false, error: 'token_refresh_failed', status: 'error', responseTimeMs: Date.now() - start };
    }
    const { access_token } = await tokenRes.json();
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const ms = Date.now() - start;
    if (accountsRes.ok) {
      const data = await accountsRes.json();
      const count = Array.isArray(data.accounts) ? data.accounts.length : 0;
      return { ok: true, status: 'connected', responseTimeMs: ms, metadata: { accounts: count, locationId: googleConfig.location_id } };
    }
    return { ok: false, error: `HTTP ${accountsRes.status}`, status: 'error', responseTimeMs: ms };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

/**
 * Pingea todas las integraciones de una propiedad.
 * Lee credenciales desde settings individuales via connectionService.
 */
export async function pingAllIntegrations(propertyId) {
  const { getAIConfig, getWompiConfig, getWhatsAppConfig, getLobbyPMSToken, getSetting } = await import('./connectionService.js');

  const results = {};

  // Anthropic
  const aiCfg = await getAIConfig(propertyId);
  const antRes = await pingAnthropic(aiCfg?.api_key);
  await upsertHealth(propertyId, 'anthropic', antRes.status, antRes.error, antRes.metadata || {}, antRes.responseTimeMs);
  results.anthropic = antRes;

  // Wompi
  const wompiCfg = await getWompiConfig(propertyId, null);
  const wompiRes = await pingWompi(wompiCfg?.public_key);
  await upsertHealth(propertyId, 'wompi', wompiRes.status, wompiRes.error, wompiRes.metadata || {}, wompiRes.responseTimeMs);
  results.wompi = wompiRes;

  // WhatsApp
  const waCfg = await getWhatsAppConfig(propertyId);
  const waRes = await pingWhatsApp(waCfg?.access_token, waCfg?.phone_number_id);
  await upsertHealth(propertyId, 'whatsapp', waRes.status, waRes.error, waRes.metadata || {}, waRes.responseTimeMs);
  results.whatsapp = waRes;

  // LobbyPMS
  const lobbyToken = await getLobbyPMSToken(propertyId, null);
  const lobbyRes = await pingLobbyPMS(lobbyToken);
  await upsertHealth(propertyId, 'lobbypms', lobbyRes.status, lobbyRes.error, lobbyRes.metadata || {}, lobbyRes.responseTimeMs);
  results.lobbypms = lobbyRes;

  // Meta (Facebook + Instagram) — read from meta_config, connections key, or env vars
  const metaCfg = await getSetting(propertyId, 'meta_config');
  const connSetting = await getSetting(propertyId, 'connections');
  const conn = (connSetting && typeof connSetting === 'object') ? connSetting : {};
  const metaToken = metaCfg?.access_token || conn.facebook?.page_token || process.env.FACEBOOK_PAGE_TOKEN;

  // Facebook page
  const fbPageId = metaCfg?.page_id || conn.facebook?.page_id;
  if (fbPageId && metaToken) {
    const fbRes = await pingMetaPage(metaToken, fbPageId);
    await upsertHealth(propertyId, 'facebook', fbRes.status, fbRes.error, fbRes.metadata || {}, fbRes.responseTimeMs);
    results.facebook = fbRes;
  }

  // Instagram
  const igId = metaCfg?.instagram_id || conn.instagram?.business_id;
  if (igId && metaToken) {
    const igRes = await pingMetaPage(metaToken, igId);
    await upsertHealth(propertyId, 'instagram', igRes.status, igRes.error, igRes.metadata || {}, igRes.responseTimeMs);
    results.instagram = igRes;
  }

  // Google Business Profile
  const googleCfg = await getSetting(propertyId, 'google_config');
  if (googleCfg) {
    const gRes = await pingGoogleBusiness(googleCfg);
    await upsertHealth(propertyId, 'google_business', gRes.status, gRes.error, gRes.metadata || {}, gRes.responseTimeMs);
    results.google_business = gRes;
  }

  return results;
}

/**
 * Lee el estado actual de salud de todas las integraciones de una propiedad.
 */
export async function getIntegrationHealth(propertyId) {
  const { data } = await supabase
    .from('integration_health')
    .select('*')
    .eq('property_id', propertyId);

  const byKey = {};
  (data || []).forEach(row => { byKey[row.integration_key] = row; });
  return byKey;
}
