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

/**
 * Pingea todas las integraciones de una propiedad basándose en
 * `settings.connections` y persiste resultados en `integration_health`.
 */
export async function pingAllIntegrations(propertyId) {
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('property_id', propertyId)
    .eq('key', 'connections')
    .maybeSingle();

  const conn = setting?.value || {};
  const results = {};

  // Anthropic
  const antKey = conn.anthropic?.api_key;
  const antRes = await pingAnthropic(antKey);
  await upsertHealth(propertyId, 'anthropic', antRes.status, antRes.error, antRes.metadata || {}, antRes.responseTimeMs);
  results.anthropic = antRes;

  // Wompi
  const wompiKey = conn.wompi?.public_key;
  const wompiRes = await pingWompi(wompiKey);
  await upsertHealth(propertyId, 'wompi', wompiRes.status, wompiRes.error, wompiRes.metadata || {}, wompiRes.responseTimeMs);
  results.wompi = wompiRes;

  // WhatsApp
  const waToken = conn.whatsapp?.token;
  const waPhoneId = conn.whatsapp?.phone_id;
  const waRes = await pingWhatsApp(waToken, waPhoneId);
  await upsertHealth(propertyId, 'whatsapp', waRes.status, waRes.error, waRes.metadata || {}, waRes.responseTimeMs);
  results.whatsapp = waRes;

  // LobbyPMS
  const lobbyToken = conn.lobbypms?.token;
  const lobbyRes = await pingLobbyPMS(lobbyToken);
  await upsertHealth(propertyId, 'lobbypms', lobbyRes.status, lobbyRes.error, lobbyRes.metadata || {}, lobbyRes.responseTimeMs);
  results.lobbypms = lobbyRes;

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
