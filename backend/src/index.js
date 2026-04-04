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
import { generalLimiter } from './middleware/rateLimiter.js';
import { startScheduler } from './services/scheduler.js';
import { runPendingMigrations } from './services/dbMigrations.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES de seguridad y parseo
// ============================================================
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // El widget necesita embeberse
}));

app.use(cors({
  origin: (origin, cb) => {
    // Permitir: frontend propio, localhost (dev), cualquier origen para el widget
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    ].filter(Boolean);

    // Permitir sin origin (apps móviles, curl, scripts embebidos)
    if (!origin || allowed.includes(origin)) return cb(null, true);

    // Permitir si viene del widget embebido (cualquier web de clientes)
    cb(null, true); // Producción: restringir a dominios cliente registrados
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-event-checksum']
}));

// Parsear JSON — el webhook de Wompi necesita el body raw para verificar firma
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'Mística AI Agent',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Servir el script del widget embebible
app.get('/embed.js', (req, res) => {
  const apiUrl = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(generateEmbedScript(apiUrl));
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
  console.log(`🌊 Mística AI Agent corriendo en puerto ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Widget: http://localhost:${PORT}/embed.js`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}`);

  // Iniciar tareas programadas
  startScheduler();

  // Ejecutar migraciones pendientes (solo si SUPABASE_DB_URL configurado)
  runPendingMigrations().catch(err => console.error('[Startup] Migration error:', err.message));
});

// ============================================================
// Script del chat widget embebible (generado dinámicamente)
// ============================================================
function generateEmbedScript(apiUrl) {
  return `
(function() {
  'use strict';

  var MYSTICA_API = '${apiUrl}';
  var config = window.MysticaConfig || {};
  var propertySlug = config.property || 'isla-palma';
  var lang = config.language || (navigator.language || 'es').substring(0, 2);

  // Estilos del widget
  var style = document.createElement('style');
  style.textContent = \`
    #mystica-widget { position: fixed; bottom: 24px; right: 24px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #mystica-btn { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #1a1a2e 0%, #00b4d8 100%); border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,180,216,0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
    #mystica-btn:hover { transform: scale(1.1); }
    #mystica-btn svg { width: 28px; height: 28px; fill: white; }
    #mystica-chat { position: absolute; bottom: 72px; right: 0; width: 360px; height: 520px; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; }
    #mystica-chat.open { display: flex; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    #mystica-header { background: linear-gradient(135deg, #1a1a2e 0%, #00b4d8 100%); color: white; padding: 16px; display: flex; align-items: center; gap: 12px; }
    #mystica-header img { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); }
    #mystica-header-info h3 { margin: 0; font-size: 15px; font-weight: 600; }
    #mystica-header-info p { margin: 2px 0 0; font-size: 11px; opacity: 0.8; }
    #mystica-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; }
    .mystica-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; word-wrap: break-word; }
    .mystica-msg.bot { background: white; border-radius: 12px 12px 12px 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); color: #1a1a2e; align-self: flex-start; }
    .mystica-msg.user { background: linear-gradient(135deg, #1a1a2e, #00b4d8); color: white; border-radius: 12px 12px 2px 12px; align-self: flex-end; }
    #mystica-input-area { padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px; background: white; }
    #mystica-input { flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 8px 16px; font-size: 13.5px; outline: none; resize: none; }
    #mystica-input:focus { border-color: #00b4d8; }
    #mystica-send { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1a1a2e, #00b4d8); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    #mystica-send svg { width: 16px; height: 16px; fill: white; }
    #mystica-typing { display: none; align-self: flex-start; background: white; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    #mystica-typing span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00b4d8; animation: bounce 1.2s infinite; margin: 0 2px; }
    #mystica-typing span:nth-child(2) { animation-delay: 0.2s; }
    #mystica-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }
    @media (max-width: 480px) { #mystica-chat { width: calc(100vw - 32px); right: -16px; bottom: 68px; height: 70vh; } }
  \`;
  document.head.appendChild(style);

  // Crear HTML del widget
  var widget = document.createElement('div');
  widget.id = 'mystica-widget';
  widget.innerHTML = \`
    <div id="mystica-chat">
      <div id="mystica-header">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;">🌊</div>
        <div id="mystica-header-info">
          <h3>Mística AI</h3>
          <p>Asistente virtual · En línea</p>
        </div>
      </div>
      <div id="mystica-messages"></div>
      <div id="mystica-input-area">
        <textarea id="mystica-input" rows="1" placeholder="Escribe tu mensaje..."></textarea>
        <button id="mystica-send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
    </div>
    <button id="mystica-btn">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
  \`;
  document.body.appendChild(widget);

  var sessionId = null;
  var isOpen = false;
  var isLoading = false;
  var initialized = false;

  var btn = document.getElementById('mystica-btn');
  var chat = document.getElementById('mystica-chat');
  var messages = document.getElementById('mystica-messages');
  var input = document.getElementById('mystica-input');
  var sendBtn = document.getElementById('mystica-send');

  function addMessage(text, isUser) {
    var msg = document.createElement('div');
    msg.className = 'mystica-msg ' + (isUser ? 'user' : 'bot');
    msg.innerHTML = text.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function showTyping() {
    var t = document.createElement('div');
    t.id = 'mystica-typing';
    t.className = 'mystica-msg bot';
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
      var res = await fetch(MYSTICA_API + '/api/chat/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_slug: propertySlug, language: lang })
      });
      var data = await res.json();
      sessionId = data.session_id;
      addMessage(data.greeting, false);
    } catch(e) {
      addMessage('¡Hola! ¿En qué puedo ayudarte? 🌊', false);
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
      var res = await fetch(MYSTICA_API + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId, property_slug: propertySlug })
      });
      var data = await res.json();
      typing.remove();
      addMessage(data.reply || 'Lo siento, hubo un problema. Intenta de nuevo.', false);
      if (data.booking?.payment_link_url) {
        addMessage('💳 <a href="' + data.booking.payment_link_url + '" target="_blank" style="color:#00b4d8;font-weight:bold;">Completar pago aquí →</a>', false);
      }
    } catch(e) {
      typing.remove();
      addMessage('Hubo un problema de conexión. Por favor intenta de nuevo. 🙏', false);
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

  // Auto-abrir después de 8 segundos si está configurado
  if (config.autoOpen) setTimeout(function() { if (!isOpen) btn.click(); }, 8000);
})();
`;
}

export default app;
