---
name: ai-agent-revio
description: >
  Activar cuando se trabaja con el agente IA de Revio: hotelAgent.js,
  prompts del sistema, knowledge base por propiedad, intensidades de
  venta, selección de proveedor IA por cliente, manejo de conversaciones
  multiidioma, o cuando el agente no responde correctamente.
triggers:
  - "agente ia"
  - "hotelAgent"
  - "prompt"
  - "knowledge base"
  - "intensidad de venta"
  - "proveedor ia"
  - "conversación"
  - "claude api"
version: 1.0.0
project: revio
---

# Revio — Agente IA

## Archivo principal
`backend/src/agents/hotelAgent.js`

## Estado actual: BLOQUEADO
**Problema**: API key de Anthropic sin créditos (`credit balance too low`)
**Solución**: Recargar en https://console.anthropic.com/settings/billing ($20 USD)

## Arquitectura del agente

```
Usuario (WhatsApp/widget) → chat route → hotelAgent.js
                                              ↓
                          Cargar conocimiento de property_knowledge
                                              ↓
                          Cargar conversación previa (últimos 10 mensajes)
                                              ↓
                          Detectar idioma (ES/EN/PT/FR)
                                              ↓
                          Llamar a Claude con system prompt
                                              ↓
                          Detectar intención: info/reserva/pago
                                              ↓
                     Si reserva → consultar LobbyPMS → crear link Wompi
                                              ↓
                          Guardar mensaje en Supabase
                                              ↓
                          Responder al usuario
```

## System prompt generado dinámicamente

```js
// Combina:
// 1. Instrucciones base del agente
// 2. Conocimiento de la propiedad (property_knowledge)
// 3. Intensidad de venta configurada
// 4. Idioma detectado
// 5. Disponibilidad de LobbyPMS

const systemPrompt = buildSystemPrompt({
  property,          // datos de la propiedad
  knowledge,         // rows de property_knowledge
  salesIntensity,    // 'soft' | 'moderate' | 'intense'
  language,          // 'es' | 'en' | 'pt'
  availability       // habitaciones disponibles
});
```

## Knowledge Base por propiedad

### Categorías disponibles
```
general     → nombre, descripcion, ubicacion, web, whatsapp
rooms       → tipos, restriccion_ninos, capacidad_maxima
policies    → check_in, check_out, cancelacion, mascotas
activities  → incluidas, tours_pagados, link
transport   → como_llegar, desde_aeropuerto, tiempo_viaje
faq         → link, wifi, efectivo
menu        → link, descripcion
contact     → whatsapp, web, horario_atencion
restrictions → ninos, edad_minima, parque (Tayrona)
```

### API para gestionar knowledge
```
GET  /api/knowledge/:propertyId        → listar categorías
GET  /api/knowledge/:propertyId/:category → items de categoría
POST /api/knowledge/:propertyId        → crear item
PUT  /api/knowledge/:id                → actualizar item
DELETE /api/knowledge/:id              → eliminar item
```

## Intensidades de venta

```
soft:      Responde preguntas, menciona disponibilidad
moderate:  Proactivamente sugiere reservas, FOMO suave
intense:   Urgencia alta, ofertas, cierre agresivo
```

## Selección de proveedor IA por cliente

Cada propiedad puede configurar su propio modelo:

```js
// En properties table:
ai_provider: 'anthropic' | 'openai' | 'gemini' | 'groq'
ai_model:    'claude-sonnet-4-6' | 'gpt-4o' | 'gemini-1.5-pro' | 'llama-3.1-70b'
ai_api_key:  [encriptado AES-256 con ENCRYPTION_KEY]
```

Si no tiene key propia → usa la key de Revio (ANTHROPIC_API_KEY del .env).

## Multiidioma

El agente detecta automáticamente el idioma del usuario:
- ES → responde en español
- EN → responde en inglés
- PT → responde en portugués
- FR → responde en francés

## Integración con LobbyPMS

```js
// Solo cuando el usuario quiere reservar:
const rooms = await getAvailableRooms(slug, checkIn, checkOut);
// Si hay disponibilidad → crear payment link Wompi
const link = await createPaymentLink(roomData, guestInfo);
// Responder con link
```

**Problema actual**: LobbyPMS bloquea IP 200.189.27.14 (Railway)
**Solución**: whitelist en LobbyPMS dashboard

## Escalación a humano

Cuando el agente no puede ayudar:
```js
// service: escalation.js
if (shouldEscalate(message, conversation)) {
  await notifyHuman('+573057673770');  // ESCALATION_WHATSAPP_1
  await notifyHuman('+573006526427');  // ESCALATION_WHATSAPP_2
}
```

## Errores comunes

| Error | Causa | Solución |
|-------|-------|---------|
| `credit balance too low` | Sin créditos Anthropic | Recargar en console.anthropic.com |
| `Problem técnico momentáneo` | Cualquier error de Claude | Ver logs Railway → identificar causa |
| Agente responde en inglés cuando esperamos español | Prompt de idioma no aplicado | Verificar `language` en property |
| No consulta disponibilidad | LobbyPMS bloqueado | Whitelist IP 200.189.27.14 |
