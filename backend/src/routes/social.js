/**
 * Rutas para webhooks y gestion de redes sociales
 */
import { Router } from 'express';
import crypto from 'crypto';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import instagram from '../integrations/instagram.js';
import facebook from '../integrations/facebook.js';
import tiktok from '../integrations/tiktok.js';
import googleBusiness from '../integrations/googleBusiness.js';
import tripadvisor from '../integrations/tripadvisor.js';
import { processIncomingOtaMessage } from '../integrations/otaHub.js';
import { getHealthStatus, getHealthHistory } from '../services/healthMonitor.js';
import { getKnowledgeBase, upsertKnowledge, deleteKnowledge, processStaffReply } from '../services/learningEngine.js';
import { getEscalations, resolveEscalation, resumeFromMessage } from '../services/escalation.js';

const router = Router();

let propertiesCache = null;
async function getProperties() {
  if (!propertiesCache) {
    const { data } = await supabase.from('properties').select('id, slug');
    propertiesCache = data || [];
  }
  return propertiesCache;
}

async function resolvePropertyId(slug) {
  const props = await getProperties();
  return props.find(p => p.slug === slug)?.id;
}

// WEBHOOK META (Instagram + Facebook)
router.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || 'mystica_webhook_2026')) {
    console.log('[Social] Meta webhook verificado');
    return res.send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhook/meta', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (signature && process.env.META_APP_SECRET) {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (signature !== expected) {
      console.warn('[Social] Firma Meta invalida');
      return res.sendStatus(401);
    }
  }
  res.sendStatus(200);
  const payload = req.body;
  const object = payload.object;
  try {
    if (object === 'instagram') {
      const properties = await getProperties();
      for (const prop of properties) {
        const events = instagram.processWebhookEvent(payload, prop.id);
        for (const ev of events) {
          await processIncomingOtaMessage('instagram', ev.data, prop.slug, prop.id);
        }
      }
    } else if (object === 'page') {
      const properties = await getProperties();
      for (const prop of properties) {
        const events = facebook.processWebhookEvent(payload, prop.id);
        for (const ev of events) {
          await processIncomingOtaMessage('facebook', ev.data, prop.slug, prop.id);
        }
      }
    }
  } catch (err) {
    console.error('[Social] Error procesando webhook Meta:', err.message);
  }
});

// WEBHOOK TIKTOK
router.post('/webhook/tiktok', async (req, res) => {
  res.sendStatus(200);
  try {
    const properties = await getProperties();
    for (const prop of properties) {
      const events = tiktok.processWebhookEvent(req.body, prop.id);
      for (const ev of events) {
        await processIncomingOtaMessage('tiktok', ev.data, prop.slug, prop.id);
      }
    }
  } catch (err) {
    console.error('[Social] Error procesando webhook TikTok:', err.message);
  }
});

// BANDEJA UNIFICADA SOCIAL
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const { platform, status, limit = 50, property_id } = req.query;
    let query = supabase
      .from('ota_messages')
      .select('*')
      .in('platform', ['instagram', 'facebook', 'tiktok', 'google', 'tripadvisor', 'booking', 'airbnb', 'hostelworld', 'expedia'])
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (platform) query = query.eq('platform', platform);
    if (status) query = query.eq('status', status);
    if (property_id) query = query.eq('property_id', property_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESPONDER DESDE EL DASHBOARD
router.post('/reply', requireAuth, async (req, res) => {
  const { message_id, platform, slug, reply_text, extra, property_id } = req.body;

  if (!message_id || !platform || !reply_text || (!slug && !property_id)) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  let resolvedPropertyId = property_id;
  if (!resolvedPropertyId && slug) {
    resolvedPropertyId = await resolvePropertyId(slug);
  }

  let result;
  try {
    switch (platform) {
      case 'instagram':
        result = await instagram.replyToMessage(slug, message_id, reply_text);
        break;
      case 'facebook':
        result = await facebook.replyToDM(slug, message_id, reply_text);
        break;
      case 'tiktok':
        result = await tiktok.replyToMessage(slug, message_id, reply_text, extra || {});
        break;
      case 'google':
        result = await googleBusiness.replyToMessage(resolvedPropertyId, message_id, reply_text);
        break;
      case 'tripadvisor':
        result = await tripadvisor.replyToMessage(slug, message_id, reply_text);
        break;
      default:
        return res.status(400).json({ error: `Plataforma no soportada: ${platform}` });
    }

    if (result?.success) {
      await supabase
        .from('ota_messages')
        .update({
          status: 'replied',
          ai_reply_sent: false,
          ai_reply_body: reply_text,
          ai_reply_at: new Date().toISOString()
        })
        .eq('id', message_id);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HEALTH MONITOR
router.get('/health', requireAuth, (_req, res) => {
  res.json(getHealthStatus());
});

router.get('/health/history', requireAuth, async (req, res) => {
  try {
    const data = await getHealthHistory(req.query.service, parseInt(req.query.limit) || 100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KNOWLEDGE BASE
router.get('/knowledge', requireAuth, async (req, res) => {
  try {
    const data = await getKnowledgeBase(req.query.property_id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/knowledge', requireAuth, async (req, res) => {
  try {
    const data = await upsertKnowledge({ ...req.body, created_by: req.user?.email || 'dashboard' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const data = await upsertKnowledge({ id: req.params.id, ...req.body });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    await deleteKnowledge(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ESCALACIONES
router.get('/escalations', requireAuth, async (req, res) => {
  try {
    const data = await getEscalations(req.query.property_id, req.query.status);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/escalations/:id/resolve', requireAuth, async (req, res) => {
  try {
    const success = await resolveEscalation(req.params.id, req.user?.email || 'dashboard');
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WEBHOOK WHATSAPP LEARNING
router.post('/webhook/whatsapp-learning', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const messages = change?.value?.messages;
    if (!messages?.length) return;
    for (const msg of messages) {
      if (msg.type !== 'text') continue;
      const from = '+' + msg.from;
      const text = msg.text?.body || '';
      const resumed = await resumeFromMessage(text, from);
      if (resumed) continue;
      await processStaffReply(from, text, msg.id);
    }
  } catch (err) {
    console.error('[Social] Error en webhook WhatsApp learning:', err.message);
  }
});

export default router;
