/**
 * connections.js — Gestión de integraciones por propiedad.
 *
 * Arquitectura multitenancy: credenciales guardadas en settings table,
 * nunca en ENV ni en código. El frontend gestiona todo desde aquí.
 *
 * GET  /api/connections/:propertyId         — listar estado de conexiones
 * POST /api/connections/:propertyId         — guardar/actualizar credenciales
 * POST /api/connections/:propertyId/test    — probar una conexión
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConnections,
  saveSetting,
  getLobbyPMSToken,
  getWompiConfig,
  getWhatsAppConfig,
  getAIConfig,
} from '../services/connectionService.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

// ============================================================
// GET /api/connections/:propertyId — Estado de todas las conexiones
// ============================================================
router.get('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const connections = await listConnections(propertyId);

    // Enriquecer con el tipo de conexión
    const CONNECTION_META = {
      lobbypms_token:   { name: 'LobbyPMS', category: 'PMS', icon: '🏨' },
      wompi_config:     { name: 'Wompi', category: 'Pagos', icon: '💳' },
      whatsapp_config:  { name: 'WhatsApp Business', category: 'Mensajería', icon: '💬' },
      anthropic_config: { name: 'Claude AI (Anthropic)', category: 'IA', icon: '🤖' },
      openai_config:    { name: 'GPT-4 (OpenAI)', category: 'IA', icon: '🧠' },
      gemini_config:    { name: 'Gemini (Google)', category: 'IA', icon: '✨' },
      groq_config:      { name: 'Llama (Groq)', category: 'IA', icon: '⚡' },
      meta_config:      { name: 'Meta (Instagram/FB)', category: 'Redes Sociales', icon: '📱' },
      booking_config:   { name: 'Booking.com', category: 'OTAs', icon: '🏩' },
      airbnb_config:    { name: 'Airbnb', category: 'OTAs', icon: '🏠' },
      cloudbeds_config: { name: 'Cloudbeds', category: 'PMS', icon: '☁️' },
    };

    const enriched = connections.map(c => ({
      ...c,
      ...(CONNECTION_META[c.key] || { name: c.key, category: 'Otro', icon: '🔌' })
    }));

    res.json({ connections: enriched });
  } catch (err) {
    console.error('[Connections] Error listando:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/connections/:propertyId — Guardar credenciales
// Body: { key, value, updated_by }
// ============================================================
router.post('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { key, value, updated_by } = req.body;

    if (!key || value === undefined || value === null) {
      return res.status(400).json({ error: 'key y value son requeridos' });
    }

    // Validar que el key es un tipo de conexión conocido
    const ALLOWED_KEYS = [
      'lobbypms_token', 'wompi_config', 'whatsapp_config',
      'anthropic_config', 'openai_config', 'gemini_config', 'groq_config',
      'meta_config', 'booking_config', 'airbnb_config', 'cloudbeds_config',
      'agent', // config del agente IA
    ];

    if (!ALLOWED_KEYS.includes(key)) {
      return res.status(400).json({ error: `Key no permitida: ${key}` });
    }

    await saveSetting(propertyId, key, value, updated_by || req.user?.email);

    res.json({ success: true, key });
  } catch (err) {
    console.error('[Connections] Error guardando:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/connections/:propertyId/test — Probar una conexión
// Body: { key }
// ============================================================
router.post('/:propertyId/test', async (req, res) => {
  const { propertyId } = req.params;
  const { key } = req.body;

  if (!key) return res.status(400).json({ error: 'key es requerido' });

  try {
    let result = { success: false, message: 'Test no implementado para este tipo' };

    switch (key) {
      case 'lobbypms_token': {
        const token = await getLobbyPMSToken(propertyId, null);
        if (!token) { result = { success: false, message: 'Token no configurado' }; break; }

        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        const lobbyBase = process.env.LOBBYPMS_PROXY_URL
          ? `${process.env.LOBBYPMS_PROXY_URL}/proxy`
          : 'https://api.lobbypms.com';
        const lobbyHeaders = { Authorization: `Bearer ${token}` };
        if (process.env.LOBBYPMS_PROXY_URL && process.env.LOBBYPMS_PROXY_SECRET) {
          lobbyHeaders['X-Proxy-Secret'] = process.env.LOBBYPMS_PROXY_SECRET;
        }
        const r = await fetch(
          `${lobbyBase}/api/v2/available-rooms?start_date=${today}&end_date=${nextWeek}&adults=1`,
          { headers: lobbyHeaders }
        );
        if (r.ok) {
          const d = await r.json();
          const cats = d.data?.[0]?.categories?.length || 0;
          result = { success: true, message: `LobbyPMS conectado ✅ — ${cats} categorías de habitación` };
        } else {
          const text = await r.text();
          result = { success: false, message: `Error HTTP ${r.status}: ${text.substring(0, 100)}` };
        }
        break;
      }

      case 'wompi_config': {
        const cfg = await getWompiConfig(propertyId, null);
        if (!cfg?.public_key) { result = { success: false, message: 'Public key no configurada' }; break; }

        const r = await fetch(`https://production.wompi.co/v1/merchants/${cfg.public_key}`);
        const d = await r.json();
        if (d.data) {
          result = { success: true, message: `Wompi ✅ — ${d.data.name} (activo: ${d.data.active})` };
        } else {
          result = { success: false, message: `Error: ${JSON.stringify(d).substring(0, 100)}` };
        }
        break;
      }

      case 'whatsapp_config': {
        const cfg = await getWhatsAppConfig(propertyId);
        if (!cfg?.access_token) { result = { success: false, message: 'Access token no configurado' }; break; }

        const r = await fetch(
          `https://graph.facebook.com/v22.0/debug_token?input_token=${cfg.access_token}&access_token=${cfg.access_token}`
        );
        const d = await r.json();
        if (d.data?.is_valid) {
          result = { success: true, message: `WhatsApp token válido ✅ — App ID: ${d.data.app_id}` };
        } else {
          result = { success: false, message: `Token inválido: ${d.error?.message || 'desconocido'}` };
        }
        break;
      }

      case 'anthropic_config': {
        const cfg = await getAIConfig(propertyId);
        if (!cfg?.api_key) { result = { success: false, message: 'API key no configurada' }; break; }

        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': cfg.api_key, 'anthropic-version': '2023-06-01' }
        });
        if (r.ok) {
          result = { success: true, message: `Anthropic API ✅ — Modelo: ${cfg.model}` };
        } else {
          const d = await r.json();
          result = { success: false, message: d.error?.message || `Error HTTP ${r.status}` };
        }
        break;
      }

      case 'openai_config': {
        const cfg = await getLobbyPMSToken(propertyId, null); // reusar getSetting directamente
        const { getSetting } = await import('../services/connectionService.js');
        const openaiCfg = await getSetting(propertyId, 'openai_config');
        if (!openaiCfg?.api_key) { result = { success: false, message: 'API key no configurada' }; break; }

        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openaiCfg.api_key}` }
        });
        result = { success: r.ok, message: r.ok ? 'OpenAI API ✅' : `Error HTTP ${r.status}` };
        break;
      }

      case 'gemini_config': {
        const { getSetting } = await import('../services/connectionService.js');
        const geminiCfg = await getSetting(propertyId, 'gemini_config');
        if (!geminiCfg?.api_key) { result = { success: false, message: 'API key no configurada' }; break; }

        const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiCfg.api_key}`);
        result = { success: r.ok, message: r.ok ? 'Gemini API ✅' : `Error HTTP ${r.status}` };
        break;
      }

      case 'groq_config': {
        const { getSetting } = await import('../services/connectionService.js');
        const groqCfg = await getSetting(propertyId, 'groq_config');
        if (!groqCfg?.api_key) { result = { success: false, message: 'API key no configurada' }; break; }

        const r = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqCfg.api_key}` }
        });
        result = { success: r.ok, message: r.ok ? 'Groq API ✅' : `Error HTTP ${r.status}` };
        break;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[Connections] Error probando:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
