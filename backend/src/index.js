import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

import chatRoutes from './routes/chat.js';
import bookingsRoutes from './routes/bookings.js';
import paymentsRoutes from './routes/payments.js';
import dashboardRoutes from './routes/dashboard.js';
import otaRoutes from './routes/ota.js';
import socialRoutes from './routes/social.js';
import settingsRoutes from './routes/settings.js';
import saRoutes from './routes/superadmin.js';
import registerRoutes from './routes/register.js';
import knowledgeRoutes from './routes/knowledge.js';
import connectionsRoutes from './routes/connections.js';
import authRoutes from './routes/auth.js';
import usageRoutes from './routes/usage.js';
import roomsRoutes from './routes/rooms.js';
import reservationsRoutes from './routes/reservations.js';
import guestsRoutes from './routes/guests.js';
import housekeepingRoutes from './routes/housekeeping.js';
import posRoutes from './routes/pos.js';
import walletsRoutes from './routes/wallets.js';
import aiRoutes from './routes/ai.js';
import eventsRoutes from './routes/events.js';
import publicBookingRoutes from './routes/publicBooking.js';
import reportsRoutes from './routes/reports.js';
import channelRoutes from './routes/channel.js';
import notificationsRoutes from './routes/notifications.js';
import invoicesRoutes from './routes/invoices.js';
import usersRoutes from './routes/users.js';
import reviewsRoutes from './routes/reviews.js';
import propertiesRoutes from './routes/properties.js';
import inventoryRoutes from './routes/inventory.js';
import modulesRoutes from './routes/modules.js';
import syncRoutes from './routes/sync.js';
import cancellationCasesRoutes from './routes/cancellationCases.js';
import prefacturaRoutes from './routes/prefactura.js';
import transportRoutes from './routes/transport.js';
import paymentLinkRoutes from './routes/paymentLink.js';
import webhooksRoutes from './routes/webhooks.js';
import billingRoutes from './routes/billing.js';
import integrationHealthRoutes from './routes/integrationHealth.js';
import channelsRoutes from './routes/channels.js';
import systemHealthRoutes from './routes/systemHealth.js';
import reviewsAiRoutes from './routes/reviewsAi.js';
import escalationsRoutes from './routes/escalations.js';
import learningRoutes from './routes/learning.js';
import ensayoRoutes from './routes/ensayo.js';
import foliosRoutes from './routes/folios.js';
import ratePlansRoutes from './routes/ratePlans.js';
import housekeepingApiRoutes from './routes/housekeepingApi.js';
import contactsRoutes from './routes/contacts.js';
import automatedMessagesRoutes from './routes/automatedMessages.js';
import approvalRequestsRoutes from './routes/approvalRequests.js';
import platformAuditsRoutes from './routes/platformAudits.js';
import scheduledReportsRoutes from './routes/scheduledReports.js';
import channelSyncRoutes from './routes/channelSync.js';
import { syncAllProperties } from './services/icalSync.js';
import cron from 'node-cron';
import { generalLimiter } from './middleware/rateLimiter.js';
import { buildCorsOriginChecker, widgetCorsOpen } from './utils/security.js';
import { startScheduler } from './services/scheduler.js';
import { runPendingMigrations } from './services/dbMigrations.js';
import { detectAndStoreIp } from './utils/ipMonitor.js';
import googleAuthRoutes from './routes/googleAuth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES de seguridad y parseo
// ============================================================
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // El widget necesita embeberse
}));

// E-AGENT-9 (2026-04-26): CORS por capas. Antes era efectivamente "*" con
// credentials:true (vulnerabilidad CSRF). Ahora:
//   - Rutas de widget/chat/embed → CORS abierto (clientes embeben en sus dominios)
//   - Resto del API → allowlist estricto (FRONTEND_URL, alzio.co, ALLOWED_ORIGINS)
const widgetCors = cors({
  origin: widgetCorsOpen,
  credentials: false, // widget no usa cookies
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
});

const apiCors = cors({
  origin: buildCorsOriginChecker(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-event-checksum'],
});

// Widget routes — CORS abierto
app.use('/api/chat', widgetCors);
app.use('/api/widget', widgetCors);
app.use('/embed.js', widgetCors);
app.use('/api/public', widgetCors);
// Webhook endpoints — sin CORS check (origen es el provider, no browser)
app.use('/api/webhooks', widgetCors);
app.use('/api/payments/webhook', widgetCors);

// Resto del API → allowlist estricto
app.use(apiCors);

// Parsear JSON — el webhook de Wompi necesita el body raw para verificar firma
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

// E-AGENT-9 (2026-04-26 — M3): bajado de 10mb a 1mb (mitiga DoS por payload).
// Endpoints específicos que necesiten más (image upload, etc.) deben overrider
// con su propio limit, no globalmente.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('combined'));
app.use(generalLimiter);

// ============================================================
// RUTAS
// ============================================================
app.use('/api/chat', chatRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ota', otaRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sa', saRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/onboarding', registerRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/guests', guestsRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/public/book', publicBookingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/channel', channelRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/cancellation-cases', cancellationCasesRoutes);
app.use('/api/prefactura', prefacturaRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/payment-link', paymentLinkRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/integration-health', integrationHealthRoutes);
app.use('/api', channelsRoutes);
app.use('/api/system', systemHealthRoutes);
app.use('/api', reviewsAiRoutes);
app.use('/api', escalationsRoutes);
app.use('/api', learningRoutes);
app.use('/api', ensayoRoutes);
app.use('/api', foliosRoutes);
app.use('/api', ratePlansRoutes);
app.use('/api', housekeepingApiRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/automated-messages', automatedMessagesRoutes);
app.use('/api/approval-requests', approvalRequestsRoutes);
app.use('/api/platform-audits', platformAuditsRoutes);
app.use('/api/scheduled-reports', scheduledReportsRoutes);
app.use('/api', channelSyncRoutes);
app.use('/api/google', googleAuthRoutes);

// Cron OTA iCal sync — cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
  try {
    await syncAllProperties();
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error', event: 'cron_ical_sync_failed', error: err.message,
    }));
  }
}, { timezone: 'America/Bogota' });
console.log(JSON.stringify({
  level: 'info', event: 'ical_sync_cron_started', interval: '15min',
}));

// Cron auditoría semanal de plataformas (domingos 08:00 Bogotá)
cron.schedule('0 8 * * 0', async () => {
  try {
    const { runPlatformAudit } = await import('./services/platformAudit.js');
    const { supabase: sb } = await import('./models/supabase.js');
    const { data: props } = await sb.from('properties').select('id, tenant_id').eq('is_active', true);
    for (const p of props || []) {
      await runPlatformAudit(p.tenant_id, p.id).catch(e =>
        console.error('platform_audit_error', p.id, e.message));
    }
    console.log(JSON.stringify({
      level: 'info', event: 'cron_platform_audit_completed', count: props?.length || 0,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error', event: 'cron_platform_audit_failed', error: err.message,
    }));
  }
}, { timezone: 'America/Bogota' });
console.log(JSON.stringify({
  level: 'info', event: 'platform_audit_cron_started', schedule: 'domingos 08:00 Bogotá',
}));

// Cron currency rates — cada 2 horas
cron.schedule('0 */2 * * *', async () => {
  try {
    const { refreshAllRates } = await import('./services/currencyService.js');
    const result = await refreshAllRates();
    if (result.success) {
      console.log(JSON.stringify({
        level: 'info', event: 'currency_rates_refreshed_cron', count: result.count,
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error', event: 'cron_currency_failed', error: err.message,
    }));
  }
}, { timezone: 'America/Bogota' });
console.log(JSON.stringify({
  level: 'info', event: 'currency_cron_started', schedule: 'cada 2 horas',
}));

// Cron reviews IA — cada 6 horas (00:00, 06:00, 12:00, 18:00 Bogotá)
cron.schedule('0 */6 * * *', async () => {
  try {
    const { fetchAllPendingReviews } = await import('./services/reviewsAiService.js');
    const results = await fetchAllPendingReviews();
    console.log(JSON.stringify({
      level: 'info', event: 'reviews_cron_completed', results,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error', event: 'cron_reviews_failed', error: err.message,
    }));
  }
}, { timezone: 'America/Bogota' });
console.log(JSON.stringify({
  level: 'info', event: 'reviews_cron_started', schedule: 'cada 6 horas Bogotá',
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'Alzio Hoteles API',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ============================================================
// Widget embebible per-tenant
//
// GET /embed.js[?tenant=<slug>]
//   - sin tenant: widget neutro Alzio
//   - con tenant: lookup branding (logo, color, agent_name, greeting)
//
// CORS: el script se carga desde el sitio del cliente. La API debe
// permitir cross-origin para los endpoints del chat. Ya configurado vía
// middleware CORS en este server.
// ============================================================
app.get('/embed.js', async (req, res) => {
  const apiUrl = process.env.WIDGET_API_URL || process.env.FRONTEND_URL || `http://localhost:${PORT}`;
  const tenantSlug = (req.query.tenant || '').toString().trim().toLowerCase();
  let branding = {
    business_name: 'Alzio',
    agent_name: 'Asistente',
    greeting: '',
    primary_color: '#6366F1',
    accent_color: '#4F46E5',
    logo_url: '',
    avatar_emoji: '💬',
    property_slug: '',
  };
  if (tenantSlug) {
    try {
      const { supabase } = await import('./models/supabase.js');
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, slug, business_name, agent_name, greeting_custom, primary_color, accent_color, logo_url, avatar_emoji')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (tenant) {
        branding = {
          business_name: tenant.business_name || branding.business_name,
          agent_name: tenant.agent_name || `Asistente de ${tenant.business_name || branding.business_name}`,
          greeting: tenant.greeting_custom || '',
          primary_color: tenant.primary_color || branding.primary_color,
          accent_color: tenant.accent_color || tenant.primary_color || branding.accent_color,
          logo_url: tenant.logo_url || '',
          avatar_emoji: tenant.avatar_emoji || branding.avatar_emoji,
          property_slug: '', // las propiedades se resuelven al runtime via /api/chat/init
        };
        // Cargar primer property_slug del tenant para que el widget tenga
        // un default si el host no lo provee via window.AlzioConfig.
        const { data: firstProp } = await supabase
          .from('properties')
          .select('slug')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        branding.property_slug = firstProp?.slug || '';
      }
    } catch (err) {
      console.error('[/embed.js] tenant lookup error:', err.message);
    }
  }
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache (rebrand fluido)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(generateEmbedScript(apiUrl, branding));
});

// ============================================================
// Página de documentación del embed widget
// GET /docs/embed
// Muestra el snippet listo para copiar + opciones de configuración.
// ============================================================
app.get('/docs/embed', (req, res) => {
  const apiUrl = process.env.WIDGET_API_URL || process.env.FRONTEND_URL || `http://localhost:${PORT}`;
  const tenantParam = req.query.tenant ? `?tenant=${encodeURIComponent(req.query.tenant)}` : '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(generateEmbedDocs(apiUrl, tenantParam));
});

// ── Servir frontend compilado (producción Railway) ───────────
const frontendDist = join(__dirname, '../../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: todas las rutas no-API van al index.html
  app.get('*', (req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
} else {
  // 404 handler solo en dev (sin frontend compilado)
  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
}

// Error handler global
app.use((err, req, res, next) => {
  console.error('[Server] Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================
// INICIO
// ============================================================
app.listen(PORT, () => {
  console.log(`🌊 Alzio Hoteles API corriendo en puerto ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Widget: http://localhost:${PORT}/embed.js`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}`);

  // Iniciar tareas programadas
  startScheduler();

  // Ejecutar migraciones pendientes (solo si SUPABASE_DB_URL configurado)
  runPendingMigrations().catch(err => console.error('[Startup] Migration error:', err.message));

  // Detectar y registrar IP actual del servidor (alerta si cambió)
  detectAndStoreIp().catch(err => console.error('[Startup] IP monitor error:', err.message));
});

// ============================================================
// Error handler global — sanitiza stack traces en producción.
// E-AGENT-9 H-SEC-6 (2026-04-26): antes los handlers route-level hacían
// res.status(500).json({ error: err.message }) filtrando internals
// (nombre tabla, columna, dialecto Postgres). Ahora cualquier error no
// catcheado retorna mensaje genérico + requestId; los detalles van solo
// al log del servidor.
// ============================================================
app.use((err, req, res, _next) => {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  console.error(JSON.stringify({
    level: 'error',
    event: 'unhandled_error',
    request_id: requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  }));
  if (res.headersSent) return;
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    request_id: requestId,
  });
});

// ============================================================
// Script del chat widget embebible — generado dinámicamente con branding
// del tenant. CSS IDs `alzio-widget-*` para evitar colisión con widgets
// legacy de Mística/Revio que el cliente pudiera tener.
// ============================================================
function generateEmbedScript(apiUrl, branding) {
  const b = branding || {};
  // Escape único para inyección segura en JS string literal
  const safe = (s) => String(s || '').replace(/[\\'"`]/g, (m) => '\\' + m).replace(/<\/script/gi, '<\\/script');
  const primary = safe(b.primary_color || '#6366F1');
  const accent = safe(b.accent_color || '#4F46E5');
  const businessName = safe(b.business_name || 'Alzio');
  const agentName = safe(b.agent_name || 'Asistente');
  const greeting = safe(b.greeting || '');
  const logoUrl = safe(b.logo_url || '');
  const avatar = safe(b.avatar_emoji || '💬');
  const defaultPropertySlug = safe(b.property_slug || '');

  return `
(function() {
  'use strict';

  var ALZIO_API = '${apiUrl}';
  var config = window.AlzioConfig || window.RevioConfig || window.MysticaConfig || {};
  var propertySlug = config.property || '${defaultPropertySlug}';
  var lang = config.language || (navigator.language || 'es').substring(0, 2);

  // Branding inyectado server-side desde tenants table
  var BRAND = {
    primary: '${primary}',
    accent: '${accent}',
    business: '${businessName}',
    agent: '${agentName}',
    greeting: '${greeting}',
    logo: '${logoUrl}',
    avatar: '${avatar}',
  };

  var style = document.createElement('style');
  style.textContent =
    '#alzio-widget { position: fixed; bottom: 24px; right: 24px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }' +
    '#alzio-widget-btn { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, ' + BRAND.primary + ' 0%, ' + BRAND.accent + ' 100%); border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }' +
    '#alzio-widget-btn:hover { transform: scale(1.1); }' +
    '#alzio-widget-btn svg { width: 28px; height: 28px; fill: white; }' +
    '#alzio-widget-chat { position: absolute; bottom: 72px; right: 0; width: 360px; height: 520px; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; }' +
    '#alzio-widget-chat.open { display: flex; animation: alzioSlideUp 0.3s ease; }' +
    '@keyframes alzioSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }' +
    '#alzio-widget-header { background: linear-gradient(135deg, ' + BRAND.primary + ' 0%, ' + BRAND.accent + ' 100%); color: white; padding: 16px; display: flex; align-items: center; gap: 12px; }' +
    '#alzio-widget-header img { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); object-fit: cover; }' +
    '#alzio-widget-header-info h3 { margin: 0; font-size: 15px; font-weight: 600; }' +
    '#alzio-widget-header-info p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }' +
    '#alzio-widget-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; }' +
    '.alzio-widget-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; word-wrap: break-word; }' +
    '.alzio-widget-msg.bot { background: white; border-radius: 12px 12px 12px 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); color: #1a1a2e; align-self: flex-start; }' +
    '.alzio-widget-msg.user { background: linear-gradient(135deg, ' + BRAND.primary + ', ' + BRAND.accent + '); color: white; border-radius: 12px 12px 2px 12px; align-self: flex-end; }' +
    '#alzio-widget-input-area { padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px; background: white; }' +
    '#alzio-widget-input { flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 8px 16px; font-size: 13.5px; outline: none; resize: none; }' +
    '#alzio-widget-input:focus { border-color: ' + BRAND.primary + '; }' +
    '#alzio-widget-send { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, ' + BRAND.primary + ', ' + BRAND.accent + '); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
    '#alzio-widget-send svg { width: 16px; height: 16px; fill: white; }' +
    '#alzio-widget-typing { display: none; align-self: flex-start; background: white; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }' +
    '#alzio-widget-typing span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ' + BRAND.primary + '; animation: alzioBounce 1.2s infinite; margin: 0 2px; }' +
    '#alzio-widget-typing span:nth-child(2) { animation-delay: 0.2s; }' +
    '#alzio-widget-typing span:nth-child(3) { animation-delay: 0.4s; }' +
    '@keyframes alzioBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }' +
    '@media (max-width: 480px) { #alzio-widget-chat { width: calc(100vw - 32px); right: -16px; bottom: 68px; height: 70vh; } }';
  document.head.appendChild(style);

  // HTML del widget — usa logo si existe, sino emoji
  var avatarHtml = BRAND.logo
    ? '<img src="' + BRAND.logo + '" alt="' + BRAND.business + '">'
    : '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;">' + BRAND.avatar + '</div>';

  var widget = document.createElement('div');
  widget.id = 'alzio-widget';
  widget.innerHTML =
    '<div id="alzio-widget-chat">' +
      '<div id="alzio-widget-header">' +
        avatarHtml +
        '<div id="alzio-widget-header-info">' +
          '<h3>' + BRAND.business + '</h3>' +
          '<p>' + BRAND.agent + '</p>' +
        '</div>' +
      '</div>' +
      '<div id="alzio-widget-messages"></div>' +
      '<div id="alzio-widget-input-area">' +
        '<textarea id="alzio-widget-input" rows="1" placeholder="Escribe tu mensaje..."></textarea>' +
        '<button id="alzio-widget-send" aria-label="Enviar"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
      '</div>' +
    '</div>' +
    '<button id="alzio-widget-btn" aria-label="Abrir chat">' +
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
    '</button>';
  document.body.appendChild(widget);

  var sessionId = null;
  var isOpen = false;
  var isLoading = false;
  var initialized = false;

  var btn = document.getElementById('alzio-widget-btn');
  var chat = document.getElementById('alzio-widget-chat');
  var messages = document.getElementById('alzio-widget-messages');
  var input = document.getElementById('alzio-widget-input');
  var sendBtn = document.getElementById('alzio-widget-send');

  function addMessage(text, isUser) {
    var msg = document.createElement('div');
    msg.className = 'alzio-widget-msg ' + (isUser ? 'user' : 'bot');
    msg.innerHTML = text.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function showTyping() {
    var t = document.createElement('div');
    t.id = 'alzio-widget-typing';
    t.className = 'alzio-widget-msg bot';
    t.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(t);
    messages.scrollTop = messages.scrollHeight;
    t.style.display = 'block';
    return t;
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      var res = await fetch(ALZIO_API + '/api/chat/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_slug: propertySlug, language: lang })
      });
      var data = await res.json();
      sessionId = data.session_id;
      // Greeting custom del tenant si está configurado, sino el del init
      var greeting = BRAND.greeting || data.greeting || '¡Hola! ¿En qué puedo ayudarte?';
      addMessage(greeting, false);
    } catch(e) {
      addMessage(BRAND.greeting || '¡Hola! ¿En qué puedo ayudarte?', false);
    }
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    input.style.height = 'auto';
    addMessage(text, true);
    isLoading = true;
    var typing = showTyping();
    try {
      var res = await fetch(ALZIO_API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId, property_slug: propertySlug })
      });
      var data = await res.json();
      typing.remove();
      addMessage(data.reply || data.message || 'Lo siento, hubo un problema. Intenta de nuevo.', false);
      if (data.booking && data.booking.payment_link_url) {
        addMessage('💳 <a href="' + data.booking.payment_link_url + '" target="_blank" style="color:' + BRAND.primary + ';font-weight:bold;">Completar pago aquí →</a>', false);
      }
    } catch(e) {
      typing.remove();
      addMessage('Hubo un problema de conexión. Por favor intenta de nuevo.', false);
    }
    isLoading = false;
  }

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    chat.classList.toggle('open', isOpen);
    if (isOpen && !initialized) init();
    if (isOpen) setTimeout(function() { input.focus(); }, 300);
  });

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  if (config.autoOpen) setTimeout(function() { if (!isOpen) btn.click(); }, 8000);
})();
`;
}

// ============================================================
// Página de docs HTML para el embed widget
// ============================================================
function generateEmbedDocs(apiUrl, tenantParam) {
  const exampleSlug = 'mi-hotel';
  const scriptSrc = apiUrl + '/embed.js' + (tenantParam || '');
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><title>Alzio Embed Widget — Documentación</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#0f172a;line-height:1.6}
  h1{font-size:28px;margin:0 0 8px}h2{font-size:18px;margin:32px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
  pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font-size:13px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
  .badge{display:inline-block;background:#6366F1;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:6px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-size:13px}
  .muted{color:#64748b;font-size:13px}
</style></head>
<body>
<h1>Alzio Embed Widget</h1>
<p class="muted">Agente IA de ventas para tu sitio web. Una sola línea de código.</p>

<h2><span class="badge">1</span>Instalación</h2>
<p>Pegá este script antes del cierre de <code>&lt;/body&gt;</code> en tu sitio web:</p>
<pre>&lt;script src="${scriptSrc}" async&gt;&lt;/script&gt;</pre>
<p class="muted">Reemplazá <code>tenant=${exampleSlug}</code> con tu slug real.</p>

<h2><span class="badge">2</span>Configuración (opcional)</h2>
<p>Para personalizar al runtime declará <code>window.AlzioConfig</code> ANTES del script:</p>
<pre>&lt;script&gt;
  window.AlzioConfig = {
    property: 'isla-palma',     // slug propiedad por defecto (override del backend)
    language: 'es',              // es | en | pt | fr | de
    autoOpen: false              // abrir automáticamente al pasar 8s
  };
&lt;/script&gt;
&lt;script src="${scriptSrc}" async&gt;&lt;/script&gt;</pre>

<h2><span class="badge">3</span>Branding</h2>
<p>El branding (logo, paleta, nombre del agente, mensaje de bienvenida) se
configura desde el panel de Alzio en la tabla <code>tenants</code>:</p>
<table>
  <tr><th>Campo</th><th>Tipo</th><th>Ejemplo</th></tr>
  <tr><td>business_name</td><td>texto</td><td>Hotel del Mar</td></tr>
  <tr><td>agent_name</td><td>texto</td><td>Asistente · En línea</td></tr>
  <tr><td>greeting_custom</td><td>texto</td><td>¡Hola! Soy Sara, asistente del Hotel del Mar 👋</td></tr>
  <tr><td>primary_color</td><td>hex</td><td>#0EA5E9</td></tr>
  <tr><td>accent_color</td><td>hex</td><td>#0284C7</td></tr>
  <tr><td>logo_url</td><td>URL</td><td>https://misitio.com/logo.png</td></tr>
  <tr><td>avatar_emoji</td><td>texto</td><td>🏨 (fallback si no hay logo)</td></tr>
</table>
<p class="muted">El widget cachea por 5 minutos. Cambios en branding se ven reflejados ese tiempo después.</p>

<h2><span class="badge">4</span>Probar el widget</h2>
<p>Probalo ahora con un tenant existente (cambiá el slug):</p>
<pre>${scriptSrc}</pre>
<p>Una burbuja debe aparecer en la esquina inferior derecha. Click para abrir el chat.</p>

<h2><span class="badge">5</span>Soporte</h2>
<p>Reportá issues a <a href="mailto:soporte@alzio.co">soporte@alzio.co</a>.</p>

<script src="${scriptSrc}"></script>
</body></html>`;
}

export default app;
