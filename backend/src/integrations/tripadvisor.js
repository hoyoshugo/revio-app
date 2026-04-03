/**
 * TripAdvisor Content API — Reseñas y preguntas
 * Docs: https://developer-tripadvisor.com/content-api/
 *
 * .env requerido:
 *   TRIPADVISOR_API_KEY=pendiente
 *   TRIPADVISOR_LOCATION_ID_ISLA=pendiente   (location_id de TripAdvisor)
 *   TRIPADVISOR_LOCATION_ID_TAYRONA=pendiente
 *   TRIPADVISOR_MGMT_TOKEN_ISLA=pendiente    (Management API token para responder)
 *   TRIPADVISOR_MGMT_TOKEN_TAYRONA=pendiente
 *
 * Nota: TripAdvisor requiere partnership para responder reseñas via API.
 * La lectura de reseñas es posible con el Content API (key pública).
 */
import axios from 'axios';

const TA_API = 'https://api.content.tripadvisor.com/api/v1';
const TA_MGMT_API = 'https://api.tripadvisor.com/api/partner/2.0';

const CREDENTIALS = {
  'isla-palma': {
    api_key: process.env.TRIPADVISOR_API_KEY,
    location_id: process.env.TRIPADVISOR_LOCATION_ID_ISLA,
    mgmt_token: process.env.TRIPADVISOR_MGMT_TOKEN_ISLA
  },
  tayrona: {
    api_key: process.env.TRIPADVISOR_API_KEY,
    location_id: process.env.TRIPADVISOR_LOCATION_ID_TAYRONA,
    mgmt_token: process.env.TRIPADVISOR_MGMT_TOKEN_TAYRONA
  }
};

export const CONFIGURED = (slug) =>
  !!(CREDENTIALS[slug]?.api_key && CREDENTIALS[slug]?.api_key !== 'pendiente' &&
     CREDENTIALS[slug]?.location_id && CREDENTIALS[slug]?.location_id !== 'pendiente');

// ============================================================
// Obtener reseñas recientes
// ============================================================
export async function getRecentReviews(slug) {
  if (!CONFIGURED(slug)) return [];
  const { api_key, location_id } = CREDENTIALS[slug];
  try {
    const { data } = await axios.get(`${TA_API}/location/${location_id}/reviews`, {
      params: { key: api_key, limit: 10, language: 'all' }
    });
    return (data.data || []).map(r => ({
      platform: 'tripadvisor',
      sub_type: 'review',
      platform_message_id: String(r.id),
      guest_name: r.user?.username || 'Viajero TripAdvisor',
      body: `⭐ ${r.rating}/5 — "${r.title}"\n${r.text || ''}`,
      received_at: r.published_date,
      rating: r.rating,
      review_id: r.id,
      raw: r
    }));
  } catch (err) {
    console.error('[TripAdvisor] Error reseñas:', err.response?.data || err.message);
    return [];
  }
}

// ============================================================
// Responder una reseña (requiere Management API / partnership)
// ============================================================
export async function replyToReview(slug, reviewId, text) {
  if (!CONFIGURED(slug)) return { success: false, reason: 'tripadvisor_not_configured' };
  const { mgmt_token } = CREDENTIALS[slug];
  if (!mgmt_token || mgmt_token === 'pendiente') {
    return { success: false, reason: 'tripadvisor_mgmt_token_missing' };
  }
  try {
    await axios.post(
      `${TA_MGMT_API}/reviews/${reviewId}/response`,
      { text },
      { headers: { Authorization: `Bearer ${mgmt_token}`, 'Content-Type': 'application/json' } }
    );
    return { success: true };
  } catch (err) {
    console.error('[TripAdvisor] Error respondiendo:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

export async function getUnreadMessages(slug) {
  return getRecentReviews(slug);
}

export async function replyToMessage(slug, messageId, text) {
  return replyToReview(slug, messageId, text);
}

export default { getUnreadMessages, replyToMessage, getRecentReviews, replyToReview, CONFIGURED };
