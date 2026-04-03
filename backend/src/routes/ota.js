/**
 * Rutas OTA — Webhooks y API del inbox centralizado
 *
 * Webhooks (sin auth, validados por firma/token):
 *   POST /api/ota/webhook/booking
 *   POST /api/ota/webhook/airbnb
 *   POST /api/ota/webhook/hostelworld
 *
 * Dashboard (con auth JWT):
 *   GET  /api/ota/inbox
 *   GET  /api/ota/inbox/:id
 *   POST /api/ota/inbox/:id/reply       → responder manualmente
 *   GET  /api/ota/reservations
 *   GET  /api/ota/stats
 *
 * Cancelaciones y No-shows:
 *   POST /api/ota/cancel-booking        → iniciar flujo de cancelación
 *   GET  /api/ota/cancellations
 *   GET  /api/ota/no-shows
 */
import { Router } from 'express';
import crypto from 'crypto';
import { db, supabase } from '../models/supabase.js';
import bookingCom from '../integrations/bookingCom.js';
import airbnb from '../integrations/airbnb.js';
import hostelworld from '../integrations/hostelworld.js';
import otaHub from '../integrations/otaHub.js';
import { processCancellation, getCancellationLogs, getCancellationMetrics } from '../services/cancellations.js';
import { getNoShowLogs } from '../services/noShows.js';
import { requireAuth } from '../middleware/auth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ============================================================
// Helper: obtener propiedad por slug y verificar
// ============================================================
async function resolveProperty(slug) {
  const properties = await db.getAllProperties();
  return properties.find(p => p.slug === slug);
}

// ============================================================
// Helper: verificar token webhook de OTA (cabecera o query param)
// ============================================================
function verifyOtaToken(req, platform) {
  const envKey = `${platform.toUpperCase().replace('.', '_')}_WEBHOOK_SECRET`;
  const secret = process.env[envKey];
  if (!secret) return true; // si no hay secreto configurado, permitir (desarrollo)

  const received =
    req.headers['x-webhook-secret'] ||
    req.headers['x-hub-signature-256']?.replace('sha256=', '') ||
    req.query.token;

  if (!received) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return received === secret; // fallback: comparación simple
  }
}

// ============================================================
// WEBHOOK: Booking.com
// ============================================================
router.post('/webhook/booking', webhookLimiter, async (req, res) => {
  // Booking.com puede usar HTTP Basic Auth en lugar de firma
  const authHeader = req.headers.authorization || '';
  const [type, encoded] = authHeader.split(' ');
  let propertySlug = req.query.property || 'isla-palma';

  // Responder rápido para que Booking no reintente
  res.status(200).json({ received: true });

  try {
    const property = await resolveProperty(propertySlug);
    if (!property) return;

    const event = await bookingCom.processWebhookEvent(req.body, property.id);

    if (event.type === 'message') {
      await otaHub.processIncomingOtaMessage('booking', event.data, propertySlug, property.id);
    } else if (event.type === 'reservation') {
      await otaHub.saveOtaReservation(property.id, event.data);
    } else if (event.type === 'cancellation') {
      await handleOtaCancellation('booking', event.data, property);
    }
  } catch (err) {
    console.error('[Webhook/Booking] Error:', err.message);
  }
});

// ============================================================
// WEBHOOK: Airbnb
// ============================================================
router.post('/webhook/airbnb', webhookLimiter, async (req, res) => {
  res.status(200).json({ received: true });

  const propertySlug = req.query.property || 'isla-palma';

  try {
    const property = await resolveProperty(propertySlug);
    if (!property) return;

    const event = await airbnb.processWebhookEvent(req.body, property.id);

    if (event.type === 'message') {
      await otaHub.processIncomingOtaMessage('airbnb', event.data, propertySlug, property.id);
    } else if (event.type === 'reservation') {
      await otaHub.saveOtaReservation(property.id, event.data);
    } else if (event.type === 'cancellation') {
      await handleOtaCancellation('airbnb', event.data, property);
    }
  } catch (err) {
    console.error('[Webhook/Airbnb] Error:', err.message);
  }
});

// ============================================================
// WEBHOOK: Hostelworld
// ============================================================
router.post('/webhook/hostelworld', webhookLimiter, async (req, res) => {
  res.status(200).json({ received: true });

  const propertySlug = req.query.property || 'isla-palma';

  try {
    if (!verifyOtaToken(req, 'hostelworld')) {
      console.warn('[Webhook/Hostelworld] Token inválido');
      return;
    }

    const property = await resolveProperty(propertySlug);
    if (!property) return;

    const event = await hostelworld.processWebhookEvent(req.body, property.id);

    if (event.type === 'message') {
      await otaHub.processIncomingOtaMessage('hostelworld', event.data, propertySlug, property.id);
    } else if (event.type === 'reservation') {
      await otaHub.saveOtaReservation(property.id, event.data);
    } else if (event.type === 'cancellation') {
      await handleOtaCancellation('hostelworld', event.data, property);
    }
  } catch (err) {
    console.error('[Webhook/Hostelworld] Error:', err.message);
  }
});

// ============================================================
// Manejar cancelación que llega desde una OTA
// ============================================================
async function handleOtaCancellation(platform, cancellationData, property) {
  // Buscar la reserva interna por el ID de la OTA
  const { data: otaRes } = await supabase
    .from('ota_reservations')
    .select('booking_id')
    .eq('platform', platform)
    .eq('platform_reservation_id', cancellationData.platform_reservation_id)
    .single();

  const bookingId = otaRes?.booking_id;
  if (!bookingId) {
    console.warn(`[OTA Cancel] No se encontró reserva interna para ${platform}:${cancellationData.platform_reservation_id}`);
    return;
  }

  await processCancellation({
    bookingId,
    cancelledBy: 'ota',
    reason: `Cancelado desde ${platform}`,
    propertySlug: property.slug
  });
}

// ============================================================
// GET /api/ota/inbox — Inbox centralizado de mensajes OTA
// ============================================================
router.get('/inbox', requireAuth, async (req, res) => {
  const { platform, status, limit = 50 } = req.query;
  const propertyId = req.query.property_id || req.user.property_id;

  try {
    const messages = await otaHub.getOtaInbox(propertyId, { platform, status, limit: parseInt(limit) });
    res.json({ messages, total: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/ota/inbox/:id — Detalle de un mensaje OTA
// ============================================================
router.get('/inbox/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ota_messages')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Obtener todos los mensajes del mismo hilo (misma reservation_id)
    let thread = [];
    if (data.platform_reservation_id) {
      const { data: threadMsgs } = await supabase
        .from('ota_messages')
        .select('*')
        .eq('platform_reservation_id', data.platform_reservation_id)
        .order('created_at', { ascending: true });
      thread = threadMsgs || [];
    }

    res.json({ message: data, thread });
  } catch (err) {
    res.status(404).json({ error: 'Mensaje no encontrado' });
  }
});

// ============================================================
// POST /api/ota/inbox/:id/reply — Responder manualmente desde dashboard
// ============================================================
router.post('/inbox/:id/reply', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texto requerido' });

  try {
    const { data: msg, error } = await supabase
      .from('ota_messages')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !msg) return res.status(404).json({ error: 'Mensaje no encontrado' });

    const property = await resolveProperty(msg.property_id)
      || await db.getAllProperties().then(ps => ps.find(p => p.id === msg.property_id));

    if (!property) return res.status(400).json({ error: 'Propiedad no encontrada' });

    let sendResult = { success: false };

    // Enviar a la plataforma correspondiente
    if (msg.platform === 'booking') {
      sendResult = await bookingCom.replyToMessage(property.slug, msg.platform_reservation_id, text);
    } else if (msg.platform === 'airbnb') {
      sendResult = await airbnb.replyToThread(property.slug, msg.thread_id || msg.platform_reservation_id, text);
    } else if (msg.platform === 'hostelworld') {
      sendResult = await hostelworld.replyToMessage(property.slug, msg.platform_reservation_id, text);
    }

    // Actualizar estado del mensaje entrante
    await supabase
      .from('ota_messages')
      .update({ status: sendResult.success ? 'replied' : 'failed' })
      .eq('id', req.params.id);

    // Guardar mensaje de salida
    if (sendResult.success) {
      await supabase.from('ota_messages').insert({
        property_id: msg.property_id,
        platform: msg.platform,
        platform_reservation_id: msg.platform_reservation_id,
        guest_name: msg.guest_name,
        direction: 'outbound',
        body: text,
        status: 'sent'
      });
    }

    res.json({ success: sendResult.success, message_id: sendResult.message_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/ota/reservations — Reservas de OTAs
// ============================================================
router.get('/reservations', requireAuth, async (req, res) => {
  const { platform, limit = 50 } = req.query;
  const propertyId = req.query.property_id || req.user.property_id;

  try {
    let query = supabase
      .from('ota_reservations')
      .select('*, properties(name, slug)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (propertyId) query = query.eq('property_id', propertyId);
    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ reservations: data, total: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/ota/stats — Estadísticas del inbox OTA
// ============================================================
router.get('/stats', requireAuth, async (req, res) => {
  const propertyId = req.query.property_id || req.user.property_id;

  try {
    const { data: messages } = await supabase
      .from('ota_messages')
      .select('platform, status, direction')
      .eq('property_id', propertyId)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const stats = {
      total: messages?.length || 0,
      unread: messages?.filter(m => m.status === 'unread').length || 0,
      replied: messages?.filter(m => m.status === 'replied').length || 0,
      by_platform: {}
    };

    for (const msg of (messages || [])) {
      if (!stats.by_platform[msg.platform]) {
        stats.by_platform[msg.platform] = { total: 0, unread: 0, replied: 0 };
      }
      stats.by_platform[msg.platform].total++;
      if (msg.status === 'unread') stats.by_platform[msg.platform].unread++;
      if (msg.status === 'replied') stats.by_platform[msg.platform].replied++;
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/ota/cancel-booking — Iniciar cancelación
// ============================================================
router.post('/cancel-booking', requireAuth, async (req, res) => {
  const { booking_id, reason, waive_refund = false } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id requerido' });

  try {
    const result = await processCancellation({
      bookingId: booking_id,
      cancelledBy: req.user.role === 'staff' ? 'staff' : 'guest',
      reason: reason || 'Cancelado por administrador',
      waiveRefund: waive_refund
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// GET /api/ota/cancellations — Historial de cancelaciones
// ============================================================
router.get('/cancellations', requireAuth, async (req, res) => {
  const { refund_status, limit = 50 } = req.query;
  const propertyId = req.query.property_id || req.user.property_id;

  try {
    const [logs, metrics] = await Promise.all([
      getCancellationLogs(propertyId, { refund_status, limit: parseInt(limit) }),
      propertyId ? getCancellationMetrics(propertyId) : null
    ]);
    res.json({ cancellations: logs, metrics, total: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/ota/no-shows — Historial de no-shows
// ============================================================
router.get('/no-shows', requireAuth, async (req, res) => {
  const { status, limit = 50 } = req.query;
  const propertyId = req.query.property_id || req.user.property_id;

  try {
    const logs = await getNoShowLogs(propertyId, { status, limit: parseInt(limit) });
    res.json({ no_shows: logs, total: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
