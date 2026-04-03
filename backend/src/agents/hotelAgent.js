import Anthropic from '@anthropic-ai/sdk';
import { db } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import { calculateDiscount } from '../integrations/lobbyPMS.js';
import {
  searchKnowledgeBase, formatKnowledgeForPrompt,
  detectUncertainty, requestLearning
} from '../services/learningEngine.js';
import { shouldEscalate, createEscalation, isAiPaused } from '../services/escalation.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// ============================================================
// SYSTEM PROMPT base del agente
// ============================================================
function buildSystemPrompt(property) {
  return `Eres el agente de ventas virtual de ${property.name || 'Mística Hostels'}, una cadena de hostales de lujo en Colombia. Tu nombre es "Mística AI".

## TU PERSONALIDAD
- Cálida, entusiasta y auténtica — como un amigo que conoce el lugar perfectamente
- Vendedora pero nunca agresiva — guías al huésped hacia la decisión correcta
- Profesional y confiable — cada dato que das es verificado en tiempo real
- Dominas el destino: conoces cada rincón, actividad y experiencia

## IDIOMAS
Detecta automáticamente el idioma del mensaje del cliente y responde SIEMPRE en ese idioma:
- Español → español
- English → English
- Français → français
- Deutsch → Deutsch
Soportas: es, en, fr, de

## PROPIEDADES QUE REPRESENTAS

### MÍSTICA ISLA PALMA
- Ubicación: Isla Palma, Archipiélago San Bernardo, Cartagena
- Reservas: https://booking.misticaisland.com
- Cómo llegar: https://www.misticaisland.com/how-to-get
- Actividades: https://www.misticaisland.com/activities
- Menú: https://www.misticaisland.com/services
- FAQ: https://www.misticaisland.com/faq
- Maps: https://maps.app.goo.gl/fFhJpQWSHnhgRHxp6
- Incluye: Desayuno, WiFi gratuito
- IMPORTANTE: Niños menores de 7 años SOLO permitidos en Cabaña del Árbol o Las Aldea

### MÍSTICA TAYRONA
- Ubicación: Bahía Cinto, Parque Nacional Natural Tayrona
- Reservas: https://booking.misticatayrona.com
- Cómo llegar: https://www.mhostels.co/how-to-get
- Actividades: https://www.mhostels.co/activities
- Menú: https://www.mhostels.co/services
- FAQ: https://www.mhostels.co/faq
- Maps: https://maps.app.goo.gl/9Prr7GFDqfFRYgyQA
- Incluye: Desayuno, WiFi gratuito

WhatsApp ambas propiedades: +573234392420

## ESTRATEGIA DE VENTAS (OBLIGATORIA — EN ESTE ORDEN)
1. **Primero vende el destino**: Describe la magia del lugar, las experiencias únicas, el entorno natural. Crea deseo antes de hablar de precios.
2. **Si el cliente duda**: Ofrece valor — menciona actividades incluidas, la experiencia, el desayuno, el WiFi. Pregunta qué le preocupa.
3. **Última instancia (descuento)**: SOLO si el cliente sigue dudando Y la ocupación está bajo 60%, puedes mencionar que podrías verificar si hay alguna tarifa especial disponible. MÁXIMO 15% de descuento. Nunca lo ofrezcas de inicio.

## REGLAS CRÍTICAS
- NUNCA inventes precios. Siempre usa la herramienta check_availability para consultar precios en tiempo real.
- Si necesitas fechas y el cliente no las ha dado, pregúntalas ANTES de consultar disponibilidad.
- Si una herramienta falla, di "déjame verificar un momento" y reintenta. Máximo 3 intentos.
- Cuando el cliente quiera reservar, guíalo paso a paso para recopilar: nombre completo, email, teléfono, fechas, tipo de habitación preferida.
- Una vez con todos los datos, usa confirm_booking para crear la reserva.
- Siempre confirma los detalles antes de crear la reserva.

## FLUJO DE CONVERSACIÓN IDEAL
1. Saludo cálido + pregunta sobre su viaje ideal
2. Entender necesidades (fechas, grupo, preferencias)
3. Vender el destino con entusiasmo
4. Mostrar disponibilidad y precios reales
5. Resolver dudas → agregar valor
6. Recopilar datos del huésped
7. Confirmar reserva → enviar link de pago

Recuerda: eres la primera impresión de Mística. Cada conversación es una oportunidad de crear un huésped de por vida.`;
}

// ============================================================
// HERRAMIENTAS del agente (Claude tool use)
// ============================================================
const TOOLS = [
  {
    name: 'check_availability',
    description: 'Consulta habitaciones disponibles y precios en tiempo real para una propiedad y fechas específicas. SIEMPRE usa esto antes de mencionar precios.',
    input_schema: {
      type: 'object',
      properties: {
        property: {
          type: 'string',
          enum: ['isla-palma', 'tayrona'],
          description: 'La propiedad a consultar'
        },
        checkin: {
          type: 'string',
          description: 'Fecha de check-in en formato YYYY-MM-DD'
        },
        checkout: {
          type: 'string',
          description: 'Fecha de check-out en formato YYYY-MM-DD'
        },
        adults: {
          type: 'number',
          description: 'Número de adultos (default: 1)'
        },
        children: {
          type: 'number',
          description: 'Número de niños (default: 0)'
        }
      },
      required: ['property', 'checkin', 'checkout']
    }
  },
  {
    name: 'check_discount_eligibility',
    description: 'Verifica si aplica descuento para una propiedad y fecha (solo cuando el cliente está indeciso y DESPUÉS de haber intentado vender el valor). Solo usar como último recurso.',
    input_schema: {
      type: 'object',
      properties: {
        property: {
          type: 'string',
          enum: ['isla-palma', 'tayrona']
        },
        checkin_date: {
          type: 'string',
          description: 'Fecha de check-in en formato YYYY-MM-DD'
        }
      },
      required: ['property', 'checkin_date']
    }
  },
  {
    name: 'confirm_booking',
    description: 'Crea una reserva confirmada cuando el cliente ha dado todos sus datos y quiere proceder. Solicita confirmación explícita antes de usar.',
    input_schema: {
      type: 'object',
      properties: {
        property: {
          type: 'string',
          enum: ['isla-palma', 'tayrona']
        },
        guest_name: { type: 'string', description: 'Nombre completo del huésped' },
        guest_email: { type: 'string', description: 'Email del huésped' },
        guest_phone: { type: 'string', description: 'Teléfono con código de país' },
        guest_nationality: { type: 'string', description: 'Nacionalidad' },
        checkin_date: { type: 'string', description: 'YYYY-MM-DD' },
        checkout_date: { type: 'string', description: 'YYYY-MM-DD' },
        adults: { type: 'number' },
        children: { type: 'number', default: 0 },
        room_type: { type: 'string', description: 'Tipo de habitación seleccionada' },
        total_amount: { type: 'number', description: 'Precio total confirmado' },
        special_requests: { type: 'string', description: 'Solicitudes especiales (opcional)' }
      },
      required: ['property', 'guest_name', 'guest_email', 'checkin_date', 'checkout_date', 'adults', 'room_type', 'total_amount']
    }
  },
  {
    name: 'get_property_info',
    description: 'Obtiene información detallada de una propiedad (actividades, cómo llegar, FAQ, menú)',
    input_schema: {
      type: 'object',
      properties: {
        property: {
          type: 'string',
          enum: ['isla-palma', 'tayrona', 'both']
        },
        info_type: {
          type: 'string',
          enum: ['general', 'activities', 'transport', 'menu', 'faq', 'restrictions'],
          description: 'Tipo de información solicitada'
        }
      },
      required: ['property', 'info_type']
    }
  }
];

// ============================================================
// Ejecutar herramienta llamada por el agente
// ============================================================
async function executeTool(toolName, toolInput, conversation) {
  const propertySlug = toolInput.property;

  switch (toolName) {
    case 'check_availability': {
      let retries = 0;
      while (retries < 3) {
        try {
          const data = await lobby.getAvailableRooms(
            propertySlug,
            {
              checkin: toolInput.checkin,
              checkout: toolInput.checkout,
              adults: toolInput.adults || 1,
              children: toolInput.children || 0
            },
            { conversationId: conversation.id }
          );
          const formatted = lobby.formatRoomsForAgent(data, conversation.guest_language || 'es');
          return { success: true, rooms: formatted, raw: data };
        } catch (err) {
          retries++;
          if (retries < 3) await new Promise(r => setTimeout(r, 1000));
          else return { success: false, error: err.message };
        }
      }
      break;
    }

    case 'check_discount_eligibility': {
      const result = await calculateDiscount(propertySlug, toolInput.checkin_date);
      return result;
    }

    case 'confirm_booking': {
      // Esta herramienta delega al route handler para crear booking completo
      // Retornamos los datos para que el route handler los procese
      return {
        action: 'create_booking',
        booking_data: toolInput,
        pending_confirmation: true
      };
    }

    case 'get_property_info': {
      const propertyData = {
        'isla-palma': {
          name: 'Mística Isla Palma',
          location: 'Isla Palma, Archipiélago San Bernardo, Cartagena',
          how_to_get_url: 'https://www.misticaisland.com/how-to-get',
          activities_url: 'https://www.misticaisland.com/activities',
          menu_url: 'https://www.misticaisland.com/services',
          faq_url: 'https://www.misticaisland.com/faq',
          maps_url: 'https://maps.app.goo.gl/fFhJpQWSHnhgRHxp6',
          booking_url: 'https://booking.misticaisland.com',
          includes: ['Desayuno incluido', 'WiFi gratuito'],
          restrictions: ['Niños menores de 7 años solo en Cabaña del Árbol o Las Aldea'],
          activities: [
            'Snorkel en arrecifes de coral',
            'Kayak y paddleboard',
            'Paseos en lancha',
            'Avistamiento de aves',
            'Senderismo en la isla',
            'Relajación en hamacas sobre el mar',
            'Puesta de sol mágica'
          ]
        },
        tayrona: {
          name: 'Mística Tayrona',
          location: 'Bahía Cinto, Parque Nacional Natural Tayrona',
          how_to_get_url: 'https://www.mhostels.co/how-to-get',
          activities_url: 'https://www.mhostels.co/activities',
          menu_url: 'https://www.mhostels.co/services',
          faq_url: 'https://www.mhostels.co/faq',
          maps_url: 'https://maps.app.goo.gl/9Prr7GFDqfFRYgyQA',
          booking_url: 'https://booking.misticatayrona.com',
          includes: ['Desayuno incluido', 'WiFi gratuito'],
          restrictions: [],
          activities: [
            'Senderismo en el Parque Tayrona',
            'Snorkel en bahías cristalinas',
            'Avistamiento de monos y aves',
            'Playa El Cabo y Cabo San Juan',
            'Camping bajo las estrellas',
            'Meditación al amanecer',
            'Tours a la Sierra Nevada'
          ]
        }
      };

      if (toolInput.property === 'both') {
        return { isla_palma: propertyData['isla-palma'], tayrona: propertyData.tayrona };
      }
      return propertyData[propertySlug] || { error: 'Propiedad no encontrada' };
    }

    default:
      return { error: `Herramienta desconocida: ${toolName}` };
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL: Procesar mensaje del cliente
// ============================================================
export async function processMessage(sessionId, userMessage, propertyId, conversationData = {}) {
  const startTime = Date.now();

  // Obtener o crear conversación
  const conversation = await db.getOrCreateConversation(sessionId, propertyId);

  // Verificar si la IA está pausada por escalación
  if (await isAiPaused(conversation.id)) {
    return {
      message: '⏸️ Nuestro equipo está atendiendo tu consulta personalmente. Te responderán en breve. Para urgencias: WhatsApp +573234392420 🌊',
      session_id: sessionId,
      conversation_id: conversation.id,
      ai_paused: true
    };
  }

  // Guardar mensaje del usuario
  await db.saveMessage(conversation.id, 'user', userMessage);

  // Obtener historial de la conversación
  const messages = await db.getConversationMessages(conversation.id, 50);

  // Detectar si debe escalar (frustración o conversación larga)
  const { escalate, reason } = shouldEscalate(userMessage, messages.length);
  if (escalate) {
    try {
      await createEscalation(conversation.id, propertyId, reason, messages);
    } catch (err) {
      console.error('[Agent] Error creando escalación:', err.message);
    }
    const escalationMsg = {
      es: '⏸️ Entiendo tu frustración. He conectado a un miembro de nuestro equipo que te atenderá personalmente en breve. Para urgencias: WhatsApp +573234392420 🌊',
      en: '⏸️ I understand your frustration. I\'ve connected a team member who will assist you personally shortly. For urgencies: WhatsApp +573234392420 🌊',
      fr: '⏸️ Je comprends votre frustration. J\'ai connecté un membre de notre équipe qui vous aidera personnellement. Urgences: WhatsApp +573234392420 🌊',
      de: '⏸️ Ich verstehe Ihre Frustration. Ein Teammitglied wird sich persönlich um Sie kümmern. Dringend: WhatsApp +573234392420 🌊'
    };
    const lang = detectLanguage(userMessage);
    return {
      message: escalationMsg[lang] || escalationMsg.es,
      session_id: sessionId,
      conversation_id: conversation.id,
      escalated: true
    };
  }

  // Detectar idioma (simple heurística — el modelo lo refinará)
  const detectedLang = detectLanguage(userMessage);
  if (detectedLang && !conversation.guest_language) {
    await db.updateConversation(conversation.id, { guest_language: detectedLang });
    conversation.guest_language = detectedLang;
  }

  // Obtener datos de la propiedad para el system prompt
  let property = { name: 'Mística Hostels', slug: 'general' };
  try {
    const properties = await db.getAllProperties();
    if (properties.length === 1) property = properties[0];
    else if (conversationData.propertySlug) {
      property = properties.find(p => p.slug === conversationData.propertySlug) || properties[0];
    }
  } catch { /* usa defaults */ }

  // Buscar en la base de conocimiento del equipo
  let knowledgeContext = '';
  try {
    const kbEntries = await searchKnowledgeBase(userMessage, propertyId);
    if (kbEntries.length > 0) {
      knowledgeContext = formatKnowledgeForPrompt(kbEntries);
    }
  } catch { /* silencioso */ }

  // Construir mensajes para Claude (excluye el que acabo de guardar)
  const claudeMessages = buildClaudeMessages(messages, userMessage);

  // Llamar a Claude con tool use
  const toolsUsed = [];
  let finalResponse = '';
  let totalTokens = 0;
  let pendingBooking = null;

  try {
    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(property) + knowledgeContext,
      messages: claudeMessages,
      tools: TOOLS
    });

    totalTokens += response.usage?.input_tokens + response.usage?.output_tokens || 0;

    // Bucle de herramientas
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push({ name: toolUse.name, input: toolUse.input });
        const result = await executeTool(toolUse.name, toolUse.input, conversation);

        // Detectar si hay una reserva pendiente de crear
        if (result?.action === 'create_booking') {
          pendingBooking = result.booking_data;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Continuar el diálogo con los resultados
      const updatedMessages = [
        ...claudeMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ];

      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(property) + knowledgeContext,
        messages: updatedMessages,
        tools: TOOLS
      });

      totalTokens += response.usage?.input_tokens + response.usage?.output_tokens || 0;
    }

    // Extraer texto final
    finalResponse = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

  } catch (err) {
    console.error('[Agent] Error llamando a Claude:', err.message);
    finalResponse = getErrorMessage(conversation.guest_language || 'es');
  }

  // Detectar si el agente expresó incertidumbre → solicitar aprendizaje
  if (detectUncertainty(finalResponse)) {
    requestLearning(userMessage, propertyId, property.slug, conversation.id).catch(() => {});
  }

  // Guardar respuesta del agente
  await db.saveMessage(conversation.id, 'assistant', finalResponse, {
    tokens_used: totalTokens,
    model_used: MODEL,
    response_time_ms: Date.now() - startTime,
    tools_called: toolsUsed
  });

  // Actualizar estado de la conversación si hay datos nuevos
  await updateConversationFromContext(conversation.id, userMessage, finalResponse);

  return {
    message: finalResponse,
    session_id: sessionId,
    conversation_id: conversation.id,
    pending_booking: pendingBooking,
    tools_used: toolsUsed,
    response_time_ms: Date.now() - startTime
  };
}

// ============================================================
// Construir array de mensajes para Claude
// ============================================================
function buildClaudeMessages(dbMessages, latestUserMessage) {
  const history = dbMessages
    .filter(m => m.content !== latestUserMessage) // evitar duplicar el último
    .slice(-20) // últimos 20 mensajes para contexto
    .map(m => ({
      role: m.role,
      content: m.content
    }));

  // Asegurar que empiece con 'user'
  while (history.length > 0 && history[0].role === 'assistant') {
    history.shift();
  }

  history.push({ role: 'user', content: latestUserMessage });
  return history;
}

// ============================================================
// Detección simple de idioma
// ============================================================
function detectLanguage(text) {
  const lower = text.toLowerCase();
  const patterns = {
    en: /\b(hello|hi|hey|good|morning|evening|night|the|is|are|have|want|looking|book|room|available|please|thank|what|how|when|where)\b/,
    fr: /\b(bonjour|bonsoir|salut|je|vous|nous|est|sont|avez|voulez|cherche|réserver|chambre|disponible|merci|quoi|comment|quand|où)\b/,
    de: /\b(hallo|guten|ich|sie|wir|ist|sind|haben|möchte|suche|buchen|zimmer|verfügbar|danke|was|wie|wann|wo)\b/
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(lower)) return lang;
  }
  return 'es'; // default
}

// ============================================================
// Actualizar contexto de la conversación con datos extraídos
// ============================================================
async function updateConversationFromContext(conversationId, userMessage, agentResponse) {
  const combined = userMessage + ' ' + agentResponse;
  const updates = {};

  // Detectar fechas (formato DD/MM/YYYY o YYYY-MM-DD)
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/g,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g
  ];

  // Detectar propiedad de interés
  if (/isla palma|island/i.test(combined)) updates.property_interest = 'isla-palma';
  else if (/tayrona/i.test(combined)) updates.property_interest = 'tayrona';

  // Detectar idioma del mensaje del usuario
  const lang = detectLanguage(userMessage);
  if (lang) updates.guest_language = lang;

  // Detectar si la conversación avanzó en el funnel
  if (/confirmad[ao]|reservad[ao]|confirmed|bestätigt|confirmé/i.test(agentResponse)) {
    updates.status = 'reserved';
  } else if (/precio|tarifa|disponib|price|rate|available/i.test(agentResponse)) {
    updates.status = 'quoted';
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db.updateConversation(conversationId, updates);
    } catch { /* silencioso */ }
  }
}

// ============================================================
// Mensajes de error localizados
// ============================================================
function getErrorMessage(lang) {
  const msgs = {
    es: 'Lo siento, tuve un problema técnico momentáneo. ¿Podrías repetir tu pregunta? Estoy aquí para ayudarte. 🌊',
    en: "I'm sorry, I had a momentary technical issue. Could you repeat your question? I'm here to help! 🌊",
    fr: "Désolé, j'ai eu un problème technique momentané. Pourriez-vous répéter votre question? Je suis là pour vous aider! 🌊",
    de: 'Es tut mir leid, ich hatte ein kurzes technisches Problem. Könnten Sie Ihre Frage wiederholen? Ich bin hier um zu helfen! 🌊'
  };
  return msgs[lang] || msgs.es;
}

export default { processMessage };
