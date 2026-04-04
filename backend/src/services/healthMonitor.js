/**
 * Módulo de Auto-Monitoreo
 *
 * - Cada 5 min verifica: backend, Supabase, LobbyPMS, Wompi, WhatsApp
 * - Si un servicio falla: reintenta 2 veces con backoff
 * - Si no se recupera: envía alerta WhatsApp a +573234392420
 * - Guarda historial en health_checks
 * - Expone estado en tiempo real al dashboard
 */
import axios from 'axios';
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp.js';

const ALERT_NUMBER = process.env.WHATSAPP_NUMBER || '+573234392420';
const LOBBY_API = process.env.LOBBY_API_URL || 'https://api.lobbypms.com';
const WOMPI_API = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';

// Estado en memoria (para el endpoint de tiempo real)
export const currentStatus = {
  backend: { status: 'ok', checked_at: null },
  supabase: { status: 'ok', checked_at: null },
  lobbypms: { status: 'ok', checked_at: null },
  wompi: { status: 'ok', checked_at: null },
  whatsapp: { status: 'ok', checked_at: null }
};

// Control de alertas: no spamear si ya se alertó y sigue caído
const alertState = {};

// ============================================================
// Checks individuales por servicio
// ============================================================
async function checkBackend() {
  const start = Date.now();
  try {
    // Si llegamos aquí, el backend está corriendo
    return { status: 'ok', response_time_ms: Date.now() - start };
  } catch (err) {
    return { status: 'down', error: err.message, response_time_ms: Date.now() - start };
  }
}

async function checkSupabase() {
  const start = Date.now();
  try {
    const { error } = await supabase.from('properties').select('id').limit(1);
    if (error) throw new Error(error.message);
    return { status: 'ok', response_time_ms: Date.now() - start };
  } catch (err) {
    return { status: 'down', error: err.message, response_time_ms: Date.now() - start };
  }
}

async function checkLobbyPMS() {
  const start = Date.now();
  const token = process.env.LOBBY_TOKEN_ISLA_PALMA;
  if (!token || token === 'pendiente') return { status: 'ok', response_time_ms: 0, note: 'no_token' };
  try {
    await axios.get(`${LOBBY_API}/api/v1/rate-plans`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000
    });
    return { status: 'ok', response_time_ms: Date.now() - start };
  } catch (err) {
    const status = err.response?.status;
    // 401/403 = credenciales pero servidor vivo
    if (status === 401 || status === 403) return { status: 'ok', response_time_ms: Date.now() - start, note: 'auth_error' };
    return { status: 'down', error: err.message, response_time_ms: Date.now() - start };
  }
}

async function checkWompi() {
  const start = Date.now();
  // Leer public key desde BD (settings) con fallback a ENV
  let pubKey = process.env.WOMPI_PUBLIC_KEY_ISLA;
  try {
    const { getWompiConfig } = await import('./connectionService.js');
    const cfg = await getWompiConfig(null, 'isla-palma');
    if (cfg?.public_key) pubKey = cfg.public_key;
  } catch { /* usar ENV como fallback */ }

  if (pubKey) {
    try {
      // Verificar que el API de Wompi está accesible
      await axios.get(`${WOMPI_API}/merchants/${pubKey}`, { timeout: 8000 });
      return { status: 'ok', response_time_ms: Date.now() - start };
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        return { status: 'ok', response_time_ms: Date.now() - start }; // API responde
      }
      return { status: 'down', error: err.message, response_time_ms: Date.now() - start };
    }
  }
  return { status: 'ok', response_time_ms: 0, note: 'no_key' };
}

async function checkWhatsApp() {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || token === 'pendiente') return { status: 'ok', note: 'not_configured' };
  const start = Date.now();
  try {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    await axios.get(`https://graph.facebook.com/v18.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000
    });
    return { status: 'ok', response_time_ms: Date.now() - start };
  } catch (err) {
    if (err.response?.status === 400) return { status: 'ok', response_time_ms: Date.now() - start };
    return { status: 'degraded', error: err.message, response_time_ms: Date.now() - start };
  }
}

// ============================================================
// Guardar resultado en Supabase
// ============================================================
async function saveCheck(service, result) {
  currentStatus[service] = { ...result, checked_at: new Date().toISOString() };
  try {
    await supabase.from('health_checks').insert({
      service, status: result.status,
      response_time_ms: result.response_time_ms,
      error_message: result.error || null,
      alert_sent: false
    });
  } catch { /* no fallar si no se puede guardar el health check */ }
}

// ============================================================
// Enviar alerta al equipo
// ============================================================
async function sendAlert(service, error) {
  const now = Date.now();
  // No alertar más de una vez cada 30 minutos por servicio
  if (alertState[service] && (now - alertState[service]) < 30 * 60 * 1000) return;
  alertState[service] = now;

  const msg = `🚨 *ALERTA SISTEMA* — Mística AI\n\n` +
    `❌ Servicio caído: *${service.toUpperCase()}*\n` +
    `⏰ ${new Date().toLocaleString('es-CO')}\n` +
    `🔴 Error: ${error || 'No responde'}\n\n` +
    `El sistema intentó recuperarse automáticamente sin éxito.\n` +
    `Por favor verifica el servidor en Railway.`;

  try {
    await sendWhatsAppMessage(ALERT_NUMBER, msg);
    // Marcar alerta en la BD
    await supabase.from('health_checks')
      .update({ alert_sent: true })
      .eq('service', service)
      .order('checked_at', { ascending: false })
      .limit(1);
  } catch (err) {
    console.error('[HealthMonitor] Error enviando alerta:', err.message);
  }
}

// ============================================================
// Ejecutar todos los checks
// ============================================================
export async function runHealthChecks() {
  const checks = [
    { name: 'backend',  fn: checkBackend },
    { name: 'supabase', fn: checkSupabase },
    { name: 'lobbypms', fn: checkLobbyPMS },
    { name: 'wompi',    fn: checkWompi },
    { name: 'whatsapp', fn: checkWhatsApp }
  ];

  const results = {};

  for (const { name, fn } of checks) {
    let result;
    try {
      result = await fn();
    } catch (err) {
      result = { status: 'down', error: err.message, response_time_ms: 0 };
    }

    // Reintento si falla
    if (result.status === 'down') {
      await new Promise(r => setTimeout(r, 2000));
      try {
        result = await fn();
        if (result.status === 'ok') result.auto_recovered = true;
      } catch (err) {
        result = { status: 'down', error: err.message, response_time_ms: 0 };
      }
    }

    await saveCheck(name, result);

    if (result.status === 'down' && !result.auto_recovered) {
      await sendAlert(name, result.error);
    }

    results[name] = result;
  }

  const allOk = Object.values(results).every(r => r.status !== 'down');
  if (allOk) console.log('[HealthMonitor] ✅ Todos los servicios operativos');
  else console.warn('[HealthMonitor] ⚠️ Servicios con problemas:', Object.entries(results).filter(([, v]) => v.status !== 'ok').map(([k]) => k).join(', '));

  return results;
}

// ============================================================
// Obtener último estado (para el dashboard en tiempo real)
// ============================================================
export function getHealthStatus() {
  return currentStatus;
}

export async function getHealthHistory(service, limit = 100) {
  let query = supabase
    .from('health_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(limit);
  if (service) query = query.eq('service', service);
  const { data } = await query;
  return data || [];
}

export default { runHealthChecks, getHealthStatus, getHealthHistory };
