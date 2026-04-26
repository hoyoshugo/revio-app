import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../models/supabase.js';
import { getGoogleReviews } from './socialChannels.js';
import { trackAnthropicUsage } from './aiUsageTracker.js';

/**
 * Auditoría automática de plataformas (Google, TripAdvisor, etc.)
 * Lee reviews recientes, las clasifica con Claude y guarda en platform_audits.
 */
export async function runPlatformAudit(tenantId, propertyId) {
  console.log(JSON.stringify({
    level: 'info', event: 'platform_audit_started', tenantId, propertyId,
  }));

  // Lee credenciales de la propiedad desde settings.connections
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('property_id', propertyId)
    .eq('key', 'connections')
    .maybeSingle();

  const connections = setting?.value || {};
  const results = [];

  // Google Business — lee de connections.google
  const googleConn = connections.google;
  const googlePlaceId = googleConn?.place_id || process.env[`GOOGLE_LOCATION_ID_${propertyId}`];
  if (googlePlaceId && process.env.GOOGLE_API_KEY) {
    const reviews = await getGoogleReviews(googlePlaceId, process.env.GOOGLE_API_KEY);
    if (reviews.length > 0) {
      const audit = await analyzeReviews('google', reviews, tenantId);
      const avgRating = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;

      await supabase.from('platform_audits').insert({
        tenant_id: tenantId,
        property_id: propertyId,
        platform: 'google',
        audit_type: 'weekly',
        total_reviews: reviews.length,
        avg_rating: Number(avgRating.toFixed(2)),
        sentiment_positive: audit.positive,
        sentiment_negative: audit.negative,
        sentiment_neutral: audit.neutral,
        key_issues: audit.issues,
        recommendations: audit.recommendations,
      });
      results.push({ platform: 'google', ...audit, avgRating });
    }
  }

  return results;
}

async function analyzeReviews(platform, reviews, tenantId = null) {
  if (!reviews.length || !process.env.ANTHROPIC_API_KEY) {
    return { positive: 0, negative: 0, neutral: 0, issues: [], recommendations: [] };
  }

  const reviewTexts = reviews
    .slice(0, 20)
    .map(r => `[${r.rating || '?'}★] ${r.text || r.review || r.comment || ''}`)
    .join('\n---\n');

  try {
    const model = 'claude-haiku-4-5-20251001';
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Analiza estas reseñas de ${platform} y responde SOLO con JSON válido:
{"positive": int, "negative": int, "neutral": int, "issues": ["max 5"], "recommendations": ["max 5"]}

Reseñas:
${reviewTexts}`
      }]
    });

    // Trackear costo (no bloqueante). Audits los paga Alzio platform.
    if (tenantId && response?.usage) {
      trackAnthropicUsage({
        tenantId,
        source: 'audit',
        usage: response.usage,
        model,
        platformPaid: true,
      }).catch(() => {});
    }

    const text = response.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error('analyzeReviews error:', e.message);
    return { positive: 0, negative: 0, neutral: 0, issues: [], recommendations: [] };
  }
}
