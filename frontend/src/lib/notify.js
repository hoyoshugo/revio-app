/**
 * notify.js — helpers para mostrar feedback al user vía toast.
 *
 * E-AGENT-11 H-FE-1 (2026-04-26): antes los componentes hacían
 * `catch (e) { console.error(e); }` sin feedback al user → loading
 * infinito o silencio inexplicable. Ahora usar:
 *
 *   import { notifyError, notifySuccess } from '../lib/notify.js';
 *   try { ... } catch (e) { notifyError('No pude cargar conversaciones', e); }
 *
 * Reglas:
 *   - notifyError logea SIEMPRE a consola (debug) Y muestra toast al user
 *   - notifySuccess solo toast (no consola)
 *   - 401/AUTH_EXPIRED: NO mostramos toast (apiClient ya maneja la
 *     redirección y muestra su propio toast)
 *   - Si el toast no está montado, fallback a console.warn
 */

function safeToast(message, kind) {
  try {
    if (typeof window !== 'undefined' && window.alzioToast) {
      window.alzioToast(message, kind);
      return true;
    }
  } catch { /* silent */ }
  return false;
}

/**
 * @param {string} userMessage - Mensaje human-readable para el toast
 * @param {Error|ApiError|null} [err] - Error original (logueado a consola)
 */
export function notifyError(userMessage, err) {
  // Logueo siempre a consola para debug
  if (err) {
    console.error(`[${userMessage}]`, err);
  } else {
    console.error(`[${userMessage}]`);
  }

  // 401: apiClient ya manejó la redirección y mostró toast. No duplicar.
  if (err?.status === 401 || err?.code === 'AUTH_EXPIRED') return;

  // 403: apiClient ya mostró toast genérico. Si el caller pasó un mensaje
  // más específico, mostrarlo encima. Caller decide.
  if (err?.status === 403 && err?.message) {
    safeToast(userMessage || err.message, 'error');
    return;
  }

  // 5xx: apiClient ya mostró toast genérico. Mismo caso que 403.
  if (err?.status >= 500 && err?.requestId) {
    safeToast(`${userMessage} (ref: ${err.requestId})`, 'error');
    return;
  }

  if (!safeToast(userMessage, 'error')) {
    console.warn('[notify] Toast no disponible:', userMessage);
  }
}

export function notifySuccess(message) {
  if (!safeToast(message, 'success')) {
    console.log('[notify]', message);
  }
}

export function notifyWarning(message) {
  safeToast(message, 'warning');
}

export function notifyInfo(message) {
  safeToast(message, 'info');
}

/**
 * Instala global handlers para unhandled errors / promise rejections.
 * Llamar UNA vez en App.jsx. Captura cualquier throw asíncrono que
 * no haya sido catched por el componente.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // Skip 401: apiClient ya redirigió a /login
    if (reason?.status === 401 || reason?.code === 'AUTH_EXPIRED') return;
    console.error('[unhandledrejection]', reason);
    safeToast(
      reason?.message
        ? `Error inesperado: ${reason.message}`
        : 'Ocurrió un error inesperado.',
      'error'
    );
  });

  window.addEventListener('error', (event) => {
    // Solo captura errors no manejados a nivel window (script load fail, etc.)
    // Los errores en componentes React caen en ErrorBoundary
    if (event.error && !event.error.__handled) {
      console.error('[window.error]', event.error);
    }
  });
}
