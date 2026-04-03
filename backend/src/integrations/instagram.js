/**
 * Instagram Graph API — DMs y comentarios
 * Docs: https://developers.facebook.com/docs/instagram-api
 *
 * .env requerido:
 *   INSTAGRAM_ACCESS_TOKEN_ISLA=pendiente    (Page Access Token de larga duración)
 *   INSTAGRAM_ACCOUNT_ID_ISLA=pendiente      (Instagram Business Account ID)
 *   INSTAGRAM_ACCESS_TOKEN_TAYRONA=pendiente
 *   INSTAGRAM_ACCOUNT_ID_TAYRONA=pendiente
 *   META_APP_SECRET=pendiente                (para verificar webhooks)
 *   META_VERIFY_TOKEN=mystica_webhook_2026   (token personalizado para verificación)
 */
import axios from 'axios';
import crypto from 'crypto';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

const CREDENTIALS = {
  'isla-palma': {
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN_ISLA,
    account_id: process.env.INSTAGRAM_ACCOUNT_ID_ISLA
  },
  tayrona: {
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN_TAYRONA,
    account_id: process.env.INSTAGRAM_ACCOUNT_ID_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.access_token && CREDENTIALS[slug]?.access_token !== 'pendiente');

function client(slug) {
  return axios.create({
    baseURL: GRAPH_URL,
    params: { access_token: CREDENTIALS[slug].access_token },
    timeout: 15000
  });
}

// ============================================================
// Verificación del webhook Meta (GET)
// ============================================================
export function verifyWebhook(mode, token, challenge) {
  const verifyToken = process.env.META_VERIFY_TOKEN || 'mystica_webhook_2026';
  if (mode === 'subscribe' && token === verifyToken) return challenge;
  return null;
}

// ============================================================
// Verificar firma del webhook (POST)
// ============================================================
export function verifySignature(rawBody, signature) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signature) return true; // sin secreto configurado: permitir
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
}

// ============================================================
// Responder un DM de Instagram
// ============================================================
export async function replyToDM(slug, recipientId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'instagram_not_configured' };
  const { account_id } = CREDENTIALS[slug];
  try {
    const { data } = await client(slug).post(`/${account_id}/messages`, {
      recipient: { id: recipientId },
      message: { text }
    });
    return { success: true, message_id: data.message_id };
  } catch (err) {
    console.error('[Instagram] Error DM:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

// ============================================================
// Responder un comentario en Instagram
// ============================================================
export async function replyToComment(slug, commentId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'instagram_not_configured' };
  try {
    const { data } = await client(slug).post(`/${commentId}/replies`, { message: text });
    return { success: true, comment_id: data.id };
  } catch (err) {
    console.error('[Instagram] Error comentario:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Procesar evento del webhook de Instagram
// ============================================================
export function processWebhookEvent(payload, propertyId) {
  const entries = payload.entry || [];
  const results = [];

  for (const entry of entries) {
    // DMs (Messaging)
    for (const msg of entry.messaging || []) {
      if (msg.message && !msg.message.is_echo) {
        results.push({
          type: 'message',
          data: {
            property_id: propertyId,
            platform: 'instagram',
            sub_type: 'dm',
            platform_message_id: msg.message.mid,
            platform_reservation_id: null,
            guest_id: msg.sender?.id,
            guest_name: 'Usuario Instagram',
            direction: 'inbound',
            body: msg.message.text || '[adjunto]',
            raw_payload: msg,
            status: 'unread'
          }
        });
      }
    }

    // Comentarios
    for (const change of entry.changes || []) {
      if (change.field === 'comments' && change.value?.text) {
        const v = change.value;
        results.push({
          type: 'comment',
          data: {
            property_id: propertyId,
            platform: 'instagram',
            sub_type: 'comment',
            platform_message_id: v.id,
            platform_reservation_id: null,
            guest_id: v.from?.id,
            guest_name: v.from?.name || 'Usuario',
            direction: 'inbound',
            body: v.text,
            media_id: v.media?.id,
            raw_payload: v,
            status: 'unread'
          }
        });
      }
    }
  }
  return results;
}

export default { verifyWebhook, verifySignature, replyToDM, replyToComment, processWebhookEvent, CONFIGURED };
