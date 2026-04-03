/**
 * TikTok for Developers API — Comentarios en videos
 * Docs: https://developers.tiktok.com/doc/tiktok-api-v2-comment
 *
 * .env requerido:
 *   TIKTOK_CLIENT_KEY=pendiente
 *   TIKTOK_CLIENT_SECRET=pendiente
 *   TIKTOK_ACCESS_TOKEN_ISLA=pendiente
 *   TIKTOK_OPEN_ID_ISLA=pendiente
 *   TIKTOK_ACCESS_TOKEN_TAYRONA=pendiente
 *   TIKTOK_OPEN_ID_TAYRONA=pendiente
 */
import axios from 'axios';

const TT_API = 'https://open.tiktokapis.com/v2';

const CREDENTIALS = {
  'isla-palma': {
    access_token: process.env.TIKTOK_ACCESS_TOKEN_ISLA,
    open_id: process.env.TIKTOK_OPEN_ID_ISLA
  },
  tayrona: {
    access_token: process.env.TIKTOK_ACCESS_TOKEN_TAYRONA,
    open_id: process.env.TIKTOK_OPEN_ID_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.access_token && CREDENTIALS[slug]?.access_token !== 'pendiente');

function client(slug) {
  return axios.create({
    baseURL: TT_API,
    headers: { Authorization: `Bearer ${CREDENTIALS[slug].access_token}`, 'Content-Type': 'application/json' },
    timeout: 15000
  });
}

// ============================================================
// Obtener videos recientes y sus comentarios no respondidos
// ============================================================
export async function getUnreadComments(slug) {
  if (!CONFIGURED(slug)) return [];
  const { open_id } = CREDENTIALS[slug];
  try {
    // 1. Obtener videos recientes
    const { data: videoData } = await client(slug).post('/video/list/', {
      fields: ['id', 'title', 'create_time'],
      filters: { video_ids: [] }
    }, { params: { open_id } });

    const videos = videoData.data?.videos || [];
    const comments = [];

    // 2. Para cada video, obtener comentarios no respondidos
    for (const video of videos.slice(0, 5)) { // últimos 5 videos
      try {
        const { data: cmtData } = await client(slug).post('/comment/list/', {
          video_id: video.id,
          fields: ['id', 'text', 'like_count', 'reply_count', 'create_time', 'owner'],
          sort_type: 0
        }, { params: { open_id } });

        for (const cmt of (cmtData.data?.comments || [])) {
          comments.push({
            platform: 'tiktok',
            sub_type: 'comment',
            platform_message_id: cmt.id,
            platform_reservation_id: null,
            guest_name: cmt.owner?.display_name || 'Usuario TikTok',
            guest_id: cmt.owner?.open_id,
            body: cmt.text,
            video_id: video.id,
            received_at: new Date(cmt.create_time * 1000).toISOString(),
            raw: cmt
          });
        }
      } catch { /* continuar con el siguiente video */ }
    }
    return comments;
  } catch (err) {
    console.error('[TikTok] Error comentarios:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder un comentario en TikTok
// ============================================================
export async function replyToComment(slug, videoId, commentId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'tiktok_not_configured' };
  const { open_id } = CREDENTIALS[slug];
  try {
    const { data } = await client(slug).post('/comment/reply/', {
      video_id: videoId, comment_id: commentId, text
    }, { params: { open_id } });
    return { success: true, comment_id: data.data?.comment?.id };
  } catch (err) {
    console.error('[TikTok] Error respondiendo:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

export async function getUnreadMessages(slug) {
  return getUnreadComments(slug);
}

export async function replyToMessage(slug, messageId, text, extra = {}) {
  return replyToComment(slug, extra.video_id || '', messageId, text);
}

// Procesar webhook de TikTok (notificaciones de comentarios nuevos)
export function processWebhookEvent(payload, propertyId) {
  const data = payload.data || {};
  if (payload.event === 'comment.new') {
    return [{
      type: 'comment',
      data: {
        property_id: propertyId, platform: 'tiktok', sub_type: 'comment',
        platform_message_id: data.comment_id,
        guest_id: data.user?.open_id,
        guest_name: data.user?.display_name || 'Usuario TikTok',
        direction: 'inbound', body: data.text,
        video_id: data.video_id, raw_payload: payload, status: 'unread'
      }
    }];
  }
  return [];
}

export default { getUnreadMessages, getUnreadComments, replyToMessage, replyToComment, processWebhookEvent, CONFIGURED };
