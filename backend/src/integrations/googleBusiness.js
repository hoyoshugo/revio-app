/**
 * Google Business Profile API — Reviews & Messages (multi-tenant)
 *
 * Credentials stored in settings table as `google_config`:
 *   { client_id, client_secret, refresh_token, location_id, account_id }
 *
 * Q&A API deprecated by Google (Nov 2025) — removed.
 * Reviews API v4 still active: mybusiness.googleapis.com/v4
 */
import axios from 'axios';
import { getSetting } from '../services/connectionService.js';

const GMB_API = 'https://mybusiness.googleapis.com/v4';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';

const tokenCache = {};

export async function CONFIGURED(propertyId) {
  if (!propertyId) return false;
  const config = await getGoogleConfig(propertyId);
  return !!(config && config.refresh_token && config.location_id && config.client_id && config.client_secret);
}

async function getGoogleConfig(propertyId) {
  const setting = await getSetting(propertyId, 'google_config');
  if (!setting || typeof setting !== 'object') return null;
  return setting;
}

async function getAccessToken(propertyId) {
  if (tokenCache[propertyId] && tokenCache[propertyId].expires_at > Date.now()) {
    return tokenCache[propertyId].token;
  }
  const config = await getGoogleConfig(propertyId);
  if (!config || !config.refresh_token) {
    throw new Error('Google Business not configured for this property');
  }
  const { data } = await axios.post(OAUTH_URL, {
    client_id: config.client_id,
    client_secret: config.client_secret,
    refresh_token: config.refresh_token,
    grant_type: 'refresh_token',
  });
  tokenCache[propertyId] = {
    token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function getLocationName(propertyId) {
  const config = await getGoogleConfig(propertyId);
  if (!config || !config.location_id) return null;
  if (config.location_id.startsWith('accounts/')) return config.location_id;
  if (config.account_id) return `accounts/${config.account_id}/locations/${config.location_id}`;
  return config.location_id;
}

export async function getUnansweredReviews(propertyId) {
  const isConfigured = await CONFIGURED(propertyId);
  if (!isConfigured) return [];
  const locationName = await getLocationName(propertyId);
  if (!locationName) return [];
  try {
    const token = await getAccessToken(propertyId);
    const { data } = await axios.get(`${GMB_API}/${locationName}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { pageSize: 50 },
    });
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    return reviews
      .filter(r => !r.reviewReply)
      .map(r => ({
        platform: 'google',
        sub_type: 'review',
        platform_message_id: r.reviewId,
        platform_reservation_id: null,
        guest_name: r.reviewer?.displayName || 'Google User',
        body: `${r.starRating}\n${r.comment || '(no comment)'}`,
        received_at: r.createTime,
        review_id: r.reviewId,
        star_rating: r.starRating,
        raw: r,
      }));
  } catch (err) {
    console.error('[Google] Error fetching reviews:', err.response?.data || err.message);
    return [];
  }
}

export async function getAllReviews(propertyId, { pageSize = 50, pageToken = null } = {}) {
  const isConfigured = await CONFIGURED(propertyId);
  if (!isConfigured) return { reviews: [], nextPageToken: null };
  const locationName = await getLocationName(propertyId);
  if (!locationName) return { reviews: [], nextPageToken: null };
  try {
    const token = await getAccessToken(propertyId);
    const params = { pageSize };
    if (pageToken) params.pageToken = pageToken;
    const { data } = await axios.get(`${GMB_API}/${locationName}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    return {
      reviews: reviews.map(r => ({
        platform: 'google',
        review_id: r.reviewId,
        guest_name: r.reviewer?.displayName || 'Google User',
        star_rating: r.starRating,
        comment: r.comment || null,
        reply: r.reviewReply?.comment || null,
        reply_time: r.reviewReply?.updateTime || null,
        created_at: r.createTime,
        updated_at: r.updateTime,
        raw: r,
      })),
      nextPageToken: data.nextPageToken || null,
      totalReviewCount: data.totalReviewCount || reviews.length,
    };
  } catch (err) {
    console.error('[Google] Error fetching all reviews:', err.response?.data || err.message);
    return { reviews: [], nextPageToken: null };
  }
}

export async function getReviewStats(propertyId) {
  const isConfigured = await CONFIGURED(propertyId);
  if (!isConfigured) return null;
  const locationName = await getLocationName(propertyId);
  if (!locationName) return null;
  try {
    const token = await getAccessToken(propertyId);
    let allReviews = [];
    let pageToken = null;
    do {
      const params = { pageSize: 100 };
      if (pageToken) params.pageToken = pageToken;
      const { data } = await axios.get(`${GMB_API}/${locationName}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      allReviews = allReviews.concat(reviews);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    const starMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalStars = 0;
    let repliedCount = 0;
    for (const r of allReviews) {
      const numericRating = starMap[r.starRating] || 0;
      if (numericRating >= 1 && numericRating <= 5) {
        distribution[numericRating]++;
        totalStars += numericRating;
      }
      if (r.reviewReply) repliedCount++;
    }
    const totalCount = allReviews.length;
    return {
      total_reviews: totalCount,
      average_rating: totalCount > 0 ? Math.round((totalStars / totalCount) * 100) / 100 : 0,
      distribution,
      replied_count: repliedCount,
      unreplied_count: totalCount - repliedCount,
      reply_rate: totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0,
    };
  } catch (err) {
    console.error('[Google] Error fetching review stats:', err.response?.data || err.message);
    return null;
  }
}

export async function replyToReview(propertyId, reviewId, text) {
  const isConfigured = await CONFIGURED(propertyId);
  if (!isConfigured) return { success: false, reason: 'google_not_configured' };
  const locationName = await getLocationName(propertyId);
  if (!locationName) return { success: false, reason: 'google_location_missing' };
  try {
    const token = await getAccessToken(propertyId);
    await axios.put(
      `${GMB_API}/${locationName}/reviews/${reviewId}/reply`,
      { comment: text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { success: true };
  } catch (err) {
    console.error('[Google] Error replying to review:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

export async function getUnreadMessages(propertyId) {
  return getUnansweredReviews(propertyId);
}

export async function replyToMessage(propertyId, messageId, text) {
  return replyToReview(propertyId, messageId, text);
}

export default {
  CONFIGURED,
  getUnansweredReviews,
  getAllReviews,
  getReviewStats,
  replyToReview,
  getUnreadMessages,
  replyToMessage,
};
