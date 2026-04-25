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
// Estrategia de verificación:
//  1) debug_token confirma que el token es válido + tiene scopes whatsapp_*. Si pasa → connected.
//  2) phone resource GET es un enrichment opcional (puede fallar con #10 si la app no está
//     atada al phone_id resource directamente, pero el token sigue siendo válido para mensajería
//     vía webhooks On-Premise/BSP). No hace fail el ping.
export async function pingWhatsApp(token, phoneId) {
  if (!token) return { ok: false, error: 'missing_token', status: 'not_configured' };
  const start = Date.now();
  try {
    const debugRes = await fetch(
      `https://graph.facebook.com/v22.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
    );
    if (!debugRes.ok) {
      const body = await debugRes.text();
      return { ok: false, error: `debug_token HTTP ${debugRes.status}: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: Date.now() - start };
    }
    const debugJson = await debugRes.json();
    const tokenData = debugJson.data || {};
    if (!tokenData.is_valid) {
      return { ok: false, error: tokenData.error?.message || 'token_invalid', status: 'error', responseTimeMs: Date.now() - start };
    }
    const scopes = Array.isArray(tokenData.scopes) ? tokenData.scopes : [];
    const hasWa = scopes.includes('whatsapp_business_management') || scopes.includes('whatsapp_business_messaging');
    if (!hasWa) {
      return {
        ok: false,
        error: 'token_missing_whatsapp_scopes',
        status: 'error',
        responseTimeMs: Date.now() - start,
        metadata: { appId: tokenData.app_id, scopes },
      };
    }

    let phoneMetadata = {};
    if (phoneId) {
      try {
        const phoneRes = await fetch(
          `https://graph.facebook.com/v22.0/${phoneId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (phoneRes.ok) {
          const phoneJson = await phoneRes.json();
          phoneMetadata = {
            displayPhone: phoneJson.display_phone_number,
            verifiedName: phoneJson.verified_name,
            verified: phoneJson.code_verification_status === 'VERIFIED',
            quality: phoneJson.quality_rating,
          };
        }
      } catch {
        // optional enrichment
      }
    }

    const ms = Date.now() - start;
    return {
      ok: true,
      status: 'connected',
      responseTimeMs: ms,
      metadata: {
        appId: tokenData.app_id,
        application: tokenData.application,
        tokenType: tokenData.type,
        expiresAt: tokenData.expires_at || 0,
        scopes,
        ...phoneMetadata,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message, status: 'error' };
  }
}

// ── LOBBYPMS (vía proxy) ────────────────────────────────
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
// `kind` = 'facebook' | 'instagram' — informa qué scopes mínimos esperar.
// Estrategia (igual que WhatsApp):
//  1) debug_token verifica validez + scopes (pages_* / instagram_*).
//  2) Si pageId/igId está guardado, intenta GET del recurso como enrichment (no bloquea).
//  3) Si NO hay ID guardado, tampoco falla — reporta connected con metadata del token.
export async function pingMetaPage(token, pageId, kind = 'facebook') {
  if (!token) return { ok: false, error: 'missing_token', status: 'not_configured' };
  const start = Date.now();
  try {
    const debugRes = await fetch(
      `https://graph.facebook.com/v22.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
    );
    if (!debugRes.ok) {
      const body = await debugRes.text();
      return { ok: false, error: `debug_token HTTP ${debugRes.status}: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: Date.now() - start };
    }
    const debugJson = await debugRes.json();
    const tokenData = debugJson.data || {};
    if (!tokenData.is_valid) {
      return { ok: false, error: tokenData.error?.message || 'token_invalid', status: 'error', responseTimeMs: Date.now() - start };
    }
    const scopes = Array.isArray(tokenData.scopes) ? tokenData.scopes : [];
    const requiredScopes = kind === 'instagram'
      ? ['instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments']
      : ['pages_show_list', 'pages_messaging', 'pages_read_engagement'];
    const hasAny = requiredScopes.some(s => scopes.includes(s));
    if (!hasAny) {
      return {
        ok: false,
        error: `token_missing_${kind}_scopes`,
        status: 'error',
        responseTimeMs: Date.now() - start,
        metadata: { appId: tokenData.app_id, scopes },
      };
    }

    let resourceMetadata = {};
    if (pageId) {
      try {
        const fields = kind === 'instagram' ? 'id,username,followers_count' : 'id,name,fan_count';
        const r = await fetch(
          `https://graph.facebook.com/v22.0/${pageId}?fields=${fields}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (r.ok) {
          const data = await r.json();
          resourceMetadata = kind === 'instagram'
            ? { id: data.id, username: data.username, followers: data.followers_count }
            : { id: data.id, name: data.name, fans: data.fan_count };
        }
      } catch {
        // optional enrichment
      }
    }

    return {
      ok: true,
      status: 'connected',
      responseTimeMs: Date.now() - start,
      metadata: {
        appId: tokenData.app_id,
        application: tokenData.application,
        scopes,
        ...resourceMetadata,
      },
    };
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
      const body = await tokenRes.text();
      return { ok: false, error: `token_refresh_failed: ${body.slice(0, 100)}`, status: 'error', responseTimeMs: Date.now() - start };
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

  const aiCfg = await getAIConfig(propertyId);
  const antRes = await pingAnthropic(aiCfg?.api_key);
  await upsertHealth(propertyId, 'anthropic', antRes.status, antRes.error, antRes.metadata || {}, antRes.responseTimeMs);
  results.anthropic = antRes;

  const wompiCfg = await getWompiConfig(propertyId, null);
  const wompiRes = await pingWompi(wompiCfg?.public_key);
  await upsertHealth(propertyId, 'wompi', wompiRes.status, wompiRes.error, wompiRes.metadata || {}, wompiRes.responseTimeMs);
  results.wompi = wompiRes;

  const waCfg = await getWhatsAppConfig(propertyId);
  const waRes = await pingWhatsApp(waCfg?.access_token, waCfg?.phone_number_id);
  await upsertHealth(propertyId, 'whatsapp', waRes.status, waRes.error, waRes.metadata || {}, waRes.responseTimeMs);
  results.whatsapp = waRes;

  const lobbyToken = await getLobbyPMSToken(propertyId, null);
  const lobbyRes = await pingLobbyPMS(lobbyToken);
  await upsertHealth(propertyId, 'lobbypms', lobbyRes.status, lobbyRes.error, lobbyRes.metadata || {}, lobbyRes.responseTimeMs);
  results.lobbypms = lobbyRes;

  // Meta (Facebook + Instagram) — token compartido entre canales (System User token con scopes IG+FB+WA).
  const metaCfg = await getSetting(propertyId, 'meta_config');
  const connSetting = await getSetting(propertyId, 'connections');
  const conn = (connSetting && typeof connSetting === 'object') ? connSetting : {};
  const metaToken =
    metaCfg?.access_token ||
    conn.facebook?.page_token ||
    waCfg?.access_token ||
    process.env.FACEBOOK_PAGE_TOKEN ||
    process.env.META_ACCESS_TOKEN;

  // Auto-discover de page_id e instagram_id si no están saved (token tiene pages_show_list).
  let discoveredFbId = null;
  let discoveredIgId = null;
  if (metaToken && (!metaCfg?.page_id || !metaCfg?.instagram_id)) {
    try {
      const accRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account&limit=10`,
        { headers: { Authorization: `Bearer ${metaToken}` } }
      );
      if (accRes.ok) {
        const accData = await accRes.json();
        const pages = Array.isArray(accData.data) ? accData.data : [];
        if (pages.length > 0) {
          discoveredFbId = pages[0].id;
          const withIg = pages.find(p => p.instagram_business_account?.id);
          if (withIg) discoveredIgId = withIg.instagram_business_account.id;
        }
      }
    } catch {
      // best-effort
    }
  }

  const fbPageId = metaCfg?.page_id || conn.facebook?.page_id || discoveredFbId;
  if (metaToken) {
    const fbRes = await pingMetaPage(metaToken, fbPageId, 'facebook');
    await upsertHealth(propertyId, 'facebook', fbRes.status, fbRes.error, fbRes.metadata || {}, fbRes.responseTimeMs);
    results.facebook = fbRes;
  } else {
    await upsertHealth(propertyId, 'facebook', 'not_configured', 'no_meta_token', {}, null);
    results.facebook = { ok: false, error: 'no_meta_token', status: 'not_configured' };
  }

  const igId = metaCfg?.instagram_id || conn.instagram?.business_id || discoveredIgId;
  if (metaToken) {
    const igRes = await pingMetaPage(metaToken, igId, 'instagram');
    await upsertHealth(propertyId, 'instagram', igRes.status, igRes.error, igRes.metadata || {}, igRes.responseTimeMs);
    results.instagram = igRes;
  } else {
    await upsertHealth(propertyId, 'instagram', 'not_configured', 'no_meta_token', {}, null);
    results.instagram = { ok: false, error: 'no_meta_token', status: 'not_configured' };
  }

  const googleCfg = await getSetting(propertyId, 'google_config');
  if (googleCfg && (googleCfg.refresh_token || googleCfg.client_id)) {
    const gRes = await pingGoogleBusiness(googleCfg);
    await upsertHealth(propertyId, 'google_business', gRes.status, gRes.error, gRes.metadata || {}, gRes.responseTimeMs);
    results.google_business = gRes;
  } else {
    await upsertHealth(propertyId, 'google_business', 'not_configured', 'no_google_config', {}, null);
    results.google_business = { ok: false, error: 'no_google_config', status: 'not_configured' };
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
