---
name: revio-security
description: |
  Seguridad de Revio. AES-256, JWT, RLS multi-tenant, webhooks HMAC.
  Activar cuando se trabaje en auth, encriptacion, permisos, OWASP.
triggers:
  - seguridad
  - OWASP
  - JWT
  - cifrado
  - AES
  - autenticacion
  - autorizacion
  - RLS
  - webhook validacion
status: implementado
priority: P0
---

# Revio Security

## Implementado
- AES-256-CBC para credenciales de clientes en Supabase
- JWT con expiracion configurable
- Rate limiting por IP y usuario
- Validacion HMAC para webhooks (Wompi, Meta)
- RLS por tenant en Supabase
- HTTPS forzado via Railway

## Patron de encriptacion (AES-256)
```javascript
// backend/src/services/encryption.js
import crypto from 'crypto';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text) => {
  const [ivHex, encHex] = text.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString();
};
```

## Validacion webhooks HMAC
```javascript
// Para Wompi y Meta
const validateWebhookSignature = (body, signature, secret) => {
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
};
```

## RLS multi-tenant
```sql
-- Cada tabla sensible tiene: property_id o tenant_id
-- La politica RLS verifica que el JWT del usuario
-- corresponda al tenant correcto
CREATE POLICY "tenant_isolation" ON conversations
  USING (property_id = current_setting('app.property_id')::uuid);
```

## OWASP Top 10 estado
- A01 Broken Access Control: OK (RLS + JWT)
- A02 Crypto Failures: OK (AES-256 + HTTPS)
- A03 Injection: OK (Supabase parameterized)
- A07 Auth Failures: OK (JWT + rate limiting)
- A08 Integrity Failures: OK (HMAC webhooks)
- A09 Logging Failures: PENDIENTE (audit logs)

## Pendiente
- 2FA para superadmin
- Audit log completo de operaciones sensibles
- Rotacion periodica de secrets
- Registro RNBD SIC (Ley 1581/2012)
