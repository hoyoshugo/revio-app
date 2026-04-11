/**
 * Meta Unified Service
 * Maneja WhatsApp + Instagram + Facebook desde una sola cuenta Meta Business.
 * Mística tiene: WhatsApp compartido, 2 páginas FB, 2 cuentas IG.
 * El agente responde como "Mística" genérico y pregunta por la propiedad.
 */

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

// ── ENVIAR MENSAJE POR CANAL ──────────────────────────────
export async function sendMessage(channel, recipientId, message, options = {}) {
  const token = options.token || process.env.FACEBOOK_PAGE_TOKEN;
  switch (channel) {
    case 'whatsapp':
      return sendWhatsApp(recipientId, message, token, options.phoneId);
    case 'instagram':
      return sendInstagramDM(recipientId, message, token);
    case 'facebook':
      return sendFacebookDM(recipientId, message, token);
    default:
      return { error: 'unknown_channel: ' + channel };
  }
}

// ── WHATSAPP ──────────────────────────────────────────────
export async function sendWhatsApp(to, message, token, phoneId) {
  const pid = phoneId || process.env.WHATSAPP_PHONE_ID;
  const tok = token || process.env.WHATSAPP_TOKEN || process.env.FACEBOOK_PAGE_TOKEN;
  if (!tok || !pid) return { error: 'whatsapp_not_configured' };

  try {
    const r = await fetch(`${GRAPH_BASE}/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── INSTAGRAM DM ──────────────────────────────────────────
export async function sendInstagramDM(recipientId, message, token) {
  const tok = token || process.env.FACEBOOK_PAGE_TOKEN;
  if (!tok) return { error: 'instagram_not_configured' };

  try {
    const r = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE',
      }),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── FACEBOOK PAGE DM ──────────────────────────────────────
export async function sendFacebookDM(recipientId, message, token) {
  const tok = token || process.env.FACEBOOK_PAGE_TOKEN;
  if (!tok) return { error: 'facebook_not_configured' };

  try {
    const r = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── RESPONDER COMENTARIO IG ──────────────────────────────
export async function replyToInstagramComment(commentId, message, token) {
  const tok = token || process.env.FACEBOOK_PAGE_TOKEN;
  try {
    const r = await fetch(`${GRAPH_BASE}/${commentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── RESPONDER COMENTARIO FB ──────────────────────────────
export async function replyToFacebookComment(commentId, message, token) {
  const tok = token || process.env.FACEBOOK_PAGE_TOKEN;
  try {
    const r = await fetch(`${GRAPH_BASE}/${commentId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return await r.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ── PARSEAR WEBHOOK META UNIFICADO ───────────────────────
export function parseMetaWebhook(body) {
  const events = [];
  const entries = body.entry || [];

  for (const entry of entries) {
    const pageId = entry.id;

    // WhatsApp / Instagram / Facebook comments & messages (via changes)
    for (const change of (entry.changes || [])) {
      if (change.field === 'messages' && change.value?.messaging_product === 'whatsapp') {
        const msg = change.value.messages?.[0];
        if (msg && msg.type === 'text') {
          events.push({
            channel: 'whatsapp',
            senderId: msg.from,
            senderName: change.value.contacts?.[0]?.profile?.name || msg.from,
            message: msg.text.body,
            messageId: msg.id,
            timestamp: parseInt(msg.timestamp) * 1000,
            pageId,
          });
        }
      }

      // Comentarios IG
      if (change.field === 'comments' && body.object === 'instagram') {
        const c = change.value;
        events.push({
          channel: 'instagram_comment',
          senderId: c.from?.id,
          senderName: c.from?.username || 'usuario',
          message: c.text,
          commentId: c.id,
          mediaId: c.media?.id,
          timestamp: Date.now(),
          pageId,
        });
      }

      // Comentarios FB (feed)
      if (change.field === 'feed' && change.value?.item === 'comment') {
        const c = change.value;
        events.push({
          channel: 'facebook_comment',
          senderId: c.sender_id,
          senderName: c.sender_name || 'usuario',
          message: c.message,
          commentId: c.comment_id,
          postId: c.post_id,
          timestamp: Date.now(),
          pageId,
        });
      }
    }

    // DMs de Instagram/Facebook
    for (const msg of (entry.messaging || [])) {
      if (msg.message && !msg.message.is_echo) {
        const channel = body.object === 'instagram' ? 'instagram' : 'facebook';
        events.push({
          channel,
          senderId: msg.sender.id,
          message: msg.message.text || '[media]',
          messageId: msg.message.mid,
          timestamp: msg.timestamp,
          pageId,
        });
      }
    }
  }

  return events;
}

// ── VERIFICAR WEBHOOK META ───────────────────────────────
export function verifyMetaWebhook(mode, token, challenge) {
  const verifyToken = process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
    return { valid: true, challenge };
  }
  return { valid: false };
}
