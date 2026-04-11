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

    // Construir system prompt dinámico desde property_knowledge
    let systemPrompt;
    try {
      systemPrompt = await buildDynamicSystemPrompt(propertyId);
    } catch {
      systemPrompt = `Eres el agente de la propiedad ${propertyId}.`;
    }

    // Modificar para modo ensayo
    const profileDesc = GUEST_PROFILES[guestProfile] || guestProfile;
    systemPrompt = `MODO ENSAYO ACTIVO — Esta es una simulación de prueba.
Estás siendo evaluado por el equipo del hotel. El perfil del huésped simulado es:
"${profileDesc}"

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
    const usedKnowledge = aiText.length > 0 && /isla palma|tayrona|wompi|lobby|caribbean/i.test(aiText);
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
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
