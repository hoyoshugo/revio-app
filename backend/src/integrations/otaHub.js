/**
 * OTA Hub — Centro de mensajería unificado
 *
 * Responsabilidades:
 * 1. Recibir mensajes de Booking.com, Airbnb, Hostelworld
 * 2. Guardarlos en la tabla ota_messages de Supabase
 * 3. Generar respuesta automática con el agente IA (hotelAgent)
 * 4. Enviar la respuesta de vuelta a la plataforma correcta
 * 5. Vincular reservas OTA con el sistema interno
 */
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../models/supabase.js';
import bookingCom from './bookingCom.js';
import airbnb from './airbnb.js';
import hostelworld from './hostelworld.js';
import expedia from './expedia.js';
import instagram from './instagram.js';
import facebook from './facebook.js';
import googleBusiness from './googleBusiness.js';
import tripadvisor from './tripadvisor.js';
import tiktok from './tiktok.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// Adaptadores por plataforma (OTAs + Social)
const PLATFORMS = {
  booking: bookingCom,
  airbnb: airbnb,
  hostelworld: hostelworld,
  expedia: expedia,
  instagram: instagram,
  facebook: facebook,
  google: googleBusiness,
  tripadvisor: tripadvisor,
  tiktok: tiktok
};

// ============================================================
// Guardar mensaje OTA en Supabase
// ============================================================
export async function saveOtaMessage(messageData) {
  const { data, error } = await supabase
    .from('ota_messages')
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error('[OTA Hub] Error guardando mensaje:', error.message);
    throw error;
  }
  return data;
}

// ============================================================
// Guardar reserva OTA en Supabase
// ============================================================
export async function saveOtaReservation(propertyId, reservationData) {
  const { data, error } = await supabase
    .from('ota_reservations')
    .upsert({
      property_id: propertyId,
      ...reservationData,
      synced_at: new Date().toISOString()
    }, { onConflict: 'platform,platform_reservation_id' })
    .select()
    .single();

  if (error) {
    console.error('[OTA Hub] Error guardando reserva OTA:', error.message);
    throw error;
  }

  // También crear/actualizar la reserva interna en bookings
  try {
    await syncOtaReservationToInternal(propertyId, data);
  } catch (e) {
    console.warn('[OTA Hub] No se pudo sincronizar reserva a tabla interna:', e.message);
  }

  return data;
}

// ============================================================
// Sincronizar reserva OTA → tabla bookings interna
// ============================================================
async function syncOtaReservationToInternal(propertyId, otaRes) {
  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('property_id', propertyId)
    .eq('source', otaRes.platform)
    // Buscar por referencia de la OTA en los campos existentes
    .ilike('guest_email', otaRes.guest_email || '')
    .single();

  if (existing) return; // ya existe, no duplicar

  const nights = otaRes.checkin_date && otaRes.checkout_date
    ? Math.ceil((new Date(otaRes.checkout_date) - new Date(otaRes.checkin_date)) / 86400000)
    : null;

  await supabase.from('bookings').insert({
    property_id: propertyId,
    guest_name: otaRes.guest_name,
    guest_email: otaRes.guest_email,
    guest_phone: otaRes.guest_phone,
    checkin_date: otaRes.checkin_date,
    checkout_date: otaRes.checkout_date,
    nights,
    adults: otaRes.adults,
    children: otaRes.children || 0,
    total_amount: otaRes.total_amount,
    currency: otaRes.currency || 'COP',
    status: 'confirmed',
    source: otaRes.platform,
    // Guardar ID de la OTA en lobby_booking_id para rastreo
    lobby_booking_id: otaRes.platform_reservation_id
  });
}

// ============================================================
// Generar respuesta IA para un mensaje OTA
// ============================================================
async function generateOtaReply(message, platform, propertySlug, language = 'es') {
  const platformNames = {
    booking: 'Booking.com',
    airbnb: 'Airbnb',
    hostelworld: 'Hostelworld',
    expedia: 'Expedia',
    instagram: 'Instagram',
    facebook: 'Facebook',
    google: 'Google Business',
    tripadvisor: 'TripAdvisor',
    tiktok: 'TikTok'
  };

  // Cargar branding del tenant. Las URLs y firma se resuelven dinámicamente
  // desde properties.tenants. Sin hardcode al cliente piloto.
  let businessName = 'el hotel';
  let bookingUrl = null;
  let howToGetUrl = null;
  let whatsappContact = null;
  try {
    const { data: prop } = await supabase
      .from('properties')
      .select('name, brand_name, whatsapp_number, booking_url, how_to_get_url, tenants(business_name)')
      .eq('slug', propertySlug)
      .maybeSingle();
    businessName = prop?.tenants?.business_name || prop?.brand_name || prop?.name || businessName;
    bookingUrl = prop?.booking_url || null;
    howToGetUrl = prop?.how_to_get_url || null;
    whatsappContact = prop?.whatsapp_number || null;
  } catch { /* fallback */ }

  const systemPrompt = `Eres el agente de atención al cliente de ${businessName} respondiendo a mensajes de ${platformNames[platform] || platform}.

REGLAS:
- Responde en el mismo idioma que el mensaje del huésped
- Sé cálido, profesional y conciso (los mensajes OTA deben ser cortos)
${bookingUrl ? `- Si pregunta sobre disponibilidad o precios, dirígelo a reservar directamente: ${bookingUrl}` : '- Si pregunta sobre disponibilidad o precios, dirígelo al canal de reservas oficial del hotel'}
${howToGetUrl ? `- Si pregunta cómo llegar: ${howToGetUrl}` : ''}
${whatsappContact ? `- Para urgencias o cambios en la reserva: WhatsApp ${whatsappContact}` : ''}
- NO inventes políticas ni precios específicos
- Firma siempre con: "Equipo ${businessName}"
- Máximo 150 palabras por respuesta`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });

    return response.content.find(b => b.type === 'text')?.text || '';
  } catch (err) {
    console.error('[OTA Hub] Error generando respuesta IA:', err.message);
    const fallbacks = {
      es: 'Hola, gracias por tu mensaje. Nuestro equipo te responderá pronto. Para urgencias: WhatsApp +573234392420 🌊',
      en: 'Hello, thank you for your message. Our team will reply soon. For urgencies: WhatsApp +573234392420 🌊',
      fr: 'Bonjour, merci pour votre message. Notre équipe vous répondra bientôt. Urgences: WhatsApp +573234392420 🌊',
      de: 'Hallo, danke für Ihre Nachricht. Unser Team antwortet bald. Dringlich: WhatsApp +573234392420 🌊'
    };
    return fallbacks[language] || fallbacks.es;
  }
}

// ============================================================
// Detectar idioma simple
// ============================================================
function detectLanguage(text) {
  const lower = text.toLowerCase();
  if (/\b(hello|hi|hey|thank|please|booking|room|stay|night)\b/.test(lower)) return 'en';
  if (/\b(bonjour|merci|réservation|chambre|nuit|s'il vous)\b/.test(lower)) return 'fr';
  if (/\b(hallo|danke|zimmer|buchung|nacht|bitte)\b/.test(lower)) return 'de';
  return 'es';
}

// ============================================================
// FUNCIÓN PRINCIPAL: procesar mensaje OTA entrante
// ============================================================
export async function processIncomingOtaMessage(platform, messageData, propertySlug, propertyId) {
  // 1. Guardar mensaje en Supabase
  const saved = await saveOtaMessage({
    property_id: propertyId,
    platform,
    platform_message_id: messageData.platform_message_id,
    platform_reservation_id: messageData.platform_reservation_id,
    guest_name: messageData.guest_name,
    direction: 'inbound',
    body: messageData.body,
    language: detectLanguage(messageData.body),
    raw_payload: messageData.raw || messageData,
    status: 'unread'
  });

  console.log(`[OTA Hub] Mensaje de ${platform} guardado: ${saved.id}`);

  // 2. Generar respuesta con IA
  const language = detectLanguage(messageData.body);
  const replyText = await generateOtaReply(messageData.body, platform, propertySlug, language);

  // 3. Enviar respuesta a la plataforma
  let sendResult = { success: false };
  try {
    const adapter = PLATFORMS[platform];
    if (!adapter) throw new Error(`Plataforma desconocida: ${platform}`);

    if (platform === 'booking') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_reservation_id, replyText);
    } else if (platform === 'airbnb') {
      sendResult = await adapter.replyToThread(propertySlug, messageData.thread_id || messageData.platform_reservation_id, replyText);
    } else if (platform === 'hostelworld') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_reservation_id, replyText);
    } else if (platform === 'expedia') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_message_id, replyText);
    } else if (platform === 'instagram') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_message_id, replyText);
    } else if (platform === 'facebook') {
      const fn = messageData.sub_type === 'dm' ? adapter.replyToDM : adapter.replyToComment;
      sendResult = await fn(propertySlug, messageData.guest_id || messageData.platform_message_id, replyText);
    } else if (platform === 'google') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_message_id, replyText, messageData.sub_type);
    } else if (platform === 'tripadvisor') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_message_id, replyText);
    } else if (platform === 'tiktok') {
      sendResult = await adapter.replyToMessage(propertySlug, messageData.platform_message_id, replyText, { video_id: messageData.video_id });
    }
  } catch (err) {
    console.error(`[OTA Hub] Error enviando respuesta a ${platform}:`, err.message);
    sendResult = { success: false, error: err.message };
  }

  // 4. Actualizar registro en Supabase
  await supabase
    .from('ota_messages')
    .update({
      status: sendResult.success ? 'replied' : 'failed',
      ai_reply_sent: sendResult.success,
      ai_reply_body: replyText,
      ai_reply_at: new Date().toISOString(),
      reply_error: sendResult.error || null
    })
    .eq('id', saved.id);

  // 5. Guardar el mensaje de salida también
  if (sendResult.success) {
    await supabase.from('ota_messages').insert({
      property_id: propertyId,
      platform,
      platform_message_id: sendResult.message_id,
      platform_reservation_id: messageData.platform_reservation_id,
      guest_name: messageData.guest_name,
      direction: 'outbound',
      body: replyText,
      language,
      status: 'sent'
    });
  }

  return { saved, reply: replyText, sent: sendResult.success };
}

// ============================================================
// Poll de mensajes: consulta todas las OTAs configuradas
// ============================================================
export async function pollAllOtaMessages(properties) {
  let totalNew = 0;

  for (const property of properties) {
    for (const [platformKey, adapter] of Object.entries(PLATFORMS)) {
      if (typeof adapter.CONFIGURED !== 'function' || !adapter.CONFIGURED(property.slug)) continue;

      try {
        const fn = adapter.getUnreadMessages || adapter.getUnreadReviews;
        if (typeof fn !== 'function') continue;
        const messages = await fn.call(adapter, property.slug);
        console.log(`[OTA Hub] ${property.slug}/${platformKey}: ${messages.length} mensajes nuevos`);

        for (const msg of messages) {
          // Verificar si ya lo procesamos
          const { data: existing } = await supabase
            .from('ota_messages')
            .select('id')
            .eq('platform_message_id', msg.platform_message_id)
            .single();

          if (!existing) {
            await processIncomingOtaMessage(platformKey, msg, property.slug, property.id);
            totalNew++;
          }
        }
      } catch (err) {
        console.error(`[OTA Hub] Error en poll ${property.slug}/${platformKey}:`, err.message);
      }
    }
  }

  return totalNew;
}

// ============================================================
// Obtener mensajes del inbox para el dashboard
// ============================================================
export async function getOtaInbox(propertyId, filters = {}) {
  let query = supabase
    .from('ota_messages')
    .select('*')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false });

  if (propertyId) query = query.eq('property_id', propertyId);
  if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export default {
  processIncomingOtaMessage,
  pollAllOtaMessages,
  saveOtaReservation,
  getOtaInbox
};
