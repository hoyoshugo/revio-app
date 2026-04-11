# Hoja de Ruta — Mensajería en OTAs

## Estado actual

| Canal                       | Estado      | Notas                                          |
|-----------------------------|-------------|------------------------------------------------|
| WhatsApp Business           | ✅ Activo    | Token Meta verificado, agente responde 24/7    |
| Instagram DMs               | ✅ Activo    | Mismo token Meta, agente responde DMs reales   |
| Facebook Messenger          | ✅ Activo    | Mismo token Meta, agente responde Messenger    |
| Google Business Messages    | 🔧 Pendiente | Pendiente verificación OAuth (proceso manual)  |
| TripAdvisor (Reseñas)       | 🤖 IA + 👤   | IA redacta respuesta, admin publica con un clic|
| Google Reviews              | 🤖 IA + 👤   | Igual que TripAdvisor                          |

## FASE 2 — Aplicar como Connectivity Partner

### Booking.com
- **URL:** https://connectivity.booking.com
- **Tipo de API:** Messaging API real para Connectivity Partners
- **Proceso:**
  1. Aplicar como Connectivity Partner en el portal
  2. Pasar certificación técnica (~4-8 semanas)
  3. Implementar la Messaging API contra el sandbox
  4. Pasar a producción
- **Requisitos previos:**
  - Mínimo 10 propiedades activas usando Revio
  - Empresa registrada con NIT y representante legal
  - Compromiso de mantenimiento del SLA de Booking
- **Acción inmediata (Hugo):** aplicar en https://connectivity.booking.com cuando
  Revio tenga 10+ propiedades activas
- **Documentación oficial:** https://developers.booking.com/connectivity/docs/messaging-api

### Airbnb
- **URL:** https://www.airbnb.com/partner
- **Tipo de API:** Open API disponible para partners
- **Proceso:** similar a Booking — aplicación → certificación → producción
- **Notas:** Airbnb tiende a aprobar más rápido (2-4 semanas) que Booking

### Expedia
- **URL:** https://expediagroup.com/partners
- **Tipo de API:** Expedia Quick Connect (EQC)
- **Notas:** Solo certifica partners con presencia comprobada en LATAM/USA

### Hostelworld
- **URL:** https://www.hostelworld.com/partner
- **Tipo de API:** REST limitada — sin mensajería en API pública
- **Workaround actual:** sincronización iCal (sí disponible)

## FASE 3 — Channel Manager propio

- Integración con LobbyPMS (ya tienen API con cliente demo)
- Sincronización de tarifas por temporada desde Revio
- Distribución a todas las OTAs vía un solo punto de entrada
- Control de overbooking con buffer configurable
- Push instantáneo de disponibilidad
- Histórico de cambios por fecha

## FASE 4 — Mensajería unificada en producción

- Webhook único desde Booking/Airbnb/Expedia → unified_inbox de Revio
- Agente IA responde con el mismo system prompt que en WhatsApp
- Modo "auto-pause" cuando un huésped pide hablar con humano
- Métricas: tiempo de respuesta, % de conversión, satisfacción

## Tabla de tablas relacionadas en Supabase

| Tabla                       | Propósito                                          |
|-----------------------------|---------------------------------------------------|
| `property_channels`         | Configuración por canal y propiedad               |
| `tenant_provider_selections`| Proveedor activo por categoría (ai/payments/pms)  |
| `unified_inbox`             | Bandeja unificada de mensajes de todos los canales|
| `property_reviews`          | Reseñas de plataformas + respuestas IA            |
| `waitlist_features`         | Lista de espera para features futuros             |
| `channel_manager_rates`     | Tarifas por canal (estructura base FASE 3)        |
