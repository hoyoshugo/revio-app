/**
 * Google Business Profile API — Reseñas y preguntas
 * Docs: https://developers.google.com/my-business/reference/rest
 *
 * .env requerido:
 *   GOOGLE_CLIENT_ID=pendiente
 *   GOOGLE_CLIENT_SECRET=pendiente
 *   GOOGLE_REFRESH_TOKEN_ISLA=pendiente    (OAuth2 refresh token)
 *   GOOGLE_LOCATION_ID_ISLA=pendiente      (accounts/{id}/locations/{id})
 *   GOOGLE_REFRESH_TOKEN_TAYRONA=pendiente
 *   GOOGLE_LOCATION_ID_TAYRONA=pendiente
 */
import axios from 'axios';

const GMB_API = 'https://mybusiness.googleapis.com/v4';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';

const CREDENTIALS = {
  'isla-palma': {
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN_ISLA,
    location_id: process.env.GOOGLE_LOCATION_ID_ISLA
  },
  tayrona: {
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN_TAYRONA,
    location_id: process.env.GOOGLE_LOCATION_ID_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.refresh_token && CREDENTIALS[slug]?.refresh_token !== 'pendiente');

// Cache de access tokens (expiran cada 1 hora)
const tokenCache = {};

async function getAccessToken(slug) {
  if (tokenCache[slug] && tokenCache[slug].expires_at > Date.now()) {
    return tokenCache[slug].token;
  }
  const { data } = await axios.post(OAUTH_URL, {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: CREDENTIALS[slug].refresh_token,
    grant_type: 'refresh_token'
  });
  tokenCache[slug] = {
    token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000
  };
  return data.access_token;
}

// ============================================================
// Obtener reseñas no respondidas
// ============================================================
export async function getUnansweredReviews(slug) {
  if (!CONFIGURED(slug)) return [];
  const { location_id } = CREDENTIALS[slug];
  try {
    const token = await getAccessToken(slug);
    const { data } = await axios.get(`${GMB_API}/${location_id}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 20 }
    });
    return (data.reviews || [])
      .filter(r => !r.reviewReply)
      .map(r => ({
        platform: 'google',
        sub_type: 'review',
        platform_message_id: r.reviewId,
        platform_reservation_id: null,
        guest_name: r.reviewer?.displayName || 'Usuario Google',
        body: `⭐ ${r.starRating}\n${r.comment || '(sin comentario)'}`,
        received_at: r.createTime,
        review_id: r.reviewId,
        raw: r
      }));
  } catch (err) {
    console.error('[Google] Error reseñas:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder una reseña
// ============================================================
export async function replyToReview(slug, reviewId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'google_not_configured' };
  const { location_id } = CREDENTIALS[slug];
  try {
    const token = await getAccessToken(slug);
    await axios.put(
      `${GMB_API}/${location_id}/reviews/${reviewId}/reply`,
      { comment: text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true };
  } catch (err) {
    console.error('[Google] Error respondiendo reseña:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Obtener preguntas (Q&A) no respondidas
// ============================================================
export async function getUnansweredQuestions(slug) {
  if (!CONFIGURED(slug)) return [];
  const { location_id } = CREDENTIALS[slug];
  try {
    const token = await getAccessToken(slug);
    const { data } = await axios.get(`${GMB_API}/${location_id}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 20 }
    });
    return (data.questions || [])
      .filter(q => !q.topAnswers?.length)
      .map(q => ({
        platform: 'google',
        sub_type: 'question',
        platform_message_id: q.name,
        guest_name: q.author?.displayName || 'Usuario Google',
        body: `❓ ${q.text}`,
        received_at: q.createTime,
        question_name: q.name,
        raw: q
      }));
  } catch (err) {
    console.error('[Google] Error preguntas:', err.message);
    return [];
  }
}

// ============================================================
// Responder una pregunta
// ============================================================
export async function replyToQuestion(slug, questionName, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'google_not_configured' };
  const { location_id } = CREDENTIALS[slug];
  try {
    const token = await getAccessToken(slug);
    await axios.post(
      `${GMB_API}/${questionName}/answers`,
      { text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Google no tiene webhooks en tiempo real — se usa polling
export async function getUnreadMessages(slug) {
  const [reviews, questions] = await Promise.all([
    getUnansweredReviews(slug),
    getUnansweredQuestions(slug)
  ]);
  return [...reviews, ...questions];
}

export async function replyToMessage(slug, messageId, text, subType = 'review') {
  if (subType === 'question') return replyToQuestion(slug, messageId, text);
  return replyToReview(slug, messageId, text);
}

export default {
  getUnreadMessages, replyToMessage, getUnansweredReviews,
  getUnansweredQuestions, replyToReview, replyToQuestion, CONFIGURED
};
