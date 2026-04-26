/**
 * Módulo de Escalación Inteligente
 *
 * Flujo:
 * 1. Detectar huéspedes frustrados o que piden atención humana
 * 2. Pausar la IA para esa conversación
 * 3. Notificar al equipo por WhatsApp con resumen completo
 * 4. El equipo responde directamente
 * 5. Equipo envía "REANUDAR {conversationId}" para que la IA retome
 *
 * Tablas Supabase:
 *   - escalations: { id, conversation_id, property_id, reason, summary, status, assigned_to, created_at, resolved_at }
 */
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp.js';
import { trackAnthropicUsage } from './aiUsageTracker.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TEAM_NUMBERS = [
  process.env.ESCALATION_WHATSAPP_1 || '+573057673770',
  process.env.ESCALATION_WHATSAPP_2 || '+573006526427'
];

// Patrones de frustración o solicitud de humano
const ESCALATION_PATTERNS = [
  // Frustración explícita
  /esto es (inaceptable|ridículo|terrible|horrible|un desastre)/i,
  /(muy )?mal (servicio|atención|trato)/i,
  /qué (pesadez|fastidio|mal rato)/i,
  /nunca (vuelvo|regreso|los recomiendo)/i,
  /voy a (quejarme|poner una queja|dejar una reseña negativa)/i,
  // Solicitud de humano
  /quiero (hablar|comunicarme) con (una persona|alguien|un humano|el gerente|la recepción)/i,
  /pásame (con|a) (alguien|una persona|el gerente)/i,
  /atiéndeme (un humano|una persona)/i,
  /agente (humano|real|de verdad)/i,
  /no (quiero|me gusta) (hablar|chatear) con (un bot|robots?|la IA|inteligencia artificial)/i,
  // Inglés
  /speak (to|with) (a human|a person|someone|a manager)/i,
  /human (agent|support|assistance)/i,
  /(this is|that's) (unacceptable|ridiculous|terrible)/i,
  /i want to (talk|speak) (to|with) (a|someone|a real|an actual) (person|human|agent)/i,
  // Urgencias
  /es (urgente|una emergencia)/i,
  /(hay|tengo) una emergencia/i,
  /urgent(ly)?|emergency/i
];

// ============================================================
// Detectar si debe escalar
// ============================================================
export function shouldEscalate(userMessage, messageCount = 0) {
  const isExplicit = ESCALATION_PATTERNS.some(p => p.test(userMessage));

  // También escalar si hay muchos mensajes sin resolución (>15 intercambios)
  const isLongConversation = messageCount > 15;

  return { escalate: isExplicit || isLongConversation, reason: isExplicit ? 'frustration_detected' : 'long_conversation' };
}

// ============================================================
// Crear escalación
// ============================================================
export async function createEscalation(conversationId, propertyId, reason, conversationHistory) {
  // Verificar si ya hay una escalación activa para esta conversación
  const { data: existing } = await supabase
    .from('escalations')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'open')
    .single();

  if (existing) return existing; // ya escalada

  // Resolver tenant_id del propertyId para trackear costo
  let tenantId = null;
  try {
    const { data: prop } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', propertyId)
      .maybeSingle();
    tenantId = prop?.tenant_id || null;
  } catch { /* sin tenant => tracking se salta */ }

  // Generar resumen del contexto
  const summary = await generateConversationSummary(conversationHistory, tenantId);

  // Guardar escalación en BD
  const { data: escalation, error } = await supabase
    .from('escalations')
    .insert({
      conversation_id: conversationId,
      property_id: propertyId,
      reason,
      summary,
      conversation_summary: summary,
      status: 'open'
    })
    .select()
    .single();

  if (error) throw error;

  // Pausar la IA para esta conversación
  await supabase
    .from('conversations')
    .update({ ai_paused: true, escalation_id: escalation.id })
    .eq('id', conversationId);

  // Notificar al equipo
  await notifyTeam(escalation, summary, conversationHistory);

  console.log(`[Escalation] Creada para conversación ${conversationId}: ${reason}`);
  return escalation;
}

// ============================================================
// Generar resumen de la conversación para el equipo
// Costo se trackea via aiUsageTracker — uso plataforma (escalation
// summaries no se cobran al tenant, los paga Alzio internamente).
// ============================================================
async function generateConversationSummary(conversationHistory, tenantId = null) {
  if (!conversationHistory?.length) return 'Sin historial disponible.';

  try {
    const historyText = conversationHistory
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'Huésped' : 'IA'}: ${m.content}`)
      .join('\n');

    const model = 'claude-sonnet-4-6';
    const response = await anthropic.messages.create({
      model,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Resume esta conversación de hostal en 3-4 líneas, enfocándote en: qué quiere el huésped, cuál es el problema y por qué se escaló:\n\n${historyText}`
      }]
    });

    // Trackear uso (no bloqueante)
    if (tenantId && response?.usage) {
      trackAnthropicUsage({
        tenantId,
        source: 'escalation',
        usage: response.usage,
        model,
        platformPaid: true,
      }).catch(() => {});
    }

    return response.content.find(b => b.type === 'text')?.text || 'Resumen no disponible.';
  } catch {
    const last = conversationHistory[conversationHistory.length - 1];
    return `Último mensaje del huésped: "${last?.content?.substring(0, 200) || 'N/A'}"`;
  }
}

// ============================================================
// Notificar al equipo por WhatsApp
// ============================================================
async function notifyTeam(escalation, summary, conversationHistory) {
  const lastMessage = conversationHistory?.slice(-1)[0];
  const reasonLabels = {
    frustration_detected: '😤 Huésped frustrado / solicita humano',
    long_conversation: '⏰ Conversación sin resolver (>15 mensajes)'
  };

  const msg = `🚨 *ESCALACIÓN — Mística AI*\n\n` +
    `*Motivo:* ${reasonLabels[escalation.reason] || escalation.reason}\n` +
    `*ID:* ${escalation.id}\n\n` +
    `📋 *Resumen:*\n${summary}\n\n` +
    `💬 *Último mensaje del huésped:*\n"${lastMessage?.content?.substring(0, 200) || 'N/A'}"\n\n` +
    `⚠️ La IA ha sido *pausada* para esta conversación.\n` +
    `El equipo debe responder al huésped directamente.\n\n` +
    `Para que la IA retome, envía:\n` +
    `*REANUDAR ${escalation.id}*`;

  for (const number of TEAM_NUMBERS) {
    try {
      await sendWhatsAppMessage(number, msg);
    } catch (err) {
      console.error(`[Escalation] Error notificando a ${number}:`, err.message);
    }
  }
}

// ============================================================
// Verificar si una conversación tiene IA pausada
// ============================================================
export async function isAiPaused(conversationId) {
  try {
    const { data } = await supabase
      .from('conversations')
      .select('ai_paused')
      .eq('id', conversationId)
      .single();
    return data?.ai_paused === true;
  } catch {
    return false;
  }
}

// ============================================================
// Reanudar IA (comando del equipo: "REANUDAR {id}")
// ============================================================
export async function resumeFromMessage(text, fromNumber) {
  // Solo el equipo puede reanudar
  if (!TEAM_NUMBERS.some(n => text.includes(n.replace('+', '')) || fromNumber === n)) {
    return false;
  }

  const match = text.match(/REANUDAR\s+([a-f0-9-]{36})/i);
  if (!match) return false;

  const escalationId = match[1];
  return await resolveEscalation(escalationId, 'team_resumed');
}

// ============================================================
// Resolver escalación y reanudar IA
// ============================================================
export async function resolveEscalation(escalationId, resolvedBy = 'manual') {
  try {
    const { data: escalation } = await supabase
      .from('escalations')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq('id', escalationId)
      .select('conversation_id')
      .single();

    if (!escalation) return false;

    // Reanudar IA
    await supabase
      .from('conversations')
      .update({ ai_paused: false })
      .eq('id', escalation.conversation_id);

    console.log(`[Escalation] Resuelta: ${escalationId} por ${resolvedBy}`);

    // Notificar al equipo que la IA fue reanudada
    const msg = `✅ *Mística AI reanudada*\n\nLa IA ha retomado la conversación ${escalationId}.`;
    for (const number of TEAM_NUMBERS) {
      try { await sendWhatsAppMessage(number, msg); } catch { /* silencioso */ }
    }

    return true;
  } catch (err) {
    console.error('[Escalation] Error resolviendo:', err.message);
    return false;
  }
}

// ============================================================
// Dashboard: listar escalaciones
// ============================================================
export async function getEscalations(propertyId, status = null) {
  let query = supabase
    .from('escalations')
    .select(`
      *,
      conversations (
        guest_name, guest_phone, guest_language, platform
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (propertyId) query = query.eq('property_id', propertyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export default {
  shouldEscalate, createEscalation, isAiPaused,
  resumeFromMessage, resolveEscalation, getEscalations
};
