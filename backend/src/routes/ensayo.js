/**
 * Ensayo route — endpoint de chat de prueba con el agente.
 * Usa el mismo system prompt y tools que el agente real, pero NO persiste
 * en conversations/messages. Devuelve metadata adicional para el panel
 * de Ensayo (source, confidence, knowledgeUsed).
 */
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';
import { buildSystemPrompt as buildDynamicSystemPrompt } from '../services/systemPromptBuilder.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GUEST_PROFILES = {
  reservation:    'Viajero interesado en reservar — pregunta por fechas, precios, disponibilidad',
  complaint:      'Huésped con queja — está molesto por algún tema, espera resolución rápida',
  activities:     'Turista preguntando actividades — quiere saber qué puede hacer en el destino',
  refund:         'Huésped pidiendo reembolso — solicita devolución por algún motivo',
  price:          'Pregunta sobre precio — quiere comparar tarifas o pedir descuento',
};

// POST /api/ensayo/chat
router.post('/ensayo/chat', requireAuth, async (req, res) => {
  try {
    const {
      propertyId,
      message,
      conversationHistory = [],
      language = 'es',
      guestProfile = 'reservation',
      strictMode = false,
    } = req.body;

    if (!propertyId || !message) {
      return res.status(400).json({ error: 'propertyId y message requeridos' });
    }

    // Cargar datos de la propiedad + group_name del tenant + propiedades hermanas
    const { data: property } = await supabase
      .from('properties')
      .select('id, name, slug, tenant_id, location, tenants(group_name, group_description)')
      .eq('id', propertyId)
      .single();

    const groupName = property?.tenants?.group_name || 'nuestro grupo hotelero';
    const groupDescription = property?.tenants?.group_description || '';

    const { data: siblings } = property?.tenant_id
      ? await supabase
          .from('properties')
          .select('name, location')
          .eq('tenant_id', property.tenant_id)
          .eq('is_active', true)
      : { data: [] };

    const siblingsList = (siblings || [])
      .map(s => `• ${s.name}${s.location ? ` (${s.location})` : ''}`)
      .join('\n');

    // Caso especial: mensaje de inicio → presentación del grupo
    if (message === '__INIT__') {
      const greeting = {
        es: `Hola 👋, soy el asistente de ${groupName}. ${siblings?.length > 1 ? `Tenemos ${siblings.length} propiedades:\n${siblingsList}\n\n¿Con cuál te gustaría hablar o tienes alguna pregunta general del grupo?` : '¿En qué puedo ayudarte hoy?'}`,
        en: `Hi 👋, I'm the assistant of ${groupName}. ${siblings?.length > 1 ? `We have ${siblings.length} properties:\n${siblingsList}\n\nWhich one would you like info about, or do you have a general question?` : 'How can I help you today?'}`,
        fr: `Bonjour 👋, je suis l'assistant de ${groupName}. ${siblings?.length > 1 ? `Nous avons ${siblings.length} propriétés:\n${siblingsList}\n\nLaquelle vous intéresse?` : 'Comment puis-je vous aider?'}`,
        de: `Hallo 👋, ich bin der Assistent von ${groupName}. ${siblings?.length > 1 ? `Wir haben ${siblings.length} Unterkünfte:\n${siblingsList}\n\nWelche interessiert Sie?` : 'Wie kann ich helfen?'}`,
        pt: `Olá 👋, sou o assistente de ${groupName}. ${siblings?.length > 1 ? `Temos ${siblings.length} propriedades:\n${siblingsList}\n\nQual te interessa?` : 'Como posso ajudar?'}`,
      };
      return res.json({
        message: greeting[language] || greeting.es,
        metadata: {
          source: 'group_intro',
          confidence: 'alta',
          knowledge_used: true,
          model: 'static_greeting',
          guest_profile: guestProfile,
          strict_mode: strictMode,
        },
      });
    }

    // Construir system prompt dinámico desde property_knowledge
    let systemPrompt;
    try {
      systemPrompt = await buildDynamicSystemPrompt(propertyId, property?.tenant_id, {
        groupName,
        groupDescription,
        isMultiProperty: (siblings?.length || 0) > 1,
        allPropertyIds: (siblings || []).map(s => s.name),
      });
    } catch {
      systemPrompt = `Eres el agente de la propiedad ${property?.name || propertyId}.`;
    }

    // Modificar para modo ensayo + presentación del grupo
    const profileDesc = GUEST_PROFILES[guestProfile] || guestProfile;
    systemPrompt = `MODO ENSAYO ACTIVO — Esta es una simulación de prueba.
Estás siendo evaluado por el equipo del hotel. El perfil del huésped simulado es:
"${profileDesc}"

GRUPO HOTELERO
Perteneces al grupo: ${groupName}.${groupDescription ? ` ${groupDescription}` : ''}
${siblings?.length > 1 ? `Propiedades del grupo:\n${siblingsList}\n\nCuando un huésped pregunte por otras propiedades del grupo, puedes mencionarlas y ofrecer información.` : ''}

Idioma de la conversación: ${language}.
${strictMode ? '\nMODO ESTRICTO: SOLO usa información de property_knowledge. Si no sabes algo, responde "no tengo esa información configurada".' : ''}

────────────────────────────────────────
${systemPrompt}`;

    // Llamar a Claude
    const messages = [
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const aiText = response.content?.[0]?.text || '';

    // Heurísticas simples de metadata
    const usedKnowledge = aiText.length > 0 && /property_knowledge|grupo|propiedad|hotel|hostal/i.test(aiText);
    const confidence = aiText.length > 150 && usedKnowledge ? 'alta' : aiText.length > 60 ? 'media' : 'baja';
    const source = usedKnowledge ? 'property_knowledge' : 'IA general';

    res.json({
      message: aiText,
      metadata: {
        source,
        confidence,
        knowledge_used: usedKnowledge,
        model: 'claude-sonnet-4-6',
        guest_profile: guestProfile,
        strict_mode: strictMode,
        group_name: groupName,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
