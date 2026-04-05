/**
 * ipMonitor.js — Detecta cambios de IP del servidor Railway y alerta.
 *
 * Railway asigna IPs dinámicas en cada redeploy. Cuando la IP cambia,
 * LobbyPMS bloquea el acceso hasta que se actualice el whitelist.
 *
 * Este módulo:
 * 1. Obtiene la IP pública actual del servidor via ipify.org
 * 2. La compara con la IP almacenada en Supabase (settings: railway_ip)
 * 3. Si cambió, envía alerta por WhatsApp y actualiza Supabase
 * 4. Expone getCurrentIp() para el endpoint del SuperAdmin
 */
import axios from 'axios';
import { supabase } from '../models/supabase.js';

const SETTING_KEY = 'railway_ip';

// Cache en proceso para no consultar ipify en cada request
let _currentIp = null;
let _ipFetchedAt = null;
const IP_CACHE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Obtiene la IP pública actual del servidor.
 * Usa cache en memoria para no hacer requests excesivos.
 */
export async function getCurrentIp() {
  if (_currentIp && _ipFetchedAt && Date.now() - _ipFetchedAt < IP_CACHE_MS) {
    return _currentIp;
  }
  try {
    const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    _currentIp = data.ip;
    _ipFetchedAt = Date.now();
    return _currentIp;
  } catch {
    return _currentIp || null;
  }
}

/**
 * Lee la IP almacenada en Supabase.
 */
async function getStoredIpRecord() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .is('property_id', null)
    .eq('key', SETTING_KEY)
    .maybeSingle();
  return data?.value || null;
}

/**
 * Guarda la IP actual en Supabase.
 * Usa INSERT ... ON CONFLICT con manejo explícito de NULL property_id.
 */
async function storeIpRecord(record) {
  // Intentar UPDATE primero (si ya existe el registro)
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .is('property_id', null)
    .eq('key', SETTING_KEY)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('settings')
      .update({ value: record, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('settings')
      .insert({ property_id: null, key: SETTING_KEY, value: record, updated_at: new Date().toISOString() });
  }
}

/**
 * Envía alerta de cambio de IP por WhatsApp al número de alertas.
 * Si no hay WhatsApp configurado, solo loguea.
 */
async function sendIpChangeAlert(newIp, previousIp) {
  const alertNumber = process.env.WHATSAPP_ALERT_NUMBER || process.env.ALERT_PHONE;
  if (!alertNumber) {
    console.warn('[ipMonitor] No hay número de alerta configurado (WHATSAPP_ALERT_NUMBER)');
    return;
  }
  try {
    const waToken = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!waToken || !phoneId) return;

    const message = `⚠️ *Revio — Cambio de IP detectado*\n\n` +
      `La IP de Railway cambió:\n` +
      `• Anterior: \`${previousIp || 'desconocida'}\`\n` +
      `• Nueva: \`${newIp}\`\n\n` +
      `*Acción requerida:*\n` +
      `Agrega \`${newIp}\` al whitelist de LobbyPMS:\n` +
      `→ app.lobbypms.com/settings/api\n\n` +
      `_El agente usa cache — los huéspedes actuales no se ven afectados._`;

    await axios.post(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: alertNumber.replace('+', ''),
        type: 'text',
        text: { body: message }
      },
      {
        headers: { Authorization: `Bearer ${waToken}` },
        timeout: 8000
      }
    );
    console.log(`[ipMonitor] Alerta enviada a ${alertNumber}`);
  } catch (err) {
    console.error('[ipMonitor] Error enviando alerta:', err.message);
  }
}

/**
 * Función principal: detecta si la IP cambió y actúa.
 * Llamar al iniciar el servidor.
 */
export async function detectAndStoreIp() {
  try {
    const currentIp = await getCurrentIp();
    if (!currentIp) {
      console.warn('[ipMonitor] No se pudo obtener la IP actual');
      return;
    }

    const stored = await getStoredIpRecord();
    const previousIp = stored?.ip;
    const now = new Date().toISOString();

    if (currentIp === previousIp) {
      console.log(`[ipMonitor] IP sin cambios: ${currentIp}`);
      return;
    }

    // IP cambió — actualizar y alertar
    const newRecord = {
      ip: currentIp,
      detected_at: now,
      previous_ip: previousIp || null,
      previous_detected_at: stored?.detected_at || null,
      change_count: (stored?.change_count || 0) + 1
    };

    await storeIpRecord(newRecord);
    console.warn(`[ipMonitor] ⚠️  IP cambió: ${previousIp || 'N/A'} → ${currentIp}`);

    if (previousIp) {
      await sendIpChangeAlert(currentIp, previousIp);
    }
  } catch (err) {
    console.error('[ipMonitor] Error en detectAndStoreIp:', err.message);
  }
}

/**
 * Retorna el registro completo de IP (actual + historial) desde Supabase.
 * Usado por el endpoint del SuperAdmin.
 */
export async function getIpStatus() {
  const [current, stored] = await Promise.all([
    getCurrentIp(),
    getStoredIpRecord()
  ]);

  return {
    current_ip: current,
    stored_ip: stored?.ip || null,
    ip_matches: current === stored?.ip,
    detected_at: stored?.detected_at || null,
    previous_ip: stored?.previous_ip || null,
    previous_detected_at: stored?.previous_detected_at || null,
    change_count: stored?.change_count || 0,
    lobbypms_whitelist_url: 'https://app.lobbypms.com/settings/api',
    cloudflare_ips_url: 'https://www.cloudflare.com/ips-v4',
    proxy_configured: !!process.env.LOBBYPMS_PROXY_URL
  };
}
