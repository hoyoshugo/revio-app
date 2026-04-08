import { saveContact, sendWhatsAppMessage } from './agentUtils.js';
import { supabase } from '../models/supabase.js';

// ═══════════════════════════════════════
// META (Instagram + Facebook Messenger + comentarios)
// ═══════════════════════════════════════
export async function handleMetaWebhook(body, tenantId, propertyId) {
  const entries = body.entry || [];
  for (const entry of entries) {
    // Mensajes directos (Instagram + Facebook)
    for (const event of entry.messaging || []) {
      if (event.message && !event.message.is_echo) {
        await processIncomingMessage({
          channel: detectChannel(entry),
          senderId: event.sender?.id,
          text: event.message.text,
          tenantId,
          propertyId,
        });
      }
    }
    // Comentarios en posts/feeds
    for (const change of entry.changes || []) {
      if (change.field === 'comments' && change.value?.message) {
        await processComment({
          channel: 'instagram',
          commentId: change.value.id,
          text: change.value.message,
          fromName: change.value.from?.name,
          tenantId,
          propertyId,
        });
      }
    }
  }
}

function detectChannel(entry) {
  // Instagram envía messaging_product: 'instagram'
  return entry.messaging?.[0]?.message?.product === 'instagram' ? 'instagram' : 'facebook';
}

async function processIncomingMessage({ channel, senderId, text, tenantId, propertyId }) {
  // Guardar contacto y delegar al agente IA
  await saveContact(tenantId, { phone: senderId, source: channel });
  console.log(JSON.stringify({
    level: 'info', event: 'social_message_received', channel, senderId, propertyId,
  }));
  // El procesamiento del mensaje + respuesta del agente se hace en social.js routes
}

async function processComment({ channel, commentId, text, fromName, tenantId, propertyId }) {
  console.log(JSON.stringify({
    level: 'info', event: 'social_comment_received', channel, commentId, fromName,
  }));
  // Guardar el comentario para auditoría posterior
  await supabase.from('platform_audits').insert({
    tenant_id: tenantId,
    property_id: propertyId,
    platform: channel,
    audit_type: 'comment',
    raw_data: { commentId, text, fromName },
  });
}

export async function sendMetaReply(channel, recipientId, message, token) {
  const pageToken = token || process.env.FACEBOOK_PAGE_TOKEN;
  if (!pageToken) return null;

  try {
    const r = await fetch('https://graph.facebook.com/v22.0/me/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });
    return await r.json();
  } catch (e) {
    console.error('sendMetaReply error:', e.message);
    return null;
  }
}

export async function replyToInstagramComment(commentId, message, token) {
  const igToken = token || process.env.FACEBOOK_PAGE_TOKEN;
  if (!igToken) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${commentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${igToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return await r.json();
  } catch (e) {
    console.error('replyToComment error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════
// GOOGLE BUSINESS PROFILE
// ═══════════════════════════════════════
export async function getGoogleReviews(placeId, apiKey) {
  if (!placeId || !apiKey) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating&key=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json();
    return data.result?.reviews || [];
  } catch (e) {
    console.error('getGoogleReviews error:', e.message);
    return [];
  }
}

export async function replyToGoogleReview(accountName, reviewName, reply, accessToken) {
  if (!accessToken) return null;
  try {
    const r = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountName}/reviews/${reviewName}/reply`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: reply }),
      }
    );
    return await r.json();
  } catch (e) {
    console.error('replyToGoogleReview error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════
// AUDITORÍA DE PLATAFORMAS (cron job)
// ═══════════════════════════════════════
export async function auditPlatform(tenantId, propertyId, platform) {
  // Stub: en producción consulta la API real de cada plataforma
  // y guarda métricas en platform_audits
  const audit = {
    tenant_id: tenantId,
    property_id: propertyId,
    platform,
    audit_type: 'weekly',
    total_reviews: 0,
    avg_rating: null,
    new_reviews: 0,
    pending_responses: 0,
    raw_data: {},
  };
  await supabase.from('platform_audits').insert(audit);
  return audit;
}
