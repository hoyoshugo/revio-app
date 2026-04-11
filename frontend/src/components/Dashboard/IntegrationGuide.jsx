/**
 * IntegrationGuide — Modal con instrucciones paso a paso para cada integración.
 * Instrucciones genéricas: no contiene datos de ningún cliente específico.
 * Las credenciales se configuran en el panel de Integraciones (/connections).
 */
import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Play, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS = {
  connected:          { label: 'Conectado',          color: '#10b981', icon: '✅' },
  pending_token:      { label: 'Token pendiente',     color: '#f59e0b', icon: '⚠️' },
  pending_approval:   { label: 'Aprobación pendiente',color: '#6366f1', icon: '📋' },
  not_configured:     { label: 'Sin configurar',      color: '#64748b', icon: '⚪' },
};

const GUIDES = {

  // ══════════════════════════════════════════
  // PMS
  // ══════════════════════════════════════════

  lobbypms: {
    name: 'LobbyPMS',
    icon: '🏨',
    category: 'PMS',
    color: '#0ea5e9',
    status: 'connected',
    estimatedTime: '10 min',
    description: 'PMS para hostels y hoteles LATAM. Revio consulta disponibilidad en tiempo real y crea reservas automáticamente.',
    docUrl: 'https://docs.lobbypms.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'API Token (por propiedad)', envKey: 'LOBBY_TOKEN', example: 'Tu token de LobbyPMS...' },
      { label: 'API URL', envKey: 'LOBBY_API_URL', example: 'https://api.lobbypms.com' },
    ],
    steps: [
      {
        n: 1,
        title: 'Inicia sesión en LobbyPMS',
        body: 'Ve a app.lobbypms.com. Ingresa con tu email y contraseña de administrador. Si no tienes cuenta, crea una en lobbypms.com/registro.',
        tip: 'Usa el email con el que registraste la propiedad, no el de un recepcionista.',
      },
      {
        n: 2,
        title: 'Ve a Configuración → Integraciones → API',
        body: 'En el menú lateral izquierdo, haz clic en el ícono de engranaje (⚙️) → "Integraciones" → "API Tokens". Si no ves esta sección, necesitas permisos de Administrador.',
        tip: null,
      },
      {
        n: 3,
        title: 'Crea un nuevo token',
        body: 'Haz clic en el botón azul "+ Nuevo Token". En el campo "Nombre", escribe "Revio". En "Permisos", activa: ✅ Disponibilidad (lectura), ✅ Reservas (lectura y escritura), ✅ Tarifas (lectura). Haz clic en "Generar Token".',
        tip: null,
      },
      {
        n: 4,
        title: 'Copia el token inmediatamente',
        body: 'LobbyPMS solo muestra el token UNA VEZ. Cópialo ahora y guárdalo en un lugar seguro antes de cerrar el modal. El token tiene el formato: [32-64 caracteres alfanuméricos].',
        tip: 'Si lo pierdes, deberás revocar el token y crear uno nuevo.',
      },
      {
        n: 5,
        title: 'IP Whitelist (solo si hay error 403)',
        body: 'En la mayoría de configuraciones, LobbyPMS NO requiere whitelist de IP. Solo si ves error 403, ve a API → Seguridad → IPs Permitidas y agrega la IP de tu servidor. Para obtener la IP del servidor: curl https://api.ipify.org en la terminal del servidor.',
        tip: 'La IP de Railway es dinámica. Si configuras whitelist, puede fallar después de un redeploy.',
      },
      {
        n: 6,
        title: 'Repite para cada propiedad',
        body: 'Si tienes múltiples propiedades en LobbyPMS, genera un token separado para cada una. En Revio, cada propiedad tiene su propio campo de token (Isla Palma, Tayrona, etc.).',
        tip: null,
      },
      {
        n: 7,
        title: 'Pega en Revio y verifica',
        body: 'En el panel de Revio, ve a Configuración → Conexiones → LobbyPMS. Pega el token en el campo correspondiente y haz clic en "Probar Conexión". Deberías ver: "Conectado — X habitaciones disponibles".',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'Error 403 Forbidden', solution: 'Tu IP no está en el whitelist de LobbyPMS. Ve a LobbyPMS → API → Seguridad → IPs permitidas y agrega tu IP del servidor.' },
      { error: 'Error 404 Resource Not Found', solution: 'El endpoint es incorrecto. Los endpoints correctos son: /api/v1/bookings, /api/v2/available-rooms, /api/v1/rate-plans. Verifica que LOBBY_API_URL esté configurado como https://api.lobbypms.com' },
      { error: 'Error 401 Unauthorized', solution: 'El token es inválido o fue revocado. Genera un nuevo token en LobbyPMS.' },
      { error: 'No hay disponibilidad', solution: 'Verifica que los parámetros start_date, end_date y adults estén correctamente formateados (YYYY-MM-DD).' },
    ],
    notes: [
      'Los tokens de LobbyPMS no tienen fecha de expiración por defecto.',
      'Verificado en producción: Isla Palma retorna 15+ tipos de habitación con precios en tiempo real.',
      'Endpoint de disponibilidad: GET /api/v2/available-rooms?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&adults=N',
    ],
  },

  cloudbeds: {
    name: 'Cloudbeds',
    icon: '☁️',
    category: 'PMS',
    color: '#6366f1',
    status: 'not_configured',
    estimatedTime: '20 min',
    description: 'PMS cloud con presencia global. Integración vía OAuth2 con API REST v1.2.',
    docUrl: 'https://hotels.cloudbeds.com/api/v1.2/',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'OAuth Access Token', envKey: 'CLOUDBEDS_TOKEN', example: 'cb_oauth_...' },
    ],
    steps: [
      { n: 1, title: 'Ingresa a Cloudbeds', body: 'Accede a app.cloudbeds.com con tu cuenta de administrador de la propiedad.', tip: null },
      { n: 2, title: 'Ve a Apps & Marketplace', body: 'En el menú superior, busca "Apps" o "Marketplace". Filtra por "Developer" o busca "API Access".', tip: null },
      { n: 3, title: 'Crea aplicación OAuth', body: 'Nombre: "Revio Integration". Redirect URL: https://[tu-dominio]/oauth/cloudbeds. Permisos: read:reservations, write:reservations, read:availability, read:rates.', tip: null },
      { n: 4, title: 'Completa el flujo OAuth', body: 'Sigue el flujo de autorización OAuth2. Revio obtendrá automáticamente el access_token y refresh_token.', tip: null },
      { n: 5, title: 'Pega el Client ID y Secret en Revio', body: 'En Configuración → Conexiones → Cloudbeds, ingresa el Client ID y Client Secret de tu aplicación OAuth.', tip: null },
    ],
    troubleshooting: [
      { error: 'Token expirado', solution: 'Cloudbeds OAuth tokens expiran. Revio usa el refresh_token automáticamente. Si falla, reconecta la integración.' },
    ],
    notes: ['Los tokens OAuth de Cloudbeds tienen vida limitada — Revio los renueva automáticamente usando el refresh token.'],
  },

  mews: {
    name: 'Mews',
    icon: '🌐',
    category: 'PMS',
    color: '#8b5cf6',
    status: 'not_configured',
    estimatedTime: '15 min',
    description: 'PMS moderno con Connector API. Muy popular en Europa y expansión LATAM.',
    docUrl: 'https://mews-systems.gitbook.io/connector-api/',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Access Token', envKey: 'MEWS_ACCESS_TOKEN', example: 'C66EF7B239D24632943D115EDE9...' },
      { label: 'Client Token', envKey: 'MEWS_CLIENT_TOKEN', example: 'E0D439EE522F44368DC78E1BFB...' },
    ],
    steps: [
      { n: 1, title: 'Ingresa a Mews Commander', body: 'Ve a app.mews.com como administrador de la propiedad.', tip: null },
      { n: 2, title: 'Settings → Integrations', body: 'En el menú lateral, ve a Settings → Integrations. Haz clic en "+ Add integration".', tip: null },
      { n: 3, title: 'Busca "Connector API"', body: 'Filtra por "Connector API". Selecciónalo y asígnale el nombre "Revio".', tip: null },
      { n: 4, title: 'Copia las credenciales', body: 'Guarda el Access Token y el Client Token. Ambos son necesarios y solo se muestran una vez.', tip: 'El Client Token identifica el software (Revio). El Access Token identifica tu propiedad.' },
      { n: 5, title: 'Configura en Revio', body: 'En Configuración → Conexiones → Mews, ingresa ambos tokens. Formato: access_token|client_token', tip: null },
    ],
    troubleshooting: [
      { error: 'Invalid token', solution: 'Verifica que estás usando el Access Token Y el Client Token separados por |. Ambos son obligatorios.' },
    ],
    notes: ['Mews no usa Authorization headers — el token va en el body JSON de cada request como "AccessToken" y "ClientToken".'],
  },

  // ══════════════════════════════════════════
  // MENSAJERÍA
  // ══════════════════════════════════════════

  whatsapp: {
    name: 'WhatsApp Business',
    icon: '💬',
    category: 'Mensajería',
    color: '#22c55e',
    status: 'pending_token',
    estimatedTime: '45 min',
    description: 'Canal principal de ventas. El agente de IA responde consultas en tiempo real y cierra reservas por WhatsApp.',
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Access Token', envKey: 'WHATSAPP_TOKEN', example: 'EAABs...longtoken' },
      { label: 'Phone Number ID', envKey: 'WHATSAPP_PHONE_ID', example: 'Tu Phone Number ID de Meta' },
    ],
    steps: [
      {
        n: 1,
        title: 'Accede a Meta Business Manager',
        body: 'Ve a business.facebook.com. Inicia sesión con la cuenta de Facebook asociada a tu empresa. Asegúrate de tener rol de Administrador.',
        tip: 'Para Mística: usa la cuenta asociada a Meta Business ID 764980183700550.',
      },
      {
        n: 2,
        title: 'Crea o selecciona tu Meta App',
        body: 'Ve a developers.facebook.com → My Apps. Si ya tienes una app de WhatsApp Business, selecciónala. Si no, haz clic en "Create App" → tipo "Business" → nombre "Revio - [Tu Propiedad]".',
        tip: null,
      },
      {
        n: 3,
        title: 'Agrega el producto WhatsApp',
        body: 'En el dashboard de tu App, haz clic en "+ Add Product" y selecciona "WhatsApp". Haz clic en "Set Up". Esto abre la sección "WhatsApp → Getting Started".',
        tip: null,
      },
      {
        n: 4,
        title: 'Conecta tu número de WhatsApp Business',
        body: 'En WhatsApp → Configuration → Phone Numbers, haz clic en "Add phone number". Ingresa el número de tu negocio (+57XXXXXXXXX). Verifica con el código SMS que recibirás. El número NO puede estar activo en WhatsApp personal simultáneamente.',
        tip: 'Para Mística: usar el número +573234392420 ya registrado.',
      },
      {
        n: 5,
        title: 'Crea un Usuario de Sistema (token permanente)',
        body: 'En Meta Business Manager → Configuración → Usuarios del sistema → "+ Agregar". Nombre: "revio-bot", Rol: Administrador. Luego haz clic en el usuario creado → "Generar nuevo token" → selecciona tu App → permisos: whatsapp_business_messaging + whatsapp_business_management → duración: Sin expiración.',
        tip: 'Este es el único paso para obtener un token que no expira. NO uses el token temporal de "Getting Started".',
      },
      {
        n: 6,
        title: 'Copia el token y el Phone Number ID',
        body: 'El token generado tiene el formato EAABs... (muy largo). Cópialo completo. El Phone Number ID está en WhatsApp → Getting Started o en la lista de números verificados.',
        tip: 'Encuentra tu Phone Number ID en Meta Business Suite → WhatsApp → Números',
      },
      {
        n: 7,
        title: 'Configura el Webhook',
        body: 'En tu App de Meta → WhatsApp → Configuration → Webhook. Haz clic en "Edit". Callback URL: https://[tu-backend]/api/chat/whatsapp. Verify Token: mystica_webhook_2026. Haz clic en "Verify and Save". Luego suscríbete a: messages, message_deliveries, message_reads.',
        tip: 'El backend debe estar en producción (Railway) para que Meta pueda verificar el webhook.',
      },
      {
        n: 8,
        title: 'Ingresa las credenciales en Revio',
        body: 'En Revio → Configuración → Conexiones → WhatsApp: pega el Access Token y confirma el Phone Number ID. Haz clic en "Probar Conexión".',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'Token expirado / Unauthorized', solution: 'El token temporal de "Getting Started" expira en 24h. Genera siempre un token permanente desde Sistema de Usuarios del Meta Business Manager.' },
      { error: 'Webhook no se verifica', solution: 'El backend debe ser accesible públicamente (Railway en producción). El Verify Token debe coincidir exactamente con WHATSAPP_VERIFY_TOKEN en el .env.' },
      { error: 'Número ya está en uso', solution: 'El número no puede estar activo en WhatsApp personal o WhatsApp Business App. Migra el número a la Cloud API antes de agregarlo.' },
      { error: 'Error 131030 (template required)', solution: 'Las conversaciones iniciadas por el negocio (outbound) requieren templates aprobados. Las respuestas (inbound) no necesitan templates.' },
    ],
    notes: [
      'Verify Token de Revio: mystica_webhook_2026 — usar exactamente este valor.',
      'El token de Sistema de Usuarios (usuario del sistema) NO expira. Es el único método para producción.',
      'WhatsApp cobra por conversación: $0.0147 USD por conversación de servicio (24h window). Las respuestas dentro de la ventana de 24h son gratuitas.',
    ],
  },

  // ══════════════════════════════════════════
  // OTA
  // ══════════════════════════════════════════

  booking: {
    name: 'Booking.com',
    icon: '🏷️',
    category: 'OTA',
    color: '#003580',
    status: 'pending_approval',
    estimatedTime: '2-4 semanas (aprobación)',
    description: 'OTA más grande del mundo. Requiere aplicar como Connectivity Partner — proceso formal de 2-4 semanas.',
    docUrl: 'https://developers.booking.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'API Username', envKey: 'BOOKING_USERNAME', example: 'tu_usuario_booking' },
      { label: 'API Password', envKey: 'BOOKING_PASSWORD', example: '...' },
      { label: 'Hotel ID', envKey: 'BOOKING_HOTEL_ID', example: '12345678' },
    ],
    steps: [
      {
        n: 1,
        title: 'Verifica tus propiedades en Booking Extranet',
        body: 'Ve a admin.booking.com e inicia sesión. Confirma que tus propiedades (Isla Palma y Tayrona) están activas y tienen reservas recientes.',
        tip: null,
      },
      {
        n: 2,
        title: 'Solicita acceso a la Connectivity API',
        body: 'Escribe a: connectivity@booking.com con asunto "Connectivity Partner Application — [Nombre de tu empresa]". Indica que eres un software de gestión (PMS/Channel Manager) que quiere integrarse. Incluye: nombre del software (Revio), número de propiedades, volumen mensual aproximado.',
        tip: 'Booking.com también tiene un formulario en developers.booking.com/partner-hub.',
      },
      {
        n: 3,
        title: 'Proceso de revisión (2-4 semanas)',
        body: 'Booking.com revisará tu solicitud. Te pedirán: documentación legal de la empresa, demo del software, casos de uso específicos. Responde rápido para agilizar el proceso.',
        tip: null,
      },
      {
        n: 4,
        title: 'Acceso al entorno de pruebas',
        body: 'Una vez aprobado, recibirás credenciales para el entorno Sandbox: username (formato: BEtest123456) y password. Puedes hacer pruebas de integración antes de ir a producción.',
        tip: null,
      },
      {
        n: 5,
        title: 'Certificación y producción',
        body: 'Booking.com requiere pasar un proceso de certificación técnica. Una vez aprobada, recibirás credenciales de producción. Agrégalas en Revio → Configuración → Conexiones → Booking.com.',
        tip: null,
      },
      {
        n: 6,
        title: 'Configura el Webhook en Booking Extranet',
        body: 'En admin.booking.com → Property → Settings → Notifications → Channel Manager Notifications. Configura la URL: https://[tu-backend]/api/ota/webhook/booking.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'No hay respuesta al email', solution: 'Usa el formulario web en developers.booking.com. El proceso puede tardar más durante temporadas de alta demanda.' },
    ],
    notes: [
      'Las reservas de Booking.com ya llegan a LobbyPMS (verificado en producción). Esta integración agrega la capacidad de responder automáticamente a consultas.',
      'Proceso realista: aplica hoy, sigue el proceso y tendrás acceso en 3-6 semanas.',
      'Para gestión de reservas existentes, LobbyPMS ya sincroniza con Booking.com automáticamente.',
    ],
  },

  airbnb: {
    name: 'Airbnb',
    icon: '🏠',
    category: 'OTA',
    color: '#ff5a5f',
    status: 'pending_approval',
    estimatedTime: 'iCal: 5 min · API completa: 4-8 semanas',
    description: 'Integración básica vía iCal (inmediata) o completa vía API certificada (requiere aprobación de Airbnb).',
    docUrl: 'https://www.airbnb.com/partner-technical',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'iCal URL (básico)', envKey: 'AIRBNB_ICAL_URL', example: 'https://www.airbnb.com/calendar/ical/XXXXX.ics' },
      { label: 'API Client ID (completo)', envKey: 'AIRBNB_CLIENT_ID', example: 'abc123...' },
    ],
    steps: [
      {
        n: 1,
        title: 'Opción A: iCal (disponible hoy)',
        body: 'En Airbnb → tu listing → Calendar → Export Calendar. Copia la URL .ics. Pégala en Revio → Configuración → Conexiones → Airbnb → "URL de Calendario iCal". Revio sincronizará cada 30 min.',
        tip: 'El iCal permite leer reservas pero NO crear reservas ni responder mensajes automáticamente.',
      },
      {
        n: 2,
        title: 'Opción B: API completa (requiere aplicar)',
        body: 'Ve a airbnb.com/partner-technical. Haz clic en "Apply to become a Software Partner". Completa el formulario con: nombre del software (Revio), tipo (Property Management), número de hosts, volumen de reservas estimado.',
        tip: null,
      },
      {
        n: 3,
        title: 'Demo y revisión por Airbnb',
        body: 'Airbnb revisará tu aplicación y puede pedir una demo del software. Destaca: volumen de hostels, mercado LATAM, capacidad técnica.',
        tip: null,
      },
      {
        n: 4,
        title: 'Certificación técnica',
        body: 'Una vez aprobado, Airbnb te dará acceso a su API sandbox para certificación. Deberás implementar y certificar: reservas, disponibilidad, mensajes.',
        tip: null,
      },
      {
        n: 5,
        title: 'Configura en Revio',
        body: 'Con las credenciales de producción de Airbnb, configúralas en Revio → Configuración → Conexiones → Airbnb.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'iCal no sincroniza', solution: 'Verifica que la URL termina en .ics y es accesible públicamente. Airbnb puede cambiar la URL — regenera en caso de error.' },
    ],
    notes: [
      'iCal es unidireccional (solo lectura). Para cerrar reservas desde Revio, necesitas la API completa.',
      'El proceso de aprobación de Airbnb es más estricto que Booking.com. Requiere volumen demostrable.',
    ],
  },

  // ══════════════════════════════════════════
  // PAGOS
  // ══════════════════════════════════════════

  wompi: {
    name: 'Wompi',
    icon: '💳',
    category: 'Pagos',
    color: '#0ea5e9',
    status: 'connected',
    estimatedTime: '15 min (configuración webhooks)',
    description: 'Pasarela de pagos colombiana. Acepta: tarjetas, PSE, Nequi, Daviplata, Bancolombia. Ambas propiedades de Mística están activas.',
    docUrl: 'https://docs.wompi.co',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Llave Pública Isla Palma', envKey: 'WOMPI_PUBLIC_KEY_ISLA', example: 'pub_prod_S0hgy...' },
      { label: 'Llave Privada Isla Palma', envKey: 'WOMPI_PRIVATE_KEY_ISLA', example: 'prv_prod_aXLd...' },
      { label: 'Llave Pública Tayrona', envKey: 'WOMPI_PUBLIC_KEY_TAYRONA', example: 'pub_prod_Y3Ge...' },
      { label: 'Llave Privada Tayrona', envKey: 'WOMPI_PRIVATE_KEY_TAYRONA', example: 'prv_prod_JgHP...' },
    ],
    steps: [
      {
        n: 1,
        title: 'Crea tu cuenta en Wompi',
        body: 'Ve a comercios.wompi.co y haz clic en "Crear cuenta". Datos necesarios: Nombre completo, NIT de la empresa, correo electrónico, número de celular, cuenta bancaria colombiana (para recibir pagos).',
        tip: null,
      },
      {
        n: 2,
        title: 'Sube documentación de verificación',
        body: 'Wompi requiere: Cámara de Comercio (no mayor a 90 días), Cédula del representante legal, Certificado bancario. El proceso de verificación toma 1-3 días hábiles.',
        tip: null,
      },
      {
        n: 3,
        title: 'Obtén las llaves de producción',
        body: 'Una vez verificada la cuenta, ve al panel de Wompi → Desarrollo → Llaves API. Encontrarás: Llave pública (pub_prod_...) y Llave privada (prv_prod_...). Si tienes múltiples propiedades con diferentes NITs, crea una cuenta por propiedad.',
        tip: 'Para Mística: Isla Palma y Tayrona tienen NITs diferentes, por lo que tienen llaves separadas.',
      },
      {
        n: 4,
        title: 'Configura los webhooks (CRÍTICO)',
        body: 'En Wompi → Configuración → Eventos/Webhooks → "Agregar endpoint". URL: https://[tu-backend]/api/payments/webhook. Eventos a suscribir: transaction.updated. Después de guardar, Wompi mostrará el "Evento Secret" — cópialo.',
        tip: 'Sin el webhook, Revio no sabe cuándo se confirman los pagos.',
      },
      {
        n: 5,
        title: 'Agrega el Webhook Secret al .env',
        body: 'Copia el secret del evento y agrégalo en tu .env como: WOMPI_EVENT_SECRET_ISLA=tu_secret_aqui (y WOMPI_EVENT_SECRET_TAYRONA si tienes dos cuentas).',
        tip: null,
      },
      {
        n: 6,
        title: 'Ingresa las llaves en Revio',
        body: 'En Revio → Configuración → Conexiones → Wompi. Ingresa la llave pública y privada de cada propiedad. Haz clic en "Probar Conexión" — deberías ver el nombre de tu comercio.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'Firma inválida en webhook', solution: 'El Webhook Secret no coincide. Ve a Wompi → Configuración → Eventos y regenera el secret. Actualiza WOMPI_EVENT_SECRET en el .env.' },
      { error: 'Error 401 en transacciones', solution: 'Estás usando la llave privada incorrecta. La llave privada (prv_prod_...) es para el backend. La pública (pub_prod_...) es para el frontend.' },
      { error: 'Cuenta no verificada', solution: 'Wompi puede tardar 1-3 días. Puedes usar el entorno sandbox (pub_test_... / prv_test_...) para pruebas mientras tanto.' },
    ],
    notes: [
      'Comisiones Wompi (2026): Tarjeta crédito 2.9% + $900 COP. PSE: $1.500 COP fijo. Nequi/Daviplata: $900 COP fijo.',
      'Ambas cuentas de Mística están verificadas y activas (confirmado por API el 2026-04-04).',
      'Los pagos se liquidan automáticamente cada 24h en días hábiles a tu cuenta bancaria.',
    ],
  },

  payu: {
    name: 'PayU',
    icon: '💰',
    category: 'Pagos',
    color: '#f59e0b',
    status: 'not_configured',
    estimatedTime: '20 min',
    description: 'Pasarela de pagos LATAM. Alternativa a Wompi para clientes internacionales (USD/EUR).',
    docUrl: 'https://developers.payulatam.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Merchant ID', envKey: 'PAYU_MERCHANT_ID', example: '508029' },
      { label: 'API Key', envKey: 'PAYU_API_KEY', example: '4Vj8eK4...' },
      { label: 'API Login', envKey: 'PAYU_API_LOGIN', example: 'pRRXKOl...' },
    ],
    steps: [
      { n: 1, title: 'Crea cuenta en PayU Colombia', body: 'Ve a colombia.payu.com → "Solicitar integración". Datos: empresa, NIT, cuenta bancaria en COP.', tip: null },
      { n: 2, title: 'Obtén credenciales técnicas', body: 'En tu panel PayU → Configuración → Credenciales técnicas. Copia el Merchant ID, API Key y API Login.', tip: null },
      { n: 3, title: 'Configura en Revio', body: 'En Configuración → Conexiones → PayU, ingresa las tres credenciales.', tip: null },
    ],
    troubleshooting: [],
    notes: ['PayU acepta USD — útil para huéspedes internacionales que pagan en dólares.'],
  },

  // ══════════════════════════════════════════
  // REDES SOCIALES
  // ══════════════════════════════════════════

  instagram: {
    name: 'Instagram Business',
    icon: '📸',
    category: 'Social',
    color: '#ec4899',
    status: 'not_configured',
    estimatedTime: '30 min',
    description: 'Responde DMs y comentarios de Instagram automáticamente. Requiere cuenta Instagram Business vinculada a Facebook Page.',
    docUrl: 'https://developers.facebook.com/docs/instagram-platform',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Instagram Access Token', envKey: 'INSTAGRAM_TOKEN', example: 'EAABs...' },
      { label: 'Instagram Account ID', envKey: 'INSTAGRAM_ACCOUNT_ID', example: '17841400...' },
    ],
    steps: [
      {
        n: 1,
        title: 'Vincula Instagram a tu Facebook Page',
        body: 'En Instagram Business → Editar perfil → Información de contacto → "Conectar a Facebook". Selecciona la Página de Facebook de tu propiedad. Sin esta vinculación, la API no funciona.',
        tip: null,
      },
      {
        n: 2,
        title: 'Accede a Meta for Developers',
        body: 'Ve a developers.facebook.com → My Apps. Usa la misma App que creaste para WhatsApp, o crea una nueva App de tipo "Business".',
        tip: null,
      },
      {
        n: 3,
        title: 'Agrega el producto Instagram',
        body: 'En tu App → "+ Add Product" → "Instagram". Haz clic en "Set Up". Sigue el proceso para conectar tu cuenta de Instagram Business.',
        tip: null,
      },
      {
        n: 4,
        title: 'Obtén el Instagram Account ID',
        body: 'En Graph API Explorer (developers.facebook.com/tools/explorer): selecciona tu App, elige el token de Usuario de Sistema, y ejecuta: GET /me/accounts. Para cada página, ejecuta: GET /{page-id}?fields=instagram_business_account. El ID retornado es tu Instagram Account ID.',
        tip: 'Para Mística: el Meta Business ID es 764980183700550.',
      },
      {
        n: 5,
        title: 'Genera token con permisos de Instagram',
        body: 'En Meta Business Manager → Usuarios del sistema → tu usuario "revio-bot" → "Generar nuevo token" → permisos adicionales: instagram_basic, instagram_manage_messages, instagram_manage_comments, pages_messaging.',
        tip: null,
      },
      {
        n: 6,
        title: 'Configura el webhook',
        body: 'En tu App Meta → Instagram → Webhooks. URL: https://[tu-backend]/api/social/webhook/meta. Verify Token: mystica_webhook_2026. Suscríbete a: messages, comments, messaging_postbacks.',
        tip: null,
      },
      {
        n: 7,
        title: 'Configura en Revio',
        body: 'En Revio → Configuración → Conexiones → Instagram. Ingresa el Access Token y el Instagram Account ID.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'Token no tiene permisos de Instagram', solution: 'Regenera el token desde Sistema de Usuarios incluyendo los permisos instagram_basic e instagram_manage_messages.' },
      { error: 'instagram_business_account no retorna ID', solution: 'La cuenta de Instagram NO está vinculada a la Facebook Page. Ve a Instagram → Editar Perfil → Conectar a Facebook.' },
      { error: 'Messages no llegan al webhook', solution: 'El usuario de Instagram debe tener activadas las notificaciones de mensajes. Ve a Configuración del negocio en Instagram.' },
    ],
    notes: [
      'Puedes usar el mismo Access Token de WhatsApp si le agregaste los permisos de Instagram.',
      'Los DMs de Instagram solo son accesibles si el usuario inicia la conversación (política de Meta para cuentas sin verificación avanzada).',
    ],
  },

  facebook: {
    name: 'Facebook Messenger',
    icon: '📘',
    category: 'Social',
    color: '#1877f2',
    status: 'not_configured',
    estimatedTime: '25 min',
    description: 'Responde mensajes de Facebook Messenger automáticamente. Mismo App de Meta que WhatsApp/Instagram.',
    docUrl: 'https://developers.facebook.com/docs/messenger-platform',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Page Access Token', envKey: 'FACEBOOK_PAGE_TOKEN', example: 'EAABs...' },
      { label: 'Page ID', envKey: 'FACEBOOK_PAGE_ID', example: '123456789' },
    ],
    steps: [
      {
        n: 1,
        title: 'Accede a Meta for Developers',
        body: 'Ve a developers.facebook.com → My Apps. Selecciona la App que ya usas para WhatsApp.',
        tip: null,
      },
      {
        n: 2,
        title: 'Agrega Messenger como producto',
        body: 'En tu App → "+ Add Product" → "Messenger" → "Set Up". Esto no afecta WhatsApp.',
        tip: null,
      },
      {
        n: 3,
        title: 'Selecciona tu Facebook Page',
        body: 'En Messenger → Settings → Access Tokens, haz clic en "Add or Remove Pages". Selecciona la Página de Facebook de tu propiedad.',
        tip: null,
      },
      {
        n: 4,
        title: 'Obtén el Page Access Token',
        body: 'En Graph API Explorer, ejecuta: GET /me/accounts → busca tu página → copia el "access_token" de la lista. Para que sea permanente, necesitas generarlo desde Sistema de Usuarios.',
        tip: null,
      },
      {
        n: 5,
        title: 'Obtén el Page ID',
        body: 'En la lista de /me/accounts, el "id" de tu página es el Page ID. También lo encuentras en la URL de tu página de Facebook.',
        tip: null,
      },
      {
        n: 6,
        title: 'Configura el webhook',
        body: 'En Messenger → Settings → Webhooks. URL: https://[tu-backend]/api/social/webhook/meta. Verify Token: mystica_webhook_2026. Suscríbete a: messages, messaging_postbacks, messaging_deliveries.',
        tip: null,
      },
      {
        n: 7,
        title: 'Pega en Revio',
        body: 'En Revio → Configuración → Conexiones → Facebook. Ingresa el Page Access Token y el Page ID.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'Messenger no está en producción', solution: 'Para recibir mensajes de usuarios reales, la App debe estar en modo "Live". Ve a App Review → Permissions y solicita los permisos pages_messaging para revisión.' },
      { error: 'Token de página expira', solution: 'Los tokens de página de usuario expiran. Genera siempre el token desde Sistema de Usuarios para obtener tokens sin expiración.' },
    ],
    notes: [
      'Puedes usar el mismo App de Meta para WhatsApp, Instagram y Facebook simultáneamente.',
      'Webhook URL para todos los canales Meta: /api/social/webhook/meta (el backend distingue el canal por el payload).',
    ],
  },

  google_business: {
    name: 'Google Business',
    icon: '🔍',
    category: 'Social',
    color: '#ea4335',
    status: 'not_configured',
    estimatedTime: '1-2 horas',
    description: 'Monitorea y responde reseñas de Google Maps. Gestiona Q&A y actualizaciones del perfil de negocio.',
    docUrl: 'https://developers.google.com/my-business/reference/rest',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Google API Key', envKey: 'GOOGLE_API_KEY', example: 'AIzaSy...' },
      { label: 'Business Account ID', envKey: 'GOOGLE_BUSINESS_ACCOUNT_ID', example: 'accounts/123456789' },
      { label: 'Location ID', envKey: 'GOOGLE_LOCATION_ID', example: 'locations/123456789' },
    ],
    steps: [
      {
        n: 1,
        title: 'Verifica tu negocio en Google',
        body: 'Ve a business.google.com. Si tu propiedad aún no está verificada, haz clic en "Agregar negocio" o busca el existente. La verificación puede ser por: tarjeta postal (10-14 días), videollamada (instantáneo para negocios elegibles), o código por teléfono.',
        tip: null,
      },
      {
        n: 2,
        title: 'Crea un proyecto en Google Cloud Console',
        body: 'Ve a console.cloud.google.com → "Nuevo proyecto" → pon un nombre descriptivo. Habilita facturación (necesario para la API aunque sea gratuita en este nivel).',
        tip: null,
      },
      {
        n: 3,
        title: 'Habilita las APIs necesarias',
        body: 'En tu proyecto de Cloud Console → APIs y servicios → Biblioteca. Busca y habilita: "Business Profile API" (antes llamada Google My Business API) y "Places API".',
        tip: null,
      },
      {
        n: 4,
        title: 'Crea credenciales OAuth 2.0',
        body: 'APIs y servicios → Credenciales → "+ Crear credenciales" → "ID de cliente de OAuth". Tipo: Aplicación Web. URI de redirección: https://[tu-backend]/oauth/google. Descarga el JSON con las credenciales.',
        tip: null,
      },
      {
        n: 5,
        title: 'Obtén el Account ID y Location ID',
        body: 'Llama a la API: GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts (con tu token OAuth). El ID retornado es tu Account ID. Luego: GET /v1/{accountId}/locations para obtener el Location ID de cada propiedad.',
        tip: null,
      },
      {
        n: 6,
        title: 'Configura en Revio',
        body: 'En Revio → Configuración → Conexiones → Google Business. Ingresa el Account ID, Location ID y las credenciales OAuth.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'API not enabled', solution: 'Ve a Google Cloud Console → APIs y servicios y habilita específicamente "Business Profile API".' },
      { error: 'Insufficient permissions', solution: 'El usuario OAuth debe ser Owner o Manager del Google Business Profile, no solo un usuario básico.' },
    ],
    notes: [
      'Google Business API es gratuita pero tiene cuotas: 5 solicitudes/segundo por propiedad.',
      'Para responder reseñas automáticamente, la cuenta debe tener el permiso "Manage reviews" activado en Business Profile.',
    ],
  },

  // ══════════════════════════════════════════
  // REVIEWS
  // ══════════════════════════════════════════

  tripadvisor: {
    name: 'TripAdvisor',
    icon: '🦉',
    category: 'Reviews',
    color: '#34d399',
    status: 'pending_approval',
    estimatedTime: '1-2 semanas (aprobación)',
    description: 'Monitorea y responde reseñas de TripAdvisor. Requiere ser propietario verificado de la propiedad.',
    docUrl: 'https://developer-tripadvisor.com/home/',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'API Key', envKey: 'TRIPADVISOR_API_KEY', example: 'ta_api_...' },
      { label: 'Location ID', envKey: 'TRIPADVISOR_LOCATION_ID', example: '12345678' },
    ],
    steps: [
      {
        n: 1,
        title: 'Reclama tu propiedad en TripAdvisor',
        body: 'Ve a tripadvisor.com/owners. Busca tu propiedad y haz clic en "¿Eres el dueño?". Verifica la propiedad con los documentos requeridos.',
        tip: null,
      },
      {
        n: 2,
        title: 'Solicita acceso a la Management API',
        body: 'Ve a developer-tripadvisor.com/home → "Apply for API Access". Selecciona "Review Management API". Describe tu software (Revio) y casos de uso.',
        tip: null,
      },
      {
        n: 3,
        title: 'Obtén el Location ID',
        body: 'El Location ID de tu propiedad está en la URL de TripAdvisor: tripadvisor.com/Hotel_Review-dXXXXXXX (el número después de -d es el Location ID).',
        tip: null,
      },
      {
        n: 4,
        title: 'Genera tu API Key',
        body: 'Una vez aprobado, recibirás tu API Key en el portal de desarrolladores. Tiene el formato ta_api_XXXXX.',
        tip: null,
      },
      {
        n: 5,
        title: 'Configura en Revio',
        body: 'En Revio → Configuración → Conexiones → TripAdvisor. Ingresa la API Key y el Location ID.',
        tip: null,
      },
    ],
    troubleshooting: [
      { error: 'API Access denied', solution: 'TripAdvisor es estricto con quién accede a la API de gestión. Asegúrate de ser el propietario reclamado de la propiedad.' },
    ],
    notes: [
      'TripAdvisor tiene API pública (datos de reviews, sin gestión) y API de Management (responder reviews — requiere aprobación).',
      'La API pública te permite leer reviews sin aprobación usando solo el Location ID.',
    ],
  },

  // ══════════════════════════════════════════
  // IA
  // ══════════════════════════════════════════

  claude: {
    name: 'Claude / Motor IA (Revio)',
    icon: '🤖',
    category: 'IA',
    color: '#8b5cf6',
    status: 'connected',
    estimatedTime: '5 min',
    description: 'Motor de IA principal de Revio. Por defecto usa la llave compartida de Revio (incluida en el plan). Opcional: usa tu propia llave para control total del gasto.',
    docUrl: 'https://console.anthropic.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [
      { label: 'Anthropic API Key (opcional)', envKey: 'ANTHROPIC_API_KEY', example: 'sk-ant-api03-...' },
    ],
    steps: [
      { n: 1, title: 'Crea una cuenta Anthropic', body: 'Ve a console.anthropic.com y crea una cuenta con tu email.', tip: null },
      { n: 2, title: 'Agrega método de pago', body: 'En Billing → Add payment method. Anthropic cobra por tokens usados. El modelo recomendado (Claude Sonnet) cuesta ~$3 USD / 1M tokens.', tip: null },
      { n: 3, title: 'Genera una API Key', body: 'Ve a API Keys → Create Key. Nombre: "Revio [Tu Hotel]". Copia la clave (sk-ant-api03-...).', tip: null },
      { n: 4, title: 'Configura en Revio', body: 'Ve a Configuración → Agente IA → Proveedor. Selecciona "Claude Sonnet" y pega tu API key. Sin tu propia key, el agente usa la llave compartida de Revio (incluida en el plan).', tip: null },
    ],
    troubleshooting: [
      { error: 'Overloaded / 529', solution: 'Anthropic está con alta demanda. Revio reintenta automáticamente. Si persiste, contacta a support@anthropic.com.' },
      { error: 'Insufficient credits', solution: 'Recarga créditos en console.anthropic.com → Billing → Add credits.' },
    ],
    notes: ['Sin tu propia key, el agente usa la llave compartida de Revio (incluida en el plan). La llave propia es solo para control de costos.'],
  },

  openai: {
    name: 'OpenAI (GPT-4o)',
    icon: '🧠',
    category: 'IA',
    color: '#22c55e',
    status: 'not_configured',
    estimatedTime: '5 min',
    description: 'Modelo GPT-4o de OpenAI como alternativa al motor IA de Revio.',
    docUrl: 'https://platform.openai.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [{ label: 'OpenAI API Key', envKey: 'OPENAI_API_KEY', example: 'sk-proj-...' }],
    steps: [
      { n: 1, title: 'Crea cuenta en OpenAI Platform', body: 'Ve a platform.openai.com y regístrate o inicia sesión.', tip: null },
      { n: 2, title: 'Agrega créditos', body: 'En Billing → Add payment method. GPT-4o cuesta ~$5 USD / 1M tokens de entrada, $15 USD / 1M de salida.', tip: null },
      { n: 3, title: 'Genera API Key', body: 'API Keys → Create new secret key. Nombre: "Revio". Copia la clave (sk-proj-...).', tip: null },
      { n: 4, title: 'Configura en Revio', body: 'Configuración → Agente IA → Proveedor → GPT-4o. Pega tu API key.', tip: null },
    ],
    troubleshooting: [],
    notes: [],
  },

  gemini: {
    name: 'Gemini (Google)',
    icon: '✨',
    category: 'IA',
    color: '#f59e0b',
    status: 'not_configured',
    estimatedTime: '10 min',
    description: 'Gemini 1.5 Pro de Google. Excelente para contextos muy largos (1M tokens).',
    docUrl: 'https://aistudio.google.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [{ label: 'Google AI API Key', envKey: 'GEMINI_API_KEY', example: 'AIzaSy...' }],
    steps: [
      { n: 1, title: 'Accede a Google AI Studio', body: 'Ve a aistudio.google.com con tu cuenta de Google.', tip: null },
      { n: 2, title: 'Crea una API Key', body: '"Get API Key" → "Create API Key in new project". La clave comienza con AIza...', tip: null },
      { n: 3, title: 'Habilita la API', body: 'En Google Cloud Console, habilita "Generative Language API" para tu proyecto.', tip: null },
      { n: 4, title: 'Configura en Revio', body: 'Configuración → Agente IA → Gemini. Pega tu API key.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Gemini tiene tier gratuito generoso: 15 requests/min. Ideal para volumen bajo.'],
  },

  groq: {
    name: 'Groq (Llama 3)',
    icon: '🦙',
    category: 'IA',
    color: '#ef4444',
    status: 'not_configured',
    estimatedTime: '5 min',
    description: 'Llama 3 de Meta en hardware Groq. Ultra rápido (tokens/seg 10x más rápido que Claude/GPT). Muy económico.',
    docUrl: 'https://console.groq.com',
    videoUrl: null,
    mysticaNote: null,
    credentials: [{ label: 'Groq API Key', envKey: 'GROQ_API_KEY', example: 'gsk_...' }],
    steps: [
      { n: 1, title: 'Crea cuenta en Groq Cloud', body: 'Ve a console.groq.com y regístrate.', tip: null },
      { n: 2, title: 'Genera API Key', body: 'API Keys → Create API Key. La clave comienza con gsk_...', tip: null },
      { n: 3, title: 'Configura en Revio', body: 'Configuración → Agente IA → Llama 3 (Groq). Pega tu key.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Tier gratuito: 14.400 requests/día. Ideal para tests. Velocidad de respuesta 2-3x más rápida que Claude.'],
  },

  // ─── Payment alternativos ──────────────────────────────────
  mercado_pago: {
    name: 'Mercado Pago',
    icon: '🛒',
    category: 'Pagos',
    color: '#00b1ea',
    status: 'not_configured',
    estimatedTime: '8 min',
    description: 'Procesador de pagos líder en LATAM. Ideal para clientes de Argentina, México, Brasil y Chile.',
    docUrl: 'https://www.mercadopago.com.co/developers',
    videoUrl: null,
    credentials: [
      { label: 'Access Token', envKey: 'MP_ACCESS_TOKEN', example: 'APP_USR-...' },
      { label: 'Public Key',   envKey: 'MP_PUBLIC_KEY',   example: 'APP_USR-...' },
    ],
    steps: [
      { n: 1, title: 'Inicia sesión en Mercado Pago', body: 'Ve a mercadopago.com.co y entra a tu cuenta.', tip: null },
      { n: 2, title: 'Tu negocio → Configuración',   body: 'Haz clic en "Tu negocio" → "Configuración" → "Gestión y administración".', tip: null },
      { n: 3, title: 'Credenciales',                  body: 'Busca la sección "Credenciales" y haz clic.', tip: null },
      { n: 4, title: 'Activar producción',            body: 'Haz clic en "Activar credenciales de producción".', tip: null },
      { n: 5, title: 'Copia Access Token',            body: 'Empieza con APP_USR-', tip: null },
      { n: 6, title: 'Copia Public Key',              body: 'Empieza con APP_USR-', tip: null },
      { n: 7, title: 'Pega aquí y guarda',            body: 'Pega los 2 valores en los campos correspondientes.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Disponible en Colombia, México, Brasil, Argentina, Chile, Perú, Uruguay.'],
  },

  stripe: {
    name: 'Stripe',
    icon: '💰',
    category: 'Pagos',
    color: '#635bff',
    status: 'not_configured',
    estimatedTime: '5 min',
    description: 'Procesador de pagos global. Ideal para cobros internacionales en USD y EUR.',
    docUrl: 'https://dashboard.stripe.com/apikeys',
    videoUrl: null,
    credentials: [
      { label: 'Publishable Key', envKey: 'STRIPE_PK', example: 'pk_live_...' },
      { label: 'Secret Key',      envKey: 'STRIPE_SK', example: 'sk_live_...' },
    ],
    steps: [
      { n: 1, title: 'Abre Stripe Dashboard',   body: 'Ve a dashboard.stripe.com y entra a tu cuenta.', tip: null },
      { n: 2, title: 'Developers → API keys',   body: 'En el menú izquierdo haz clic en "Developers" → "API keys".', tip: null },
      { n: 3, title: 'Publishable key',          body: 'Verás la "Publishable key" que empieza con pk_live_... cópiala.', tip: null },
      { n: 4, title: 'Secret key',               body: 'Haz clic en "Reveal live key" para ver el Secret key (sk_live_...). Cópiala.', tip: null },
      { n: 5, title: 'Pega en Revio',            body: 'Pega ambas claves en los campos aquí y guarda.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Stripe funciona en más de 40 países. Ideal para cobros internacionales.'],
  },

  // ─── OTA iCal aliases (reutilizan las guías base) ──────────
  booking_ical: {
    name: 'Booking.com (iCal)',
    icon: '📅',
    category: 'OTA',
    color: '#003580',
    estimatedTime: '5 min',
    description: 'Sincronización unidireccional vía enlace iCal exportado desde Booking.com.',
    docUrl: 'https://extranet.booking.com',
    credentials: [{ label: 'URL iCal', envKey: '', example: 'https://admin.booking.com/hotel/hoteladmin/ical.html?...' }],
    steps: [
      { n: 1, title: 'Abre Booking Extranet',       body: 'Ve a extranet.booking.com e inicia sesión.', tip: null },
      { n: 2, title: 'Calendario',                   body: 'Ve a "Calendario" en el menú superior.', tip: null },
      { n: 3, title: 'Exportar calendario',           body: 'Haz clic en "Exportar" o busca "Sincronizar calendario".', tip: null },
      { n: 4, title: 'Copia la URL iCal',             body: 'Verás una URL que empieza con https://admin.booking.com/hotel/hoteladmin/ical...', tip: null },
      { n: 5, title: 'Pega en Revio',                 body: 'Pégala en el campo "URL iCal" aquí. Revio sincroniza cada 15 min.', tip: null },
    ],
    troubleshooting: [],
    notes: ['La URL iCal es pública — no la compartas en lugares abiertos.'],
  },

  airbnb_ical: {
    name: 'Airbnb (iCal)',
    icon: '🏠',
    category: 'OTA',
    color: '#ff5a5f',
    estimatedTime: '3 min',
    description: 'Sincronización unidireccional vía enlace iCal exportado desde Airbnb.',
    docUrl: 'https://airbnb.com/hosting',
    credentials: [{ label: 'URL iCal', envKey: '', example: 'https://www.airbnb.com/calendar/ical/...' }],
    steps: [
      { n: 1, title: 'Inicia sesión en Airbnb',       body: 'Ve a airbnb.com y entra a tu cuenta de anfitrión.', tip: null },
      { n: 2, title: 'Anuncio → tu propiedad',         body: 'Haz clic en "Anuncio" y selecciona tu propiedad.', tip: null },
      { n: 3, title: 'Calendario → Disponibilidad',    body: 'Ve a "Calendario" → "Disponibilidad".', tip: null },
      { n: 4, title: 'Exportar calendario',             body: 'Busca el botón "Exportar calendario".', tip: null },
      { n: 5, title: 'Copia la URL',                    body: 'La URL empieza con https://www.airbnb.com/calendar/ical/...', tip: null },
      { n: 6, title: 'Pega en Revio',                   body: 'Pégala aquí y guarda.', tip: null },
    ],
    troubleshooting: [],
    notes: [],
  },

  hostelworld_ical: {
    name: 'Hostelworld (iCal)',
    icon: '🌍',
    category: 'OTA',
    color: '#fdb913',
    estimatedTime: '5 min',
    description: 'Sincronización iCal desde el panel de socio de Hostelworld.',
    docUrl: 'https://www.hostelworld.com/partner',
    credentials: [{ label: 'URL iCal', envKey: '', example: 'https://...' }],
    steps: [
      { n: 1, title: 'Hostelworld Partner',      body: 'Ve a hostelworld.com/partner o pms.hostelworld.com e inicia sesión.', tip: null },
      { n: 2, title: 'Availability & Rates',      body: 'Ve a "Availability & Rates" o "Calendar".', tip: null },
      { n: 3, title: 'Export / iCal sync',        body: 'Busca la opción "Export" o "iCal sync".', tip: null },
      { n: 4, title: 'Copia la URL',              body: 'Copia la URL del iCal.', tip: null },
      { n: 5, title: 'Pega en Revio',             body: 'Pégala aquí y guarda.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Si no encuentras la opción, contacta al soporte de Hostelworld.'],
  },

  expedia_ical: {
    name: 'Expedia (iCal)',
    icon: '🗺️',
    category: 'OTA',
    color: '#fec515',
    estimatedTime: '5 min',
    description: 'Sincronización iCal desde Expedia Partner Central.',
    docUrl: 'https://partner.expediagroup.com',
    credentials: [{ label: 'URL iCal', envKey: '', example: 'https://...' }],
    steps: [
      { n: 1, title: 'Abre Partner Central',  body: 'Ve a partner.expediagroup.com e inicia sesión.', tip: null },
      { n: 2, title: 'Calendar',               body: 'Ve a "Calendar" o "Availability".', tip: null },
      { n: 3, title: 'Export Calendar',        body: 'Busca "Export Calendar" o "iCal".', tip: null },
      { n: 4, title: 'Copia la URL',           body: 'Copia la URL que aparece.', tip: null },
      { n: 5, title: 'Pega en Revio',          body: 'Pégala aquí y guarda.', tip: null },
    ],
    troubleshooting: [],
    notes: ['Si no ves la opción, ve a "Help" y busca "iCal export".'],
  },

  despegar_ical: {
    name: 'Despegar',
    icon: '🛫',
    category: 'OTA',
    color: '#7c3aed',
    estimatedTime: '10 min',
    description: 'Publicación y gestión de disponibilidad en Despegar.',
    docUrl: 'https://partners.despegar.com',
    credentials: [{ label: 'URL iCal', envKey: '', example: 'https://...' }],
    steps: [
      { n: 1, title: 'Despegar Partners',   body: 'Ve a partners.despegar.com e inicia sesión o regístrate.', tip: null },
      { n: 2, title: 'Aprobación',           body: 'Espera a ser aprobado como proveedor de alojamiento.', tip: null },
      { n: 3, title: 'Mi propiedad',         body: 'Ve a "Mi propiedad" → "Calendario".', tip: null },
      { n: 4, title: 'Exportar iCal',        body: 'Busca la opción de exportar o sincronizar iCal.', tip: null },
      { n: 5, title: 'Pega en Revio',        body: 'Copia la URL y pégala aquí.', tip: null },
    ],
    troubleshooting: [],
    notes: ['El proceso de aprobación puede tomar varios días.'],
  },
};

// ─── Componentes UI ───────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      title="Copiar"
      style={{ padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: copied ? 'var(--success, #10b981)' : 'var(--text-3)' }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.not_configured;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function TroubleshootingSection({ items }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: 'var(--text-2)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
          Solución de problemas comunes
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 12,
              background: 'color-mix(in srgb, #ef4444 5%, transparent)',
              border: '1px solid color-mix(in srgb, #ef4444 15%, transparent)',
            }}>
              <p style={{ fontWeight: 600, color: '#ef4444', marginBottom: 3 }}>🔴 {item.error}</p>
              <p style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>→ {item.solution}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function IntegrationGuide({ integrationId, onClose }) {
  const guide = GUIDES[integrationId];
  if (!guide) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 620, maxHeight: '92vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, fontSize: 21,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: `color-mix(in srgb, ${guide.color} 14%, transparent)`,
            }}>{guide.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{guide.name}</h2>
                <StatusBadge status={guide.status} />
                {guide.estimatedTime && (
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock className="w-3 h-3" /> {guide.estimatedTime}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
                {guide.category} · {guide.description}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '16px 22px', flex: 1 }}>

          {/* Mística status banner */}
          {guide.mysticaNote && (
            <div style={{
              padding: '10px 13px', borderRadius: 10, marginBottom: 16,
              background: guide.status === 'connected'
                ? 'color-mix(in srgb, #10b981 8%, transparent)'
                : 'color-mix(in srgb, #f59e0b 8%, transparent)',
              border: `1px solid ${guide.status === 'connected' ? 'color-mix(in srgb, #10b981 25%, transparent)' : 'color-mix(in srgb, #f59e0b 25%, transparent)'}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: guide.status === 'connected' ? '#10b981' : '#f59e0b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {guide.status === 'connected' ? '✅ Estado Mística' : '⚠️ Estado Mística'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{guide.mysticaNote}</p>
            </div>
          )}

          {/* Credentials needed */}
          {guide.credentials && guide.credentials.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Credenciales necesarias
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {guide.credentials.map((cred, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8,
                    background: 'var(--card)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{cred.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8, fontFamily: 'monospace' }}>{cred.envKey}</span>
                    </div>
                    <code style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace', opacity: 0.7 }}>{cred.example}</code>
                    <CopyButton text={cred.envKey} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Paso a paso
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {guide.steps.map((step) => (
                <div key={step.n} style={{ display: 'flex', gap: 11 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: `color-mix(in srgb, ${guide.color} 15%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: guide.color,
                  }}>{step.n}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{step.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
                    {step.tip && (
                      <p style={{ fontSize: 11, color: guide.color, marginTop: 4, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <span style={{ flexShrink: 0 }}>💡</span> {step.tip}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting */}
          <TroubleshootingSection items={guide.troubleshooting} />

          {/* Notes */}
          {guide.notes && guide.notes.length > 0 && (
            <div style={{
              padding: '11px 13px', borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent, #0ea5e9) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent, #0ea5e9) 18%, transparent)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #0ea5e9)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Notas
              </p>
              {guide.notes.map((note, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 2px' }}>• {note}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '11px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {guide.docUrl ? (
            <a href={guide.docUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--accent, #0ea5e9)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <ExternalLink className="w-3.5 h-3.5" /> Documentación oficial
            </a>
          ) : <div />}
          <button onClick={onClose} className="rv-btn-primary px-4 py-1.5 text-xs">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

export function useIntegrationGuide() {
  const [open, setOpen] = useState(null);
  const openGuide = (id) => setOpen(id);
  const closeGuide = () => setOpen(null);
  const GuideModal = open ? <IntegrationGuide integrationId={open} onClose={closeGuide} /> : null;
  return { openGuide, GuideModal };
}

export default IntegrationGuide;
