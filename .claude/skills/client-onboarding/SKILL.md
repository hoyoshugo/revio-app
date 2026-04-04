---
name: client-onboarding
description: >
  Activar cuando se está incorporando un nuevo cliente a Revio:
  proceso de registro, configuración de propiedades, conexión de
  integraciones paso a paso, o cuando se necesita solucionar
  problemas de onboarding de un cliente existente.
triggers:
  - "nuevo cliente"
  - "onboarding"
  - "registrar"
  - "configurar propiedad"
  - "conectar integración"
  - "primer paso"
version: 1.0.0
project: revio
---

# Revio — Onboarding de Clientes

## Proceso completo de onboarding

### Paso 1: Registro
```
URL: https://revio-app-production.up.railway.app/register
Datos requeridos:
  - Nombre del negocio
  - Email de contacto
  - Contraseña
  - Nombre de la primera propiedad
  - Ciudad
```

Esto crea automáticamente:
- Un registro en `tenants`
- Un usuario admin en `users`
- Una propiedad básica en `properties`
- Trial de 14 días

### Paso 2: Wizard de onboarding
```
URL: /onboarding (redirección automática tras registro)
Pasos del wizard:
  1. Información básica de la propiedad
  2. Conectar PMS (LobbyPMS / Cloudbeds / Mews / Personalizado)
  3. Conectar WhatsApp
  4. Configurar agente IA
  5. Prueba del chatbot
```

### Paso 3: Configurar knowledge base

En el Dashboard → Knowledge Base:
1. General: nombre, descripción, ubicación, website
2. Habitaciones: tipos disponibles, restricciones
3. Políticas: check-in/out, cancelación, mascotas
4. Actividades: incluidas y con costo
5. Transporte: cómo llegar
6. FAQ: wifi, efectivo, preguntas frecuentes

### Paso 4: Conectar PMS

**LobbyPMS:**
1. Ir a https://app.lobbypms.com → Configuración → API
2. Copiar el Bearer Token
3. En Revio Dashboard → Configuración → PMS → pegar token
4. ⚠️ Pedir al equipo LobbyPMS whitelist IP del servidor Revio

**Cloudbeds:**
1. Ir a apps.cloudbeds.com → Apps → API Keys
2. Crear nueva API key con permisos de lectura
3. Copiar client_id y client_secret

### Paso 5: Conectar WhatsApp

**Opción A: Token temporal (60 días)**
1. Ir a developers.facebook.com/tools/explorer
2. Seleccionar la app de Meta
3. Generar token con permisos:
   - whatsapp_business_management
   - whatsapp_business_messaging
4. Copiar token → Dashboard Revio → Configuración → WhatsApp

**Opción B: Token permanente (Sistema Usuario)**
1. Meta Business Manager → Configuración → Usuarios del sistema
2. Crear usuario "revio-bot" con rol Administrador
3. Asignar WABA al usuario
4. Generar token → no expira

### Paso 6: Configurar webhook en Meta

```
URL del webhook: https://[dominio]/api/social/webhook/meta
Verify Token: [META_VERIFY_TOKEN del .env]
Suscripciones: messages, messaging_postbacks
```

### Paso 7: Probar el sistema

```bash
# 1. Verificar health
curl https://[dominio]/health

# 2. Login de cliente
curl -X POST https://[dominio]/api/dashboard/login \
  -H "Content-Type: application/json" \
  -d '{"email":"[email]","password":"[pass]"}'

# 3. Probar chat
curl -X POST https://[dominio]/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","property_slug":"[slug]","session_id":"test"}'
```

## Errores comunes de onboarding

| Error | Causa | Solución |
|-------|-------|---------|
| "credenciales inválidas" | Email/pass incorrectos | Verificar en Supabase tabla users |
| LobbyPMS 403 | IP no whitelisted | Contactar soporte LobbyPMS |
| WhatsApp no envía | Phone DISCONNECTED | Meta Business → reconectar número |
| Agente responde "problema técnico" | Sin créditos Anthropic | Recargar billing |
| "propiedad no encontrada" | Slug incorrecto | Verificar slug en Supabase tabla properties |

## Scripts de configuración inicial de propiedad

```bash
# Crear knowledge base inicial via API
TOKEN="[jwt_token]"
PROPERTY_ID="[uuid]"
BASE="https://revio-app-production.up.railway.app"

# Agregar items básicos
for ITEM in \
  '{"category":"general","key":"nombre","value":"Mi Hostel"}' \
  '{"category":"policies","key":"check_in","value":"Check-in desde las 3PM"}' \
  '{"category":"policies","key":"check_out","value":"Check-out hasta las 11AM"}'; do
  curl -X POST "$BASE/api/knowledge/$PROPERTY_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$ITEM"
done
```

## Soporte

- Email: info@treshache.co
- WhatsApp soporte: +573057673770
- Documentación: https://revio.co/docs
