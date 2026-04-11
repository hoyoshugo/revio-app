/**
 * Webhooks unificados — Meta (WhatsApp + Instagram + Facebook)
 * Todos los mensajes entrantes pasan por aquí y se procesan con el agente IA.
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
      // Por defecto usar la primera propiedad (el agente pregunta al cliente cuál)
      const property = properties[0];

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

      // Procesar con el agente IA
      const sessionId = event.channel + '_' + event.senderId;
      const response = await processMessage(
        sessionId,
        event.message,
        property.id,
        {
          channel: event.channel,
          senderName: event.senderName,
          tenantId: property.tenant_id,
          isMultiProperty: properties.length > 1,
          allProperties: properties,
        }
      );

      if (!response?.message) continue;

      // Responder por el mismo canal
      switch (event.channel) {
        case 'whatsapp':
          await sendMessage('whatsapp', event.senderId, response.message);
          break;
        case 'instagram':
          await sendMessage('instagram', event.senderId, response.message);
          break;
        case 'facebook':
          await sendMessage('facebook', event.senderId, response.message);
          break;
        case 'instagram_comment':
          await replyToInstagramComment(event.commentId, response.message);
          break;
        case 'facebook_comment':
          await replyToFacebookComment(event.commentId, response.message);
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

export default router;
