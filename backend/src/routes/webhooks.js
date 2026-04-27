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
import {
  transcribeWhatsAppAudio,
  replyWithVoice,
  isVoiceConfigured,
} from '../services/voiceService.js';

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

  // E-AGENT-10 H-AGT-3 (2026-04-26): NO fallback ciego a properties[0].
  // Antes routeaba mensajes al primer tenant del DB cuando no había match,
  // causando cross-tenant leak de mensajes. Ahora retorna null y el caller
  // descarta el evento con log de warning.
  return {
    property: null,
    isShared: false,
    matchedBy: 'no_match',
  };
}

// E-AGENT-10 B-AGT-1 (2026-04-26): deduplicación de webhook events.
// Meta reintenta cualquier webhook que no responda 2xx en 20s, además de su
// propio backoff. Antes processMetaEvents podía crear reservas duplicadas
// (confirm_booking llamado N veces para el mismo messageId). Ahora insertamos
// el messageId en webhook_events con UNIQUE constraint; si ya existe, skip.
//
// Tabla esperada (DDL):
//   CREATE TABLE webhook_events (
//     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     provider        text NOT NULL,    -- 'meta' | 'wompi' | 'lobbypms'
//     external_id     text NOT NULL,    -- messageId / transactionId
//     received_at     timestamptz NOT NULL DEFAULT now(),
//     payload         jsonb,
//     UNIQUE(provider, external_id)
//   );
async function isDuplicateEvent(provider, externalId, payload) {
  if (!externalId) return false;
  try {
    const { error } = await supabase
      .from('webhook_events')
      .insert({ provider, external_id: externalId, payload: payload || null });
    if (error) {
      // Postgres unique violation = 23505 (Supabase los expone como code "23505")
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        return true;
      }
      // Tabla puede no existir todavía — log y continuar (NO bloquear)
      console.warn('[webhooks] dedupe insert failed (continuing):', error.message);
      return false;
    }
    return false;
  } catch (err) {
    console.warn('[webhooks] dedupe check error (continuing):', err.message);
    return false;
  }
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
// E-AGENT-9 H-SEC-1 (2026-04-26): rechazo si META_APP_SECRET está seteado
// pero la firma falta o no matchea. Antes la validación era opt-in
// (cualquiera podía forjar eventos omitiendo el header).
router.post('/meta', express.json({ limit: '512kb' }), async (req, res) => {
  const sig = req.headers['x-hub-signature-256'];
  const secret = process.env.META_APP_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (secret) {
    if (!sig) {
      return res.status(401).json({ error: 'signature_required' });
    }
    const expected =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    // Comparación constant-time para evitar timing attacks
    let match = false;
    try {
      match = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      match = false;
    }
    if (!match) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  } else if (isProd) {
    // Fail closed en producción si el secret no está configurado
    console.error('[webhooks/meta] META_APP_SECRET no configurado en producción');
    return res.status(503).json({ error: 'webhook_misconfigured' });
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
      // ── Deduplicación: skip si ya procesamos este messageId ──
      const externalId = event.messageId || event.commentId || null;
      if (externalId && await isDuplicateEvent('meta', externalId, event)) {
        console.log(JSON.stringify({
          level: 'info',
          event: 'meta_event_dedup_skip',
          messageId: externalId,
          channel: event.channel,
        }));
        continue;
      }

      // ── Ruteo automático por page_id ──
      const { property, isShared, matchedBy } = await resolvePropertyForEvent(event, properties);

      // E-AGENT-10 H-AGT-3: rechazar si no hay match (antes routeaba a properties[0])
      if (!property) {
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'meta_event_no_property_match',
          channel: event.channel,
          pageId: event.pageId,
          message: 'Mensaje descartado: ningún property mapeado para este page_id/phone_number_id. Configurar en channel_property_map.',
        }));
        continue;
      }

      console.log(JSON.stringify({
        level: 'info',
        event: 'meta_event_routed',
        channel: event.channel,
        pageId: event.pageId,
        propertyId: property.id,
        propertySlug: property.slug,
        matchedBy,
        isShared,
      }));

      // CRM: guardar contacto
      await saveContact(property.tenant_id, {
        name: event.senderName,
        phone: event.channel === 'whatsapp' ? event.senderId : null,
        source: event.channel,
        language: 'es',
      });

      // Inbox unificado: registrar el mensaje entrante
      const normalizedChannel = event.channel.replace('_comment', '');
      await insertInboxMessage({
        property_id: property.id,
        channel_key: normalizedChannel,
        external_thread_id: event.messageId || event.commentId || null,
        sender_name: event.senderName || null,
        sender_id: event.senderId || null,
        message_text: event.message || null,
        direction: 'inbound',
        status: 'unread',
        raw_payload: event,
      });

      // Verificar tenant habilitado (pago o manual)
      const access = await isTenantEnabled(property.tenant_id);
      if (!access.enabled) {
        console.log(JSON.stringify({
          level: 'warn',
          event: 'tenant_disabled_message_ignored',
          tenantId: property.tenant_id,
          reason: access.reason,
        }));
        continue;
      }

      // E-AGENT-14 (2026-04-26): transcripción de audio entrante via Whisper.
      // Si el huésped envió una nota de voz Y OpenAI está configurado, la
      // transcribimos y mandamos el TEXTO al agente (en lugar del placeholder
      // "[el huésped envió una nota de voz...]"). Marcamos también que la
      // respuesta debe ir en voz cuando sea posible.
      let messageForAgent = event.message;
      let respondWithVoice = false;
      const replyOpts = getReplyTokenForProperty(property, event.channel);

      if (
        event.channel === 'whatsapp' &&
        (event.mediaType === 'audio' || event.mediaType === 'voice') &&
        event.mediaId &&
        isVoiceConfigured()
      ) {
        try {
          const transcription = await transcribeWhatsAppAudio(event.mediaId, {
            token: replyOpts.token,
            languageHint: 'es', // detectLanguage del agente refina luego
          });
          if (transcription.text && transcription.text.trim().length > 0) {
            messageForAgent = transcription.text;
            respondWithVoice = true;
            console.log(JSON.stringify({
              level: 'info',
              event: 'voice_transcribed',
              durationSec: transcription.durationSec,
              detectedLang: transcription.language,
              chars: transcription.text.length,
              propertyId: property.id,
            }));
            // Re-registrar en inbox con el texto transcrito (para que el agente
            // del dashboard vea el contenido real, no [VOZ])
            try {
              await insertInboxMessage({
                property_id: property.id,
                channel_key: 'whatsapp',
                external_thread_id: event.messageId,
                sender_name: event.senderName || null,
                sender_id: event.senderId || null,
                message_text: `🎙️ ${transcription.text}`,
                direction: 'inbound',
                status: 'unread',
                raw_payload: { ...event, transcription: transcription.text },
              });
            } catch { /* ignore double-insert */ }
          }
        } catch (transcribeErr) {
          console.error('[Webhook] Whisper falló, usando placeholder original:', transcribeErr.message);
          // Fallback: dejar el placeholder original "[NOTA DE VOZ...]" para
          // que el agente al menos no quede mudo.
        }
      }

      // Procesar con el agente IA
      const sessionId = event.channel + '_' + event.senderId;
      const response = await processMessage(
        sessionId,
        messageForAgent,
        property.id,
        {
          channel: event.channel,
          senderName: event.senderName,
          tenantId: property.tenant_id,
          isMultiProperty: properties.length > 1,
          isSharedChannel: isShared,
          allProperties: properties,
          resolvedProperty: property.slug,
          incomingWasVoice: respondWithVoice,
        }
      );

      if (!response?.message) continue;

      // Responder por el mismo canal
      switch (event.channel) {
        case 'whatsapp': {
          // E-AGENT-14: si el huésped envió audio, responder con audio.
          // replyWithVoice maneja internamente:
          //   - skip si OPENAI_API_KEY falta → fallback a texto
          //   - skip si la respuesta excede VOICE_REPLY_MAX_CHARS → texto
          //   - skip si la síntesis falla → texto
          let voiceSent = false;
          if (respondWithVoice) {
            const voiceRes = await replyWithVoice(event.senderId, response.message, {
              phoneNumberId: event.phoneNumberId || replyOpts.phoneId,
              token: replyOpts.token,
            });
            voiceSent = voiceRes && voiceRes.success === true;
            if (!voiceSent) {
              console.log(JSON.stringify({
                level: 'info',
                event: 'voice_reply_fallback_to_text',
                reason: voiceRes?.reason || voiceRes?.error || 'unknown',
              }));
            }
          }
          if (!voiceSent) {
            await sendMessage('whatsapp', event.senderId, response.message, replyOpts);
          }
          break;
        }
        case 'instagram':
          await sendMessage('instagram', event.senderId, response.message, replyOpts);
          break;
        case 'facebook':
          await sendMessage('facebook', event.senderId, response.message, replyOpts);
          break;
        case 'instagram_comment':
          await replyToInstagramComment(event.commentId, response.message, replyOpts.token);
          break;
        case 'facebook_comment':
          await replyToFacebookComment(event.commentId, response.message, replyOpts.token);
          break;
      }
    } catch (e) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'meta_event_processing_error',
        channel: event.channel,
        error: e.message,
      }));
    }
  }
}

/**
 * Obtiene el token correcto para responder según la propiedad.
 * Facebook Pages de Tayrona usan FACEBOOK_PAGE_TOKEN_TAYRONA.
 * WhatsApp compartido usa el token global.
 */
function getReplyTokenForProperty(property, channel) {
  const slug = property.slug;

  if (channel === 'whatsapp') {
    // WhatsApp compartido: siempre el mismo token y phone_id
    return {
      token: process.env.WHATSAPP_TOKEN || process.env.FACEBOOK_PAGE_TOKEN,
      phoneId: process.env.WHATSAPP_PHONE_ID,
    };
  }

  // Facebook/Instagram: token específico por página
  if (slug === 'tayrona') {
    return { token: process.env.FACEBOOK_PAGE_TOKEN_TAYRONA };
  }

  // Default (Isla Palma u otras)
  return { token: process.env.FACEBOOK_PAGE_TOKEN };
}

// Exportar para testing
export { resolvePropertyForEvent, getReplyTokenForProperty };
export default router;
