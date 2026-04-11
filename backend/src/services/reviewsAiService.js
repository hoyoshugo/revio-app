/**
 * Reviews AI Service — lee reseñas de plataformas externas (TripAdvisor,
 * Google) y la IA redacta una respuesta sugerida que el admin publica
 * con un clic.
 *
 * Tabla: property_reviews
 */
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from './agentUtils.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TA_API = 'https://api.content.tripadvisor.com/api/v1';

// ── Fetch desde TripAdvisor ──────────────────────────
export async function fetchTripAdvisorReviews(propertyId) {
  // Resolver locationId desde property_channels o settings
  const { data: channel } = await supabase
    .from('property_channels')
    .select('credentials, profile_url')
    .eq('property_id', propertyId)
    .eq('channel_key', 'tripadvisor')
    .maybeSingle();

  const apiKey = process.env.TRIPADVISOR_API_KEY || channel?.credentials?.api_key;
  const locationId = channel?.credentials?.location_id;

  if (!apiKey || !locationId) {
    return { success: false, reason: 'no_api_key_or_location_id', count: 0 };
  }

  try {
    const r = await fetch(
      `${TA_API}/location/${locationId}/reviews?language=es&key=${apiKey}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) {
      return { success: false, reason: `http_${r.status}`, count: 0 };
    }
    const data = await r.json();
    const reviews = data.data || [];

    const upserts = reviews.map(rev => ({
      property_id: propertyId,
      platform: 'tripadvisor',
      external_review_id: String(rev.id),
      reviewer_name: rev.user?.username || 'Huésped',
      rating: rev.rating || null,
      title: rev.title || null,
      review_text: rev.text || null,
      review_date: rev.published_date?.slice(0, 10) || null,
      language: rev.lang || 'es',
      raw_data: rev,
      status: 'pending',
    }));

    if (upserts.length === 0) return { success: true, count: 0 };

    const { error } = await supabase
      .from('property_reviews')
      .upsert(upserts, { onConflict: 'property_id,platform,external_review_id' });

    if (error) return { success: false, reason: error.message, count: 0 };
    return { success: true, count: upserts.length };
  } catch (e) {
    return { success: false, reason: e.message, count: 0 };
  }
}

// ── Generar respuesta IA ──────────────────────────────
export async function generateReviewResponse(reviewId) {
  const { data: review, error } = await supabase
    .from('property_reviews')
    .select('*, properties(name, slug, tenant_id, tenants(group_name))')
    .eq('id', reviewId)
    .single();

  if (error || !review) return { success: false, reason: 'review_not_found' };
  if (!process.env.ANTHROPIC_API_KEY) return { success: false, reason: 'no_anthropic_key' };

  const propertyName = review.properties?.name || 'la propiedad';
  const groupName = review.properties?.tenants?.group_name || null;

  // Cargar políticas y descripción de property_knowledge
  const { data: kb } = await supabase
    .from('property_knowledge')
    .select('category, key, value')
    .eq('property_id', review.property_id)
    .eq('is_active', true);

  const ctx = {};
  for (const k of kb || []) {
    if (!ctx[k.category]) ctx[k.category] = {};
    ctx[k.category][k.key] = k.value;
  }

  const systemPrompt = `Eres el gerente de ${propertyName}${groupName ? `, parte del grupo ${groupName}` : ''}.
Vas a redactar una respuesta profesional y cálida a una reseña en TripAdvisor.

Información de la propiedad:
- Tipo: ${ctx.general?.tipo || 'Hospedaje'}
- Descripción: ${ctx.general?.descripcion || ''}
- Idiomas: ${ctx.general?.idiomas || 'Español, Inglés'}

Reglas:
- Responde en el MISMO idioma de la reseña
- Agradece al huésped por su nombre si está disponible
- Reconoce los puntos positivos mencionados
- Si hay críticas, responde con soluciones concretas (sin defensiveness)
- Invita a volver con calidez genuina
- Tono: cercano pero profesional, como un amigo que dirige el lugar
- Máximo 150 palabras
- NO menciones que eres IA
- Firma como "El equipo de ${propertyName}"`;

  const userPrompt = `Reseña ${review.rating || '?'}/5 de "${review.reviewer_name || 'Huésped'}":

${review.title ? `Título: ${review.title}\n\n` : ''}${review.review_text || '(sin texto)'}

Genera la respuesta sugerida.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const aiText = response.content?.[0]?.text || '';

    await supabase
      .from('property_reviews')
      .update({
        ai_response: aiText,
        ai_response_generated_at: new Date().toISOString(),
        status: 'response_ready',
      })
      .eq('id', reviewId);

    // Notificar via WhatsApp si hay alert phones
    try {
      const { data: alerts } = await supabase
        .from('settings')
        .select('value')
        .eq('property_id', review.property_id)
        .eq('key', 'alert_phones')
        .maybeSingle();

      const phones = Array.isArray(alerts?.value) ? alerts.value : [];
      const preview = (review.review_text || '').slice(0, 100) + '...';
      const message =
        `📝 *Nueva reseña en TripAdvisor* (${review.rating || '?'}⭐)\n` +
        `De: ${review.reviewer_name || 'Huésped'}\n` +
        `_"${preview}"_\n\n` +
        `Ver respuesta sugerida por IA en Revio:\n` +
        `https://revio-app-production.up.railway.app/reviews`;

      for (const phone of phones) {
        if (phone) await sendWhatsAppMessage(phone, message);
      }
    } catch { /* silencioso */ }

    return { success: true, ai_response: aiText };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

// ── Listar con respuestas IA ─────────────────────────
export async function getReviewsWithResponses(propertyId, opts = {}) {
  const { status = null, limit = 100 } = opts;
  let query = supabase
    .from('property_reviews')
    .select('*')
    .eq('property_id', propertyId)
    .order('review_date', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data || [];
}

// ── Marcar como publicada ────────────────────────────
export async function markReviewPublished(reviewId) {
  const { data, error } = await supabase
    .from('property_reviews')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', reviewId)
    .select()
    .single();
  return { success: !error, data, error: error?.message };
}

// ── Cron: para todas las propiedades activas ─────────
export async function fetchAllPendingReviews() {
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('is_active', true);

  const results = [];
  for (const p of properties || []) {
    const fetched = await fetchTripAdvisorReviews(p.id);
    if (fetched.count > 0) {
      // Generar respuestas para reseñas pending
      const { data: pending } = await supabase
        .from('property_reviews')
        .select('id')
        .eq('property_id', p.id)
        .eq('status', 'pending')
        .limit(20);
      for (const rev of pending || []) {
        await generateReviewResponse(rev.id);
      }
    }
    results.push({ property: p.name, ...fetched });
  }
  return results;
}
