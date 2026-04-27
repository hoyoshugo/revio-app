/**
 * Utilidades de seguridad centralizadas (E-AGENT-9, 2026-04-26).
 *
 * Centraliza la resolución de secretos críticos para evitar:
 *   - JWT_SECRET con default predecible (`'revio_dev_secret_2026'`,
 *     `'dev-secret'`) que permita firmar tokens si la env var no está
 *     seteada en prod.
 *   - Passwords plaintext en DB (legacy de Revio): handlers que comparen
 *     con `===` sin bcrypt.
 *
 * Reglas:
 *   - En `NODE_ENV === 'production'` los secretos REQUIEREN env var; el
 *     proceso falla al boot si faltan.
 *   - En dev (NODE_ENV !== 'production') se acepta un default local
 *     pero loguea un warning visible.
 */
import bcrypt from 'bcryptjs';

const IS_PROD = process.env.NODE_ENV === 'production';
const BCRYPT_ROUNDS = 10;

function resolveSecret(envVar, devFallback) {
  const v = process.env[envVar];
  if (v && v.length >= 16) return v;

  if (IS_PROD) {
    // Hard fail at boot — no fallback en producción
    throw new Error(
      `[security] ${envVar} no está seteado o es muy corto (<16 chars). ` +
      `Setear en Railway → Variables. Hard requirement en producción.`
    );
  }
  console.warn(
    `[security] ⚠️  ${envVar} no seteado. Usando fallback DEV. NO usar en producción.`
  );
  return devFallback;
}

/** JWT secret para tokens de clientes (auth.js, dashboard.js, register.js) */
export const JWT_SECRET = resolveSecret('JWT_SECRET', 'alzio_dev_jwt_2026_local_only');

/** JWT secret para tokens de super-admin (superadmin.js) */
export const JWT_SUPERADMIN_SECRET =
  process.env.JWT_SUPERADMIN_SECRET ||
  (IS_PROD
    ? (() => { throw new Error('[security] JWT_SUPERADMIN_SECRET requerido en producción'); })()
    : `${JWT_SECRET}_superadmin`);

/** Hash bcrypt de un password plaintext */
export async function hashPassword(plain) {
  if (!plain || typeof plain !== 'string') {
    throw new Error('hashPassword: plain password requerido');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verifica un password contra un hash bcrypt o (legacy) plaintext.
 * Retorna { ok, needsRehash } — needsRehash=true si el hash en DB es legacy
 * plaintext y debe migrarse a bcrypt.
 */
export async function verifyPassword(plain, hash, version) {
  if (!plain || !hash) return { ok: false, needsRehash: false };

  // Bcrypt: detectado por prefijo $2a$/$2b$/$2y$ o version === 1
  if (version === 1 || (typeof hash === 'string' && hash.startsWith('$2'))) {
    try {
      const ok = await bcrypt.compare(plain, hash);
      return { ok, needsRehash: false };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }

  // Legacy plaintext (Revio): match exacto + flag para rehash en background
  return { ok: plain === hash, needsRehash: true };
}

/** Resuelve credenciales de super-admin con fail-closed en producción */
export function getSuperadminCredentials() {
  const email = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || '';

  if (IS_PROD && (!email || !password)) {
    throw new Error(
      '[security] SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD requeridos en ' +
      'producción. Setear en Railway → Variables.'
    );
  }

  // Dev fallback (NO usar en prod)
  if (!email || !password) {
    console.warn(
      '[security] ⚠️  SUPERADMIN_EMAIL/PASSWORD no seteados. Fallback DEV: admin@alzio.local / changeme.'
    );
    return { email: 'admin@alzio.local', password: 'changeme' };
  }

  return { email, password };
}

/**
 * Allowlist de orígenes para CORS. Acepta:
 *   - process.env.FRONTEND_URL (app principal)
 *   - process.env.ALLOWED_ORIGINS (lista coma-separada)
 *   - localhost:5173 / 3000 / 127.0.0.1:5173 en dev
 */
export function buildCorsOriginChecker() {
  const explicit = new Set(
    [
      process.env.FRONTEND_URL,
      'https://app.alzio.co',
      'https://alzio.co',
      'https://www.alzio.co',
    ]
      .filter(Boolean)
      .map((u) => u.replace(/\/$/, ''))
  );

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .forEach((u) => explicit.add(u));
  }

  if (!IS_PROD) {
    explicit.add('http://localhost:5173');
    explicit.add('http://localhost:3000');
    explicit.add('http://127.0.0.1:5173');
  }

  return (origin, cb) => {
    // Sin origin: curl, server-to-server, mobile apps → permitir
    if (!origin) return cb(null, true);

    const normalized = origin.replace(/\/$/, '');
    if (explicit.has(normalized)) return cb(null, true);

    // Vercel preview deployments del proyecto
    if (/^https:\/\/alzio-platform-[a-z0-9-]+\.vercel\.app$/.test(normalized)) {
      return cb(null, true);
    }

    // Bloquea pero NO crashea: log + 403
    console.warn(`[cors] Origin bloqueado: ${origin}`);
    return cb(new Error('Origin no permitido'), false);
  };
}

/**
 * CORS para rutas del widget embebible (chat.js, embed.js).
 * Estas rutas SÍ deben aceptar cualquier origen porque los clientes
 * Alzio integran el widget en sus propios dominios.
 */
export function widgetCorsOpen(_origin, cb) {
  cb(null, true);
}
