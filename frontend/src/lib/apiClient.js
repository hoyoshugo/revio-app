/**
 * apiClient.js — fetch wrapper centralizado con manejo de auth y errors.
 *
 * E-AGENT-11 B-FE-2 (2026-04-26): antes los componentes hacían fetch raw y
 * cuando el backend devolvía 401 (token expirado / inválido) la UI quedaba
 * en loading infinito sin redirigir al login. Ahora cualquier 401 limpia
 * la sesión y manda a /login con notificación toast.
 *
 * Uso:
 *   import { api } from '../lib/apiClient.js';
 *   const data = await api.get('/api/conversations?limit=10');
 *   const created = await api.post('/api/knowledge/abc', { key, value });
 *
 * Reglas:
 *   - Inyecta Authorization header desde localStorage automáticamente
 *   - Lanza ApiError con .status, .code, .message para que el caller
 *     pueda diferenciar (try/catch + toast por mensaje específico)
 *   - 401 → logout + redirect /login (no se relanza al caller)
 *   - 403 → toast "permiso denegado", se relanza
 *   - 5xx → toast "error servidor", se relanza
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEYS = ['revio_token', 'mystica_token'];

export class ApiError extends Error {
  constructor(message, { status, code, requestId, payload } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 0;
    this.code = code || null;
    this.requestId = requestId || null;
    this.payload = payload || null;
  }
}

function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function clearSession() {
  // Mantener sincronizado con AuthContext.logout()
  [
    'revio_token', 'revio_user', 'revio_tenant',
    'revio_properties', 'revio_current_property',
    'mystica_token', 'mystica_user',
  ].forEach((k) => localStorage.removeItem(k));
}

let _redirectingToLogin = false;
function handleAuthExpired(message) {
  if (_redirectingToLogin) return;
  _redirectingToLogin = true;
  clearSession();
  try {
    if (typeof window !== 'undefined' && window.alzioToast) {
      window.alzioToast(message || 'Tu sesión expiró. Iniciá sesión de nuevo.', 'warning');
    }
  } catch { /* silencioso */ }
  // Pequeño delay para que el toast alcance a renderear
  setTimeout(() => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }, 250);
}

async function request(method, path, { body, headers = {}, signal, suppressToast = false } = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const token = getToken();
  const init = {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    signal,
  };
  if (body !== undefined && body !== null) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (netErr) {
    // Network error / CORS / timeout
    if (!suppressToast && typeof window !== 'undefined' && window.alzioToast) {
      window.alzioToast('Sin conexión con el servidor. Reintenta en un momento.', 'error');
    }
    throw new ApiError(netErr.message || 'network_error', { status: 0, code: 'NETWORK' });
  }

  // 204 No Content
  if (res.status === 204) return null;

  let payload = null;
  const contentType = res.headers.get('content-type') || '';
  try {
    payload = contentType.includes('json') ? await res.json() : await res.text();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.error || payload?.message || `HTTP ${res.status}`;
    const code = payload?.code || null;
    const requestId = payload?.request_id || null;

    // 401 → token expirado/inválido → cerrar sesión y mandar a /login
    if (res.status === 401) {
      handleAuthExpired(message);
      throw new ApiError('auth_expired', { status: 401, code: 'AUTH_EXPIRED', requestId });
    }

    // 403 → permiso denegado (no cerrar sesión, mostrar toast)
    if (res.status === 403 && !suppressToast) {
      if (typeof window !== 'undefined' && window.alzioToast) {
        window.alzioToast(message || 'No tienes permiso para esta acción.', 'error');
      }
    }

    // 5xx → error servidor
    if (res.status >= 500 && !suppressToast) {
      if (typeof window !== 'undefined' && window.alzioToast) {
        window.alzioToast(
          'Error en el servidor. Si persiste, contactanos.' +
            (requestId ? ` (ref: ${requestId})` : ''),
          'error'
        );
      }
    }

    throw new ApiError(message, { status: res.status, code, requestId, payload });
  }

  return payload;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
  raw: request, // escape hatch
};

export default api;
