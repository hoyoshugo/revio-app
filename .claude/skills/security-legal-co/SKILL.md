---
name: security-legal-co
description: Requisitos de seguridad y legales para operar en Colombia como SaaS. Actívate cuando implementes auth, manejo de datos personales, facturación, o cualquier feature con implicaciones legales.
triggers:
  - seguridad
  - legal
  - DIAN
  - Ley 1581
  - habeas data
  - PCI
  - OWASP
  - compliance
version: 1.0.0
---

# Seguridad y Legal Colombia

## Ley 1581/2012 — Habeas Data
- Mostrar política de privacidad antes de recopilar datos
- Checkbox explícito de consentimiento para marketing
- Derecho de supresión: `DELETE /api/contacts/:id`
- Registro en RNBD de la SIC
- Retención: mínimo necesario para el servicio

## Seguridad técnica
- **AES-256-CBC** para credenciales de clientes en BD
- **JWT** exp máx 24h usuarios, 1h operaciones sensibles
- **Rate limit**: 100 req/min por IP, 20 req/min en `/api/auth/*`
- **HTTPS** forzado, HSTS habilitado
- **Inputs** sanitizados, nunca concatenar SQL
- **RLS** en todas las tablas Supabase

## PCI-DSS básico
- NUNCA almacenar PAN completo
- Tokenización vía pasarela (Wompi/PayU PCI-compliant)
- Datos de pago NUNCA tocan Revio
- Log de transacciones sin datos sensibles

## OWASP Top 10 — estado Revio
| ID | Riesgo | Estado |
|----|--------|--------|
| A01 Broken Access Control | RLS + JWT + tenant isolation | ✅ |
| A02 Cryptographic Failures | AES-256 + HTTPS | ✅ |
| A03 Injection | Supabase parameterized | ✅ |
| A07 Auth Failures | JWT + rate limit | ✅ |
| A09 Security Logging | audit trail | ⚠️ pendiente |

## Documentos legales requeridos
- Términos y Condiciones
- Política de Privacidad (Ley 1581)
- SLA (99.5% mínimo)
- Política de cancelación y reembolsos
