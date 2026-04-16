/**
 * Webhooks unificados — Meta (WhatsApp + Instagram + Facebook)
 * Todos los mensajes entrantes pasan por aquí y se procesan con el agente IA.
 *
 * v2.5 — Ruteo automático por page_id / phone_number_id usando channel_property_map.
 *   - Facebook/IG: cada página tiene page_id único → mapeo directo a propiedad
 *   - WhatsApp: número compartido → scope='shared', el agente pregunta propiedad
 *   - Fallback: si no hay mapeo, usa la primera propiedad activa
 *
 * GET  /api/webhooks/meta  → verificación hub.challenge
 * POST /api/webhooks/meta  → recibe eventos (mensajes, comentarios)
 */
import express from 'express';
import crypto from 'crypto';
import {
  parseMetaWebhook,
  verifyMetaWebhook,
  sendMessage,
  replyToInstagramComment,
  replyToFacebookComment,
} from '../services/metaUnified.js';
import { saveContact } from '../services/agentUtils.js';
import { processMessage } from '../agents/hotelAgent.js';
import { isTenantEnabled } from '../services/tenantAccess.js';
import { insertInboxMessage } from '../services/channelService.js';
import { supabase } from '../models/supabase.js';

const router = express.Router();

// ── Cache de mapeo channel_property_map (TTL 5 min) ────
let _mapCache = null;
let _mapCacheTs = 0;
const MAP_CACHE_TTL = 5 * 60 * 1000;

async function getChannelPropertyMap() {
  if (_mapCache && Date.now() - _mapCacheTs < MAP_CACHE_TTL) return _mapCache;

  const { data, error } = await supabase
    .from('channel_property_map')
    .select('channel, external_id, property_id, scope, external_name')
    .eq('is_active', true);

  if (error || !data) {
    console.error('[Webhooks] Error cargando channel_property_map:', error?.message);
    return _mapCache || [];
  }

  _mapCache = data;
  _mapCacheTs = Date.now();
  return data;
}

/**
 * Resuelve la propiedad correcta para un evento Meta.
 * 1. Busca por page_id en channel_property_map
 * 2. Si scope='shared' (ej: WA compartido), devuelve isShared=true → agente pregunta
 * 3. Fallback: primera propiedad activa
 */
async function resolvePropertyForEvent(event, allProperties) {
  const map = await getChannelPropertyMap();

  // Buscar por page_id del evento
  const normalizedChannel = event.channel.replace('_comment', '');
  const match = map.find(m =>
    m.channel === normalizedChannel && m.external_id === String(event.pageId)
  );

  if (match) {
    const prop = allProperties.find(p => p.id === match.property_id);
    if (prop) {
      return {
        property: prop,
        isShared: match.scope === 'shared',
        matchedBy: 'page_id',
      };
    }
  }

  // WhatsApp: también buscar por phone_number_id si pageId no matcheó
  if (normalizedChannel === 'whatsapp') {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const waMatch = map.find(m => m.channel === 'whatsapp' && m.external_id === phoneId);
    if (waMatch) {
      const prop = allProperties.find(p => p.id === waMatch.property_id);
      if (prop) {
        return {
          property: prop,
          isShared: waMatch.scope === 'shared',
          matchedBy: 'phone_number_id',
        };
      }
    }
  }

  // Fallback: primera propiedad
  return {
    property: allProperties[0],
    isShared: allProperties.length > 1,
    matchedBy: 'fallback',
  };
}

// ── GET /api/webhooks/meta — verificación ──────────────
router.get('/meta', (req, res) => {
  const {
    'hub.mode': mode,
    'hub.verify_token': token,
    'hub.challenge': challenge,
  } = req.query;

  const result = verifyMetaWebhook(mode, token, challenge);
  if (result.valid) {
    console.log(JSON.stringify({ level: 'info', event: 'meta_webhook_verified' }));
    return res.status(200).send(result.challenge);
  }
  res.status(403).json({ error: 'verification_failed' });
});

// ── POST /api/webhooks/meta — recibir eventos ──────────
router.post('/meta', express.json(), async (req, res) => {
  // Validar firma HMAC si está configurada
  const sig = req.headers['x-hub-signature-256'];
  if (sig && process.env.META_APP_SECRET) {
    const expected =
      'sha256=' +
      crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
    if (sig !== expected) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  }

  // Responder 200 inmediatamente — Meta exige respuesta rápida
  res.status(200).json({ status: 'received' });

  // Procesar asíncronamente
  processMetaEvents(req.body).catch(e =>
    console.error(JSON.stringify({ level: 'error', event: 'meta_webhook_process_error', error: e.message }))
  );
});

async function processMetaEvents(body) {
  const events = parseMetaWebhook(body);
  if (!events.length) return;

  // Obtener propiedades activas del tenant (hasta 10)
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, tenant_id, slug')
    .eq('is_active', true)
    .limit(10);

  if (!properties?.length) return;

  for (const event of events) {
    try {
      // ── Ruteo automático por page_id ──
      const { property, isShared, matchedBy } = await resolvePropertyForEvent(event, properties);

      console.log(JSON.stringify({
        level: