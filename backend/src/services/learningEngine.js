/**
 * Motor de Aprendizaje Continuo
 *
 * Flujo:
 * 1. El agente detecta una pregunta que no puede responder bien
 * 2. Envía WhatsApp a +573057673770 y +573006526427 con la pregunta
 * 3. El staff responde por WhatsApp → webhook lo captura
 * 4. La respuesta se guarda en knowledge_base
 * 5. El agente consulta knowledge_base antes de responder
 *
 * Tablas Supabase:
 *   - knowledge_base: { id, property_id, question, answer, category, created_by, created_at, active }
 *   - whatsapp_learning_sessions: { id, property_id, question, message_id, status, response, created_at }
 */
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp.js';

const LEARNING_NUMBERS = [
  process.env.LEARNING_WHATSAPP_1 || '+573057673770',
  process.env.LEARNING_WHATSAPP_2 || '+573006526427'
];

// Palabras clave que indican que el agente no sabe responder
const UNCERTAINTY_PATTERNS = [
  /no (tengo|cuento con|dispongo de) información/i,
  /no (estoy seguro|puedo confirmar|sé exactamente)/i,
  /te recomiendo (contactar|comunicarte|llamar)/i,
  /para más (detalles|información), contacta/i,
  /nuestro equipo te (responderá|aclarará|confirmará)/i,
  /i (don't have|cannot confirm|am not sure about)/i,
  /please (contact|reach out|call) (us|our team)/i,
];

// ============================================================
// Detectar si el agente no supo responder
// ============================================================
export function detectUncertainty(agentResponse) {
  return UNCERTAINTY_PATTERNS.some(p => p.test(agentResponse));
}

// ============================================================
// Buscar en knowledge_base respuestas similares
// ============================================================
export async function searchKnowledgeBase(question, propertyId) {
  try {
    const { data } = await supabase
      .from('knowledge_base')
      .select('question, answer, category')
      .eq('active', true)
      .or(propertyId ? `property_id.eq.${propertyId},property_id.is.null` : 'property_id.is.null')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data?.length) return [];

    const questionLower = question.toLowerCase();
    const keywords = questionLower.split(/\s+/).filter(w => w.length > 3);

    return data
      .map(kb => {
        const kbLower = kb.question.toLowerCase();
        const matches = keywords.filter(k => kbLower.includes(k)).length;
        const relevance = keywords.length > 0 ? matches / keywords.length : 0;
        return { ...kb, relevance };
      })
      .filter(kb => kb.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);
  } catch (err) {
    console.error('[Learning] Error buscando KB:', err.message);
    return [];
  }
}

// ============================================================
// Formatear conocimiento base para el agente
// ============================================================
export function formatKnowledgeForPrompt(kbEntries) {
  if (!kbEntries?.length) return '';
  return `\n\n## CONOCIMIENTO BASE DEL EQUIPO\nUsa estos datos reales confirmados por el equipo para responder:\n\n` +
    kbEntries.map(kb => `**P: ${kb.question}**\nR: ${kb.answer}`).join('\n\n');
}

// ============================================================
// Enviar pregunta al equipo para aprender
// ============================================================
export async function requestLearning(question, propertyId, propertySlug, conversationId) {
  // Verificar si ya enviamos esta pregunta recientemente (últimas 24h)
  try {
    const { data: existing } = await supabase
      .from('whatsapp_learning_sessions')
      .select('id')
      .eq('status', 'pending')
      .or(`question.ilike.%${question.substring(0, 40)}%,original_client_question.ilike.%${question.substring(0, 40)}%`)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (existing) return; // ya enviamos esta pregunta
  } catch { /* no existe, continuar */ }

  // Guardar sesión de aprendizaje pendiente
  let sessionId;
  try {
    const { data: session } = await supabase
      .from('whatsapp_learning_sessions')
      .insert({
        property_id: propertyId,
        question,
        original_client_question: question,
        conversation_id: conversationId,
        asked_to_number: LEARNING_NUMBERS[0],
        status: 'pending'
      })
      .select('id')
      .single();
    sessionId = session?.id;
  } catch (err) {
    console.error('[Learning] Error guardando sesión:', err.message);
  }

  // E-AGENT-10 H-AGT-5 (2026-04-26): brand y propertyLabel dinámicos.
  // Antes hardcoded "Mística AI" + lookup por slug en el agente. Ahora
  // resolver desde tenants.business_name o properties.brand_name/name.
  let propertyLabel = propertySlug;
  let brand = 'Alzio';
  try {
    const { data: prop } = await supabase
      .from('properties')
      .select('name, brand_name, tenants(business_name)')
      .eq('id', propertyId)
      .maybeSingle();
    if (prop) {
      propertyLabel = prop.brand_name || prop.name || propertySlug;
      brand = prop.tenants?.business_name || prop.brand_name || brand;
    }
  } catch { /* fallback al slug */ }

  const msg = `🤖 *${brand} AI — Aprendizaje*\n\n` +
    `La IA no pudo responder correctamente esta pregunta de un huésped en *${propertyLabel}*:\n\n` +
    `❓ "${question}"\n\n` +
    `Por favor responde este mensaje con la respuesta correcta y la guardaré en mi base de conocimiento para futuras consultas.\n\n` +
    `_ID sesión: ${sessionId || 'N/A'}_`;

  for (const number of LEARNING_NUMBERS) {
    try {
      await sendWhatsAppMessage(number, msg);
    } catch (err) {
      console.error(`[Learning] Error enviando a ${number}:`, err.message);
    }
  }

  console.log(`[Learning] Pregunta enviada al equipo: "${question.substring(0, 60)}..."`);
}

// ============================================================
// Procesar respuesta del equipo (vía webhook de WhatsApp)
// ============================================================
export async function processStaffReply(fromNumber, replyText, contextMessageId) {
  // Buscar sesión pendiente por número autorizado
  if (!LEARNING_NUMBERS.includes(fromNumber) && !LEARNING_NUMBERS.some(n => fromNumber.includes(n.replace('+', '')))) {
    return false; // no es del equipo
  }

  // Buscar la sesión de aprendizaje pendiente más reciente
  try {
    // Buscar sesión pendiente por question o original_client_question
    const { data: session } = await supabase
      .from('whatsapp_learning_sessions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!session) return false;

    // Guardar en knowledge_base
    const question = session.question || session.original_client_question || '';
    await supabase.from('knowledge_base').insert({
      property_id: session.property_id,
      question,
      original_client_question: question,
      answer: replyText,
      category: 'staff_learning',
      source: 'whatsapp',
      created_by: fromNumber,
      active: true
    });

    // Marcar sesión como respondida
    await supabase
      .from('whatsapp_learning_sessions')
      .update({
        status: 'answered',
        response: replyText,
        answer_received: replyText,
        answered_at: new Date().toISOString(),
        answered_by_number: fromNumber
      })
      .eq('id', session.id);

    console.log(`[Learning] Nuevo conocimiento guardado desde ${fromNumber}: "${session.question.substring(0, 50)}"`);
    return true;
  } catch (err) {
    console.error('[Learning] Error procesando respuesta del staff:', err.message);
    return false;
  }
}

// ============================================================
// Dashboard: obtener base de conocimiento
// ============================================================
export async function getKnowledgeBase(propertyId, options = {}) {
  let query = supabase
    .from('knowledge_base')
    .select('*')
    .order('created_at', { ascending: false });

  if (propertyId) query = query.or(`property_id.eq.${propertyId},property_id.is.null`);
  if (options.active !== undefined) query = query.eq('active', options.active);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertKnowledge(entry) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .upsert(entry, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteKnowledge(id) {
  await supabase.from('knowledge_base').update({ active: false }).eq('id', id);
}

export async function getLearningPending() {
  const { data } = await supabase
    .from('whatsapp_learning_sessions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

export default {
  detectUncertainty, searchKnowledgeBase, formatKnowledgeForPrompt,
  requestLearning, processStaffReply, getKnowledgeBase, upsertKnowledge,
  deleteKnowledge, getLearningPending
};
