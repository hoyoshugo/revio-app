/**
 * Facebook Graph API — DMs, comentarios y reseñas de Page
 * Docs: https://developers.facebook.com/docs/graph-api
 *
 * .env requerido:
 *   FACEBOOK_PAGE_TOKEN_ISLA=pendiente      (Page Access Token)
 *   FACEBOOK_PAGE_ID_ISLA=pendiente
 *   FACEBOOK_PAGE_TOKEN_TAYRONA=pendiente
 *   FACEBOOK_PAGE_ID_TAYRONA=pendiente
 *   META_APP_SECRET=pendiente
 *   META_VERIFY_TOKEN=mystica_webhook_2026
 */
import axios from 'axios';
import instagram from './instagram.js'; // comparte verifyWebhook y verifySignature

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

const CREDENTIALS = {
  'isla-palma': {
    page_token: process.env.FACEBOOK_PAGE_TOKEN_ISLA,
    page_id: process.env.FACEBOOK_PAGE_ID_ISLA
  },
  tayrona: {
    page_token: process.env.FACEBOOK_PAGE_TOKEN_TAYRONA,
    page_id: process.env.FACEBOOK_PAGE_ID_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.page_token && CREDENTIALS[slug]?.page_token !== 'pendiente');

// Reusar verificación de webhook de instagram (misma plataforma Meta)
export const verifyWebhook = instagram.verifyWebhook;
export const verifySignature = instagram.verifySignature;

function client(slug) {
  return axios.create({
    baseURL: GRAPH_URL,
    params: { access_token: CREDENTIALS[slug].page_token },
    timeout: 15000
  });
}

// ============================================================
// Responder un mensaje (DM via Messenger)
// ============================================================
export async function replyToDM(slug, recipientId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'facebook_not_configured' };
  try {
    const { data } = await client(slug).post('/me/messages', {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE'
    });
    return { success: true, message_id: data.message_id };
  } catch (err) {
    console.error('[Facebook] Error DM:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

// ============================================================
// Responder un comentario en una publicación
// ============================================================
export async function replyToComment(slug, commentId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'facebook_not_configured' };
  try {
    const { data } = await client(slug).post(`/${commentId}/comments`, { message: text });
    return { success: true, comment_id: data.id };
  } catch (err) {
    console.error('[Facebook] Error comentario:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Responder una reseña de Facebook
// ============================================================
export async function replyToReview(slug, reviewId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'facebook_not_configured' };
  try {
    const { data } = await client(slug).post(`/${reviewId}/comments`, { message: text });
    return { success: true, comment_id: data.id };
  } catch (err) {
    console.error('[Facebook] Error reseña:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Obtener reseñas recientes no respondidas
// ============================================================
export async function getUnreadReviews(slug) {
  if (!CONFIGURED(slug)) return [];
  const { page_id } = CREDENTIALS[slug];
  try {
    const { data } = await client(slug).get(`/${page_id}/ratings`, {
      params: { fields: 'reviewer,rating,review_text,created_time,has_rating,has_review', limit: 20 }
    });
    return (data.data || [])
      .filter(r => r.has_review && r.review_text)
      .map(r => ({
        platform: 'facebook',
        sub_type: 'review',
        platform_message_id: r.id,
        platform_reservation_id: null,
        guest_name: r.reviewer?.name || 'Usuario Facebook',
        guest_id: r.reviewer?.id,
        body: `⭐ ${r.rating}/5\n${r.review_text}`,
        received_at: r.created_time,
        raw: r
      }));
  } catch (err) {
    console.error('[Facebook] Error reseñas:', err.message);
    return [];
  }
}

// ============================================================
// Procesar evento del webhook de Facebook
// ============================================================
export function processWebhookEvent(payload, propertyId) {
  const entries = payload.entry || [];
  const results = [];

  for (const entry of entries) {
    // Mensajes (Messenger)
    for (const msg of entry.messaging || []) {
      if (msg.message && !msg.message.is_echo) {
        results.push({
          type: 'message',
          data: {
            property_id: propertyId, platform: 'facebook', sub_type: 'dm',
            platform_message_id: msg.message.mid,
            guest_id: msg.sender?.id, guest_name: 'Usuario Facebook',
            direction: 'inbound', body: msg.message.text || '[adjunto]',
            raw_payload: msg, status: 'unread'
          }
        });
      }
    }

    // Comentarios en publicaciones
    for (const change of entry.changes || []) {
      if (change.field === 'feed' && change.value?.item === 'comment') {
        const v = change.value;
        results.push({
          type: 'comment',
          data: {
            property_id: propertyId, platform: 'facebook', sub_type: 'comment',
            platform_message_id: v.comment_id,
            guest_id: v.sender_id, guest_name: v.sender_name || 'Usuario',
            direction: 'inbound', body: v.message,
            parent_id: v.post_id, raw_payload: v, status: 'unread'
          }
        });
      }
      // Reseñas
      if (change.field === 'ratings') {
        const v = change.value;
        results.push({
          type: 'review',
          data: {
            property_id: propertyId, platform: 'facebook', sub_type: 'review',
            platform_message_id: v.review_id || v.open_graph_story_id,
            guest_name: v.reviewer?.name || 'Usuario',
            direction: 'inbound',
            body: `⭐ ${v.rating_type || v.rating}/5\n${v.review_text || '(sin texto)'}`,
            raw_payload: v, status: 'unread'
          }
        });
      }
    }
  }
  return results;
}

export default {
  verifyWebhook, verifySignature, replyToDM, replyToComment, replyToReview,
  getUnreadReviews, processWebhookEvent, CONFIGURED
};
