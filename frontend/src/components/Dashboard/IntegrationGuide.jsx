/**
 * IntegrationGuide — Modal con instrucciones paso a paso para cada integración
 * Uso: <IntegrationGuide integrationId="lobbypms" onClose={() => ...} />
 */
import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Play, ChevronRight } from 'lucide-react';

const GUIDES = {
  lobbypms: {
    name: 'LobbyPMS',
    icon: '🏨',
    category: 'PMS',
    color: '#0ea5e9',
    description: 'Sistema de gestión hotelera para LATAM. Revio consulta disponibilidad y crea reservas en tiempo real.',
    docUrl: 'https://docs.lobbypms.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Accede a tu cuenta LobbyPMS', body: 'Ingresa en app.lobbypms.com con tu cuenta de administrador.' },
      { n: 2, title: 'Ve a Configuración → API', body: 'En el menú lateral, busca Configuración > Integraciones > API Tokens.' },
      { n: 3, title: 'Genera un nuevo token', body: 'Haz clic en "Nuevo Token". Nómbralo "Revio" y dale permisos de lectura en Disponibilidad y escritura en Reservas.' },
      { n: 4, title: 'Copia el token', body: 'El token solo se muestra una vez. Cópialo inmediatamente antes de cerrar el modal.' },
      { n: 5, title: 'Whitelist de IP (crítico)', body: 'En LobbyPMS, ve a API > Seguridad > IPs permitidas. Agrega la IP de tu servidor Revio. Sin este paso, recibirás error 403.' },
      { n: 6, title: 'Pega en Revio', body: 'Ve a Configuración > Conexiones > LobbyPMS. Pega el token en el campo "API Token" y presiona Probar.' },
    ],
    notes: ['La IP del servidor Railway se asigna dinámicamente — puede cambiar en cada deploy. Configura la IP después de hacer deploy en producción.'],
  },

  cloudbeds: {
    name: 'Cloudbeds',
    icon: '☁️',
    category: 'PMS',
    color: '#6366f1',
    description: 'PMS cloud con presencia global. Integración vía OAuth2 con API REST v1.2.',
    docUrl: 'https://hotels.cloudbeds.com/api/v1.2/',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Ingresa a Cloudbeds', body: 'Accede a app.cloudbeds.com con tu cuenta de administrador.' },
      { n: 2, title: 'Ve a Apps & Marketplace', body: 'En el menú superior, busca "Apps" o "Marketplace".' },
      { n: 3, title: 'Busca "API Access"', body: 'Filtra por "Developer" o busca "API Access" para generar credenciales OAuth2.' },
      { n: 4, title: 'Crea una aplicación OAuth', body: 'Nombre: "Revio Integration". Redirect URL: https://api.revio.co/oauth/cloudbeds. Permisos: read:reservations, write:reservations, read:availability.' },
      { n: 5, title: 'Obtén el Access Token', body: 'Completa el flujo OAuth2. El token resultante (cb_oauth_...) es el que necesitas.' },
      { n: 6, title: 'Configura en Revio', body: 'Pega el token en Configuración > Conexiones > Cloudbeds y guarda.' },
    ],
    notes: ['Los tokens OAuth de Cloudbeds expiran. Revio renovará automáticamente usando el refresh token.'],
  },

  mews: {
    name: 'Mews',
    icon: '🌐',
    category: 'PMS',
    color: '#8b5cf6',
    description: 'PMS moderno con Connector API. Autenticación por token en el body de cada request.',
    docUrl: 'https://mews-systems.gitbook.io/connector-api/',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Accede a Mews Commander', body: 'Ingresa a app.mews.com como administrador de la propiedad.' },
      { n: 2, title: 'Ve a Settings → Integrations', body: 'Busca la sección de integraciones de terceros.' },
      { n: 3, title: 'Agrega "Connector API"', body: 'Crea una nueva integración de tipo Connector. Asígnale el nombre "Revio".' },
      { n: 4, title: 'Copia las credenciales', body: 'Obtén el Access Token y el Client Token generados. Ambos son necesarios.' },
      { n: 5, title: 'Pega en Revio', body: 'En Configuración > Conexiones > Mews, ingresa ambos tokens separados por un signo "|": access_token|client_token' },
    ],
    notes: ['Mews no usa headers de Authorization — el token va en el body JSON de cada request.'],
  },

  whatsapp: {
    name: 'WhatsApp Business',
    icon: '💬',
    category: 'Mensajería',
    color: '#22c55e',
    description: 'Canal principal de comunicación con huéspedes. Requiere cuenta Meta Business verificada.',
    docUrl: 'https://developers.facebook.com/docs/whatsapp',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea una cuenta Meta Business', body: 'Ve a business.facebook.com y verifica tu empresa con documentos legales.' },
      { n: 2, title: 'Accede a Meta for Developers', body: 'En developers.facebook.com, crea una nueva App de tipo "Business".' },
      { n: 3, title: 'Agrega WhatsApp al App', body: 'En el dashboard de tu App, haz clic en "Add Product" y selecciona "WhatsApp".' },
      { n: 4, title: 'Obtén el Access Token', body: 'En WhatsApp > Getting Started, copia el "Temporary access token". Para producción, genera un token permanente en System Users.' },
      { n: 5, title: 'Copia el Phone Number ID', body: 'En la misma sección, copia el "Phone Number ID" del número de prueba o el tuyo verificado.' },
      { n: 6, title: 'Configura el Webhook', body: 'En WhatsApp > Configuration > Webhook, ingresa: URL: https://api.revio.co/api/chat/whatsapp, Verify Token: mystica_webhook_2026. Suscribe a: messages.' },
      { n: 7, title: 'Ingresa en Revio', body: 'Ve a Configuración > Conexiones > WhatsApp. Ingresa el Access Token y el Phone Number ID.' },
    ],
    notes: ['Para producción, necesitas un número de teléfono verificado con Meta (puede tomar 1-3 días).', 'El Verify Token en Revio es: mystica_webhook_2026'],
  },

  booking: {
    name: 'Booking.com',
    icon: '🏷️',
    category: 'OTA',
    color: '#0ea5e9',
    description: 'Integración con la OTA más grande del mundo vía XML/JSON API. Requiere acuerdo de partnership.',
    docUrl: 'https://developers.booking.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Contacta a Booking.com', body: 'Escribe a partner-connectivity@booking.com o contáctanos para gestionar el acceso.' },
      { n: 2, title: 'Obtén las credenciales XML', body: 'Booking.com te proporcionará un username y password para su API XML.' },
      { n: 3, title: 'Configura el webhook', body: 'En el Extranet de Booking, ve a Property > Settings > Notifications. Configura la URL del webhook de Revio.' },
      { n: 4, title: 'Ingresa en Revio', body: 'Ve a Configuración > Conexiones > Booking.com. Ingresa username y password.' },
    ],
    notes: ['Booking.com tiene un proceso de verificación que puede tomar 2-4 semanas.'],
  },

  airbnb: {
    name: 'Airbnb',
    icon: '🏠',
    category: 'OTA',
    color: '#ef4444',
    description: 'Integración con Airbnb. Disponible vía iCal (inmediato) o API certificada (requiere aprobación).',
    docUrl: 'https://airbnb.com/partner-technical',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Exporta el calendario iCal', body: 'En Airbnb, ve a tu listing > Calendar > Export Calendar. Copia la URL .ics.' },
      { n: 2, title: 'Pega la URL en Revio', body: 'Ve a Configuración > Conexiones > Airbnb. Pega la URL del iCal. Revio sincronizará cada 30 minutos.' },
      { n: 3, title: 'API completa (opcional)', body: 'Para integración completa, aplica en airbnb.com/partner-technical como software de gestión.' },
    ],
    notes: ['La sincronización por iCal es unidireccional — Revio lee las reservas pero no puede crearlas en Airbnb.'],
  },

  wompi: {
    name: 'Wompi',
    icon: '💳',
    category: 'Pagos',
    color: '#0ea5e9',
    description: 'Pasarela de pagos colombiana. Recibe tarjetas, PSE, Nequi, Daviplata y más.',
    docUrl: 'https://docs.wompi.co',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea una cuenta Wompi', body: 'Regístrate en comercios.wompi.co como comercio. Necesitas: cédula/NIT, cuenta bancaria colombiana.' },
      { n: 2, title: 'Espera la verificación', body: 'Wompi verifica tu cuenta en 1-3 días hábiles.' },
      { n: 3, title: 'Obtén las llaves de producción', body: 'En el panel de Wompi, ve a Desarrollo > Llaves. Copia la llave pública (pub_prod_...) y privada (prv_prod_...).' },
      { n: 4, title: 'Configura el webhook', body: 'En Wompi, ve a Configuración > Eventos. URL: https://api.revio.co/api/payments/webhook. Eventos: transaction.updated.' },
      { n: 5, title: 'Ingresa en Revio', body: 'Ve a Configuración > Conexiones > Wompi. Ingresa las llaves pública y privada.' },
    ],
    notes: ['Wompi cobra comisión por transacción: 2.9% + $900 COP para tarjetas. PSE: $1.500 COP fijo.'],
  },

  payu: {
    name: 'PayU',
    icon: '💰',
    category: 'Pagos',
    color: '#f59e0b',
    description: 'Pasarela de pagos con cobertura en LATAM. Alternativa a Wompi para mercados internacionales.',
    docUrl: 'https://developers.payulatam.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea cuenta PayU', body: 'Ve a colombia.payu.com y crea una cuenta de comercio.' },
      { n: 2, title: 'Obtén credenciales', body: 'En el panel de PayU, ve a Configuración > Credenciales técnicas. Copia el Merchant ID, API Key y API Login.' },
      { n: 3, title: 'Configura en Revio', body: 'En Configuración > Conexiones > PayU, ingresa las credenciales.' },
    ],
    notes: ['PayU es recomendado para clientes internacionales que pagan en USD.'],
  },

  claude: {
    name: 'Claude / Motor IA',
    icon: '🤖',
    category: 'IA',
    color: '#8b5cf6',
    description: 'Motor de inteligencia artificial de Revio. Proporciona tu propia clave API para control total del gasto.',
    docUrl: 'https://console.anthropic.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea una cuenta Anthropic', body: 'Ve a console.anthropic.com y crea una cuenta.' },
      { n: 2, title: 'Agrega método de pago', body: 'En Billing, agrega tu tarjeta de crédito.' },
      { n: 3, title: 'Genera una API Key', body: 'Ve a API Keys > Create Key. Nómbrala "Revio". Copia la clave (sk-ant-...).' },
      { n: 4, title: 'Ingresa en Revio', body: 'Ve a Configuración > Agente IA > Proveedor. Selecciona Claude Sonnet y pega tu API key.' },
    ],
    notes: ['Sin tu propia key, el agente usa la clave compartida de Revio (incluida en el plan).'],
  },

  openai: {
    name: 'OpenAI (GPT-4o)',
    icon: '🧠',
    category: 'IA',
    color: '#22c55e',
    description: 'Modelo GPT-4o de OpenAI como alternativa al motor IA de Revio.',
    docUrl: 'https://platform.openai.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Accede a OpenAI Platform', body: 'Ve a platform.openai.com y crea o inicia sesión en tu cuenta.' },
      { n: 2, title: 'Crea una API Key', body: 'Ve a API Keys > Create new secret key. Guarda la clave (sk-...).' },
      { n: 3, title: 'Agrega créditos', body: 'En Billing, agrega tu tarjeta. GPT-4o cuesta ~$5 USD / 1M tokens.' },
      { n: 4, title: 'Configura en Revio', body: 'Ve a Configuración > Agente IA > Proveedor. Selecciona GPT-4o y pega tu API key.' },
    ],
    notes: [],
  },

  gemini: {
    name: 'Gemini (Google)',
    icon: '✨',
    category: 'IA',
    color: '#f59e0b',
    description: 'Modelo Gemini 1.5 Pro de Google. Ideal para propiedades con muchas políticas y documentos.',
    docUrl: 'https://aistudio.google.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Ve a Google AI Studio', body: 'Accede a aistudio.google.com con tu cuenta de Google.' },
      { n: 2, title: 'Crea una API Key', body: 'Haz clic en "Get API Key" > "Create API Key". Selecciona o crea un proyecto de Google Cloud.' },
      { n: 3, title: 'Habilita la API', body: 'En Google Cloud Console, habilita la Generative Language API para tu proyecto.' },
      { n: 4, title: 'Configura en Revio', body: 'Ve a Configuración > Agente IA > Proveedor. Selecciona Gemini y pega tu API key (AIza...).' },
    ],
    notes: [],
  },

  groq: {
    name: 'Groq (Llama 3)',
    icon: '🦙',
    category: 'IA',
    color: '#ef4444',
    description: 'Llama 3 de Meta corriendo en hardware Groq. Ultra rápido y muy económico.',
    docUrl: 'https://console.groq.com',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea cuenta en Groq Cloud', body: 'Ve a console.groq.com y regístrate.' },
      { n: 2, title: 'Genera una API Key', body: 'En el menú de API Keys, crea una nueva clave. Empieza con gsk_...' },
      { n: 3, title: 'Configura en Revio', body: 'Ve a Configuración > Agente IA > Proveedor. Selecciona Llama 3 (Groq) y pega tu key.' },
    ],
    notes: ['Groq ofrece tier gratuito generoso. Ideal para pruebas y alto volumen.'],
  },

  instagram: {
    name: 'Instagram',
    icon: '📸',
    category: 'Social',
    color: '#ec4899',
    description: 'Responde automáticamente a mensajes directos y comentarios en Instagram.',
    docUrl: 'https://developers.facebook.com/docs/instagram',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Conecta a Facebook Page', body: 'Tu cuenta de Instagram Business debe estar vinculada a una Página de Facebook.' },
      { n: 2, title: 'Crea un Meta App', body: 'Ve a developers.facebook.com > My Apps > Create App > Business.' },
      { n: 3, title: 'Agrega Instagram API', body: 'En tu App, agrega el producto "Instagram". Configura el acceso a tu cuenta de IG.' },
      { n: 4, title: 'Genera Access Token', body: 'En Graph API Explorer, genera un token con permisos: instagram_basic, instagram_manage_messages.' },
      { n: 5, title: 'Configura webhook', body: 'En tu App > Instagram > Webhooks. URL: https://api.revio.co/api/social/instagram. Suscríbete a: messages, comments.' },
      { n: 6, title: 'Pega en Revio', body: 'Ve a Configuración > Conexiones > Instagram. Ingresa el Access Token.' },
    ],
    notes: ['Los tokens de Instagram expiran. Genera un token de larga duración (60 días) o configura un sistema de renovación.'],
  },

  facebook: {
    name: 'Facebook',
    icon: '📘',
    category: 'Social',
    color: '#3b82f6',
    description: 'Responde mensajes de Facebook Messenger y gestiona comentarios en tu página.',
    docUrl: 'https://developers.facebook.com/docs/messenger-platform',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Crea Meta App', body: 'Ve a developers.facebook.com > My Apps > Create App > Business.' },
      { n: 2, title: 'Agrega Messenger', body: 'En tu App, agrega el producto "Messenger". Selecciona tu Página de Facebook.' },
      { n: 3, title: 'Genera Page Access Token', body: 'En Messenger > Settings > Access Tokens, genera token para tu página.' },
      { n: 4, title: 'Configura webhook', body: 'URL: https://api.revio.co/api/social/facebook. Verify Token: mystica_webhook_2026. Suscríbete a: messages.' },
      { n: 5, title: 'Pega en Revio', body: 'Ve a Configuración > Conexiones > Facebook. Ingresa el Page Access Token.' },
    ],
    notes: [],
  },

  google_business: {
    name: 'Google Business',
    icon: '🔍',
    category: 'Social',
    color: '#f59e0b',
    description: 'Monitorea y responde reseñas de Google, y gestiona preguntas y respuestas.',
    docUrl: 'https://developers.google.com/my-business',
    videoUrl: null,
    steps: [
      { n: 1, title: 'Verifica tu negocio en Google', body: 'Ve a business.google.com y verifica tu propiedad (carta postal o videollamada).' },
      { n: 2, title: 'Habilita la API', body: 'En Google Cloud Console, habilita la Google My Business API.' },
      { n: 3, title: 'Crea credenciales OAuth2', body: 'Crea un OAuth2 Client ID para tu aplicación. Tipo: Web application.' },
      { n: 4, title: 'Autoriza el acceso', body: 'Completa el flujo OAuth2 con tu cuenta de Google. Revio obtendrá un refresh token.' },
    ],
    notes: ['La API de Google My Business tiene cuotas. Si tienes muchas reseñas, contacta a Google para aumentar los límites.'],
  },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded transition-colors"
      style={{ color: copied ? 'var(--success)' : 'var(--text-3)' }}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function IntegrationGuide({ integrationId, onClose }) {
  const guide = GUIDES[integrationId];
  if (!guide) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 580, maxHeight: '90vh',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `color-mix(in srgb, ${guide.color} 15%, transparent)`,
          }}>{guide.icon}</div>
          <div className="flex-1">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{guide.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{guide.category} · {guide.description}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-3)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {/* Video placeholder */}
          {guide.videoUrl && (
            <div style={{
              height: 160, background: 'var(--card)', borderRadius: 10, marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
              <Play className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Ver tutorial en video</span>
            </div>
          )}

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {guide.steps.map((step, i) => (
              <div key={step.n} style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  background: `color-mix(in srgb, ${guide.color} 15%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: guide.color,
                }}>{step.n}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{step.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {guide.notes.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 16,
              background: 'color-mix(in srgb, var(--warning) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notas importantes</p>
              {guide.notes.map((note, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>• {note}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {guide.docUrl ? (
            <a href={guide.docUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
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

// Hook para usar en ConnBlock
export function useIntegrationGuide() {
  const [open, setOpen] = useState(null);
  const openGuide = (id) => setOpen(id);
  const closeGuide = () => setOpen(null);
  const GuideModal = open ? <IntegrationGuide integrationId={open} onClose={closeGuide} /> : null;
  return { openGuide, GuideModal };
}

export default IntegrationGuide;
