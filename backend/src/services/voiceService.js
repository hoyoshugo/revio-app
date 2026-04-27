/**
 * voiceService.js — Voz bidireccional para WhatsApp (E-AGENT-14, 2026-04-26).
 *
 * Capabilities:
 *   1. STT (Speech-to-Text): transcribe audios entrantes via OpenAI Whisper.
 *   2. TTS (Text-to-Speech): genera audio de respuesta via OpenAI TTS y lo
 *      sube como media a la WhatsApp Business API.
 *
 * Flujo end-to-end:
 *   webhook entrante (msg.type === 'audio') →
 *     downloadWhatsAppMedia(msg.audio.id) →
 *     transcribeAudio(buffer) → texto plano →
 *     processMessage(text) → respuesta del agente →
 *     synthesizeAudio(respuesta) → buffer mp3 →
 *     uploadWhatsAppMedia(buffer) → media_id →
 *     sendWhatsAppAudio(to, media_id)
 *
 * Env vars requeridas:
 *   OPENAI_API_KEY           — para Whisper + TTS (mismo key)
 *   WHATSAPP_TOKEN           — para descargar media + subir media (Graph API)
 *   WHATSAPP_PHONE_ID        — phone number ID del sender (default global)
 *
 * Env vars opcionales:
 *   OPENAI_TTS_VOICE         — 'nova' (default) | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer'
 *   OPENAI_TTS_MODEL         — 'tts-1' (default, faster) | 'tts-1-hd'
 *   WHISPER_MODEL            — 'whisper-1' (default — único disponible OSS)
 *   VOICE_REPLY_MAX_CHARS    — 600 (default). Si la respuesta excede esto,
 *                              se envía como texto en lugar de audio (audios
 *                              muy largos cansan al guest y consumen créditos).
 */
import axios from 'axios';
import FormData from 'form-data';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const GRAPH_API_BASE = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';

const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'nova';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';
const VOICE_REPLY_MAX_CHARS = parseInt(process.env.VOICE_REPLY_MAX_CHARS || '600', 10);

function isVoiceConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

// ===========================================================================
// 1. DOWNLOAD WHATSAPP MEDIA
// ===========================================================================
/**
 * Descarga un media file de WhatsApp Cloud API.
 * @param {string} mediaId - ID del media (msg.audio.id, msg.image.id, etc.)
 * @param {string} [token] - WHATSAPP_TOKEN per-tenant (fallback al global)
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
export async function downloadWhatsAppMedia(mediaId, token) {
  const authToken = token || process.env.WHATSAPP_TOKEN;
  if (!authToken) throw new Error('WHATSAPP_TOKEN no configurado');
  if (!mediaId) throw new Error('mediaId requerido');

  // Step 1: get media URL (temporary, ~5 min TTL)
  const metaRes = await axios.get(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
    timeout: 10_000,
  });
  const mediaUrl = metaRes.data?.url;
  const mimeType = metaRes.data?.mime_type || 'audio/ogg';
  if (!mediaUrl) throw new Error(`No se obtuvo URL para media ${mediaId}`);

  // Step 2: download binary (still requires bearer token)
  const binRes = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${authToken}` },
    responseType: 'arraybuffer',
    timeout: 30_000,
  });

  return { buffer: Buffer.from(binRes.data), mimeType };
}

// ===========================================================================
// 2. TRANSCRIBE AUDIO (STT — Whisper)
// ===========================================================================
/**
 * Transcribe un buffer de audio a texto con OpenAI Whisper.
 * @param {Buffer} audioBuffer
 * @param {string} mimeType - 'audio/ogg', 'audio/mpeg', etc.
 * @param {string} [languageHint] - 'es', 'en', 'pt', etc. Mejora accuracy.
 * @returns {Promise<{text: string, language: string|null, durationSec: number|null}>}
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg', languageHint) {
  if (!isVoiceConfigured()) {
    throw new Error('OPENAI_API_KEY no configurado — no se pueden transcribir audios');
  }
  if (!audioBuffer || !audioBuffer.length) {
    throw new Error('Buffer de audio vacío');
  }

  // Whisper acepta: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
  const ext = mimeTypeToExt(mimeType);
  const filename = `audio.${ext}`;

  const form = new FormData();
  form.append('file', audioBuffer, { filename, contentType: mimeType });
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  if (languageHint) form.append('language', languageHint);

  const res = await axios.post(`${OPENAI_API_BASE}/audio/transcriptions`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    maxBodyLength: 30 * 1024 * 1024, // 30MB max — Whisper limit es 25MB
    timeout: 60_000,
  });

  return {
    text: res.data?.text || '',
    language: res.data?.language || null,
    durationSec: res.data?.duration || null,
  };
}

// ===========================================================================
// 3. SYNTHESIZE AUDIO (TTS — OpenAI)
// ===========================================================================
/**
 * Genera un buffer de audio MP3 a partir de texto.
 * @param {string} text
 * @param {object} [opts] - { voice, model, format }
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
export async function synthesizeAudio(text, opts = {}) {
  if (!isVoiceConfigured()) {
    throw new Error('OPENAI_API_KEY no configurado — no se puede sintetizar voz');
  }
  if (!text || typeof text !== 'string') {
    throw new Error('Texto requerido para sintetizar voz');
  }
  if (text.length > 4096) {
    text = text.slice(0, 4090) + '...';
  }

  const voice = opts.voice || TTS_VOICE;
  const model = opts.model || TTS_MODEL;
  // WhatsApp Business solo acepta audio en formato OGG con codec OPUS para
  // mostrar el waveform de "voice note". MP3 lo manda como adjunto. Pedimos
  // OPUS directo a OpenAI para coherencia con la nota de voz nativa.
  const format = opts.format || 'opus';

  const res = await axios.post(
    `${OPENAI_API_BASE}/audio/speech`,
    { model, voice, input: text, response_format: format },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30_000,
    }
  );

  const mimeType = format === 'opus' ? 'audio/ogg' : `audio/${format}`;
  return { buffer: Buffer.from(res.data), mimeType };
}

// ===========================================================================
// 4. UPLOAD MEDIA TO WHATSAPP
// ===========================================================================
/**
 * Sube un buffer a WhatsApp media (devuelve media_id reusable durante 30 días).
 * @param {Buffer} buffer
 * @param {string} mimeType - 'audio/ogg' para voice notes
 * @param {string} phoneNumberId - phone_number_id del sender
 * @param {string} [token]
 * @returns {Promise<string>} media_id
 */
export async function uploadWhatsAppMedia(buffer, mimeType, phoneNumberId, token) {
  const authToken = token || process.env.WHATSAPP_TOKEN;
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;
  if (!authToken) throw new Error('WHATSAPP_TOKEN no configurado');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID no configurado');

  const ext = mimeTypeToExt(mimeType);
  const filename = `voice.${ext}`;

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', buffer, { filename, contentType: mimeType });

  const res = await axios.post(`${GRAPH_API_BASE}/${phoneId}/media`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${authToken}`,
    },
    maxBodyLength: 30 * 1024 * 1024,
    timeout: 30_000,
  });

  if (!res.data?.id) {
    throw new Error('Upload OK pero no se obtuvo media_id en la respuesta');
  }
  return res.data.id;
}

// ===========================================================================
// 5. SEND WHATSAPP AUDIO MESSAGE
// ===========================================================================
/**
 * Envía un audio (voice note) a un huésped.
 * @param {string} to - número en formato E.164 sin "+"
 * @param {string} mediaId - obtenido de uploadWhatsAppMedia
 * @param {string} [phoneNumberId]
 * @param {string} [token]
 */
export async function sendWhatsAppAudio(to, mediaId, phoneNumberId, token) {
  const authToken = token || process.env.WHATSAPP_TOKEN;
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID;
  if (!authToken) throw new Error('WHATSAPP_TOKEN no configurado');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID no configurado');

  const phone = String(to).replace(/\D/g, '');
  const res = await axios.post(
    `${GRAPH_API_BASE}/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'audio',
      audio: { id: mediaId },
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    }
  );

  return {
    success: true,
    message_id: res.data?.messages?.[0]?.id,
  };
}

// ===========================================================================
// 6. HIGH-LEVEL HELPERS
// ===========================================================================
/**
 * Pipeline completo: descarga + transcribe.
 * Retorna `{text, language, durationSec}` o lanza error.
 */
export async function transcribeWhatsAppAudio(mediaId, options = {}) {
  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId, options.token);
  return transcribeAudio(buffer, mimeType, options.languageHint);
}

/**
 * Pipeline completo: sintetiza + sube + envía.
 * Decide automáticamente si responder con audio o texto según length:
 *   - Si text > VOICE_REPLY_MAX_CHARS → fallback a sendText
 *   - Si OPENAI_API_KEY no está configurado → fallback a sendText
 */
export async function replyWithVoice(to, text, options = {}) {
  if (!isVoiceConfigured()) {
    return { skipped: true, reason: 'openai_not_configured', fallback: 'send_as_text' };
  }
  if (!text || text.length === 0) {
    return { skipped: true, reason: 'empty_text' };
  }
  if (text.length > VOICE_REPLY_MAX_CHARS) {
    return {
      skipped: true,
      reason: 'text_too_long_for_voice',
      length: text.length,
      max: VOICE_REPLY_MAX_CHARS,
      fallback: 'send_as_text',
    };
  }

  try {
    const { buffer, mimeType } = await synthesizeAudio(text);
    const mediaId = await uploadWhatsAppMedia(
      buffer, mimeType, options.phoneNumberId, options.token
    );
    const sent = await sendWhatsAppAudio(to, mediaId, options.phoneNumberId, options.token);
    return { ...sent, voice: true, voice_chars: text.length };
  } catch (err) {
    console.error('[voiceService] replyWithVoice failed:', err.message);
    return { error: err.message, fallback: 'send_as_text' };
  }
}

// ===========================================================================
// HELPERS
// ===========================================================================
function mimeTypeToExt(mimeType) {
  const map = {
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/x-m4a': 'm4a',
  };
  const base = String(mimeType).split(';')[0].trim().toLowerCase();
  return map[base] || map[mimeType] || 'ogg';
}

export default {
  downloadWhatsAppMedia,
  transcribeAudio,
  synthesizeAudio,
  uploadWhatsAppMedia,
  sendWhatsAppAudio,
  transcribeWhatsAppAudio,
  replyWithVoice,
  isVoiceConfigured,
};
