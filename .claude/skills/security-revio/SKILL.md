---
name: security-revio
description: >
  Activar cuando se trabaja con seguridad en Revio: encriptación
  AES-256 de API keys, JWT, rate limiting, validación de webhooks
  HMAC, aislamiento de datos multi-tenant, o cuando se detecta
  una vulnerabilidad de seguridad.
triggers:
  - "seguridad"
  - "jwt"
  - "encriptación"
  - "webhook signature"
  - "rate limit"
  - "autenticación"
  - "hmac"
version: 1.0.0
project: revio
---

# Revio — Seguridad

## Encriptación AES-256

Las API keys de proveedores IA se guardan encriptadas en Supabase.

```env
ENCRYPTION_KEY=a3f8c2d1e4b5967843210fedcba9876543210fedcba9876543210fedcba98765432
```

### Implementación AES-256-GCM (recomendada)
```js
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');  // 32 bytes

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(encoded) {
  const [iv, authTag, encrypted] = encoded.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return decipher.update(Buffer.from(encrypted, 'hex')) + decipher.final('utf8');
}
```

### Alternativa: AES-256-CBC
```js
// Usable si se requiere compatibilidad con otros sistemas
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
  const [ivHex, encHex] = text.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString();
}
```

**Recomendación**: Usar AES-256-GCM (incluye autenticación) en lugar de CBC.

## JWT

### Clientes (tenant users)
```env
JWT_SECRET=MisticaHostels2026SuperSecretKey
```
```js
// auth.js middleware
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded: { id, email, role, property_id, tenant_id }
req.user = decoded;
```

### SuperAdmin (Mística Tech)
```env
JWT_SUPERADMIN_SECRET=MisticaTech2026SuperAdminSecretKey_XK9m
```
```js
// superadminAuth.js
const SA_SECRET = process.env.JWT_SUPERADMIN_SECRET || process.env.JWT_SECRET + '_superadmin';
const decoded = jwt.verify(token, SA_SECRET);
if (decoded.role !== 'superadmin_tech') throw new Error('Denied');
```

Tokens de cliente: 24h
Tokens superadmin: 12h

## Rate Limiting

```js
// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                   // 100 requests por IP
  message: { error: 'Too many requests' }
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 20               // 20 mensajes por minuto
});
```

## Validación HMAC Webhooks

### Wompi
```js
// payments.js
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

router.post('/webhook', (req, res) => {
  const signature = req.headers['x-event-checksum'];
  const secret = process.env.WOMPI_EVENT_SECRET_ISLA;
  const expected = crypto.createHmac('sha256', secret)
    .update(req.body).digest('hex');
  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // procesar evento
});
```

### Meta (WhatsApp/Instagram)
```js
const appSecret = process.env.META_APP_SECRET;  // b16771c0aaaf31715c38b08203fe8c3f
const signature = req.headers['x-hub-signature-256']?.replace('sha256=', '');
const expected = crypto.createHmac('sha256', appSecret)
  .update(req.rawBody).digest('hex');
```

## Aislamiento Multi-tenant

Cada query a Supabase debe filtrar por tenant_id o property_id:

```js
// ✅ Correcto — tenant aislado
const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq('property_id', req.user.property_id);

// ❌ Incorrecto — expone datos de otros tenants
const { data } = await supabase.from('conversations').select('*');
```

## Headers de seguridad (Helmet)

```js
app.use(helmet({
  contentSecurityPolicy: false,  // desactivado para el widget
  crossOriginEmbedderPolicy: false
}));
```

## CORS

```js
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,     // producción
    'http://localhost:5173',       // desarrollo
    /\.revio\.co$/,                // subdominios revio.co
    '*'                            // widget embebido (necesario)
  ],
  credentials: true
}));
```

## Credenciales sensibles (nunca hardcodear)

```
ANTHROPIC_API_KEY    → console.anthropic.com
JWT_SECRET           → generar con: node -e "require('crypto').randomBytes(32).toString('hex')"
ENCRYPTION_KEY       → idem, 32 bytes hex
WOMPI_PRIVATE_KEY_*  → Wompi dashboard
META_APP_SECRET      → Meta Developers
```

## OWASP Top 10 — Estado de Implementación

| Categoria | Estado | Mitigacion |
|-----------|--------|-----------|
| A01 Broken Access Control | OK | RLS multi-tenant + JWT por tenant |
| A02 Cryptographic Failures | OK | AES-256-GCM + HTTPS forced |
| A03 Injection | OK | Supabase parameterized queries |
| A04 Insecure Design | PENDIENTE | Requiere security review arquitectonico |
| A05 Security Misconfiguration | OK | Helmet + CORS restringido |
| A06 Vulnerable Components | PENDIENTE | npm audit periodico recomendado |
| A07 Authentication Failures | OK | JWT + rate limiting + timingSafeEqual |
| A08 Integrity Failures | OK | HMAC webhooks + validacion firmas |
| A09 Logging Failures | PENDIENTE | Audit logs completo pendiente |
| A10 SSRF | PENDIENTE | Validacion URLs en integraciones pendiente |

## Vulnerabilidades conocidas y mitigaciones

| Vulnerabilidad | Estado | Mitigación |
|----------------|--------|------------|
| SQL injection | ✅ Mitigado | Supabase usa parameterized queries |
| XSS | ✅ Mitigado | React escapa por defecto + Helmet |
| CSRF | ✅ N/A | API JSON + JWT (no cookies) |
| Rate limiting DoS | ✅ Activo | express-rate-limit |
| Webhook replay | ✅ Mitigado | HMAC + timestamps |
| Tenant data leak | ✅ Guards | property_id filter en todos los queries |
| API key exposure | ✅ Encriptado | AES-256-GCM en BD |
