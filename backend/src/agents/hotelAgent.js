import Anthropic from '@anthropic-ai/sdk';
import { db, supabase } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import { calculateDiscount } from '../integrations/lobbyPMS.js';
import {
  searchKnowledgeBase, formatKnowledgeForPrompt,
  detectUncertainty, requestLearning
} from '../services/learningEngine.js';
import { shouldEscalate, createEscalation, isAiPaused } from '../services/escalation.js';
import {
  getMoonPhase,
  getBioluminescenceDates,
  getColombiaHolidays,
  isLongWeekend,
  saveContact,
  requestApproval,
  sendReservationReport,
  getCaribbeanSchedules,
} from '../services/agentUtils.js';
import { buildSystemPrompt as buildDynamicSystemPrompt } from '../services/systemPromptBuilder.js';
import {
  getTransportOptions,
  formatTransportForAgent,
  createTransportReservation,
} from '../integrations/transport/caribbeanTreasures.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// ============================================================
// Cargar base de conocimiento dinámica desde Supabase
// ============================================================
async function loadPropertyKnowledge(propertyId) {
  try {
    const { data, error } = await supabase
      .from('property_knowledge')
      .select('category, key, value')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('category')
      .order('sort_order');
    if (error || !data || data.length === 0) return '';

    // Agrupar por categoría
    const grouped = {};
    for (const row of data) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(`- ${row.key}: ${row.value}`);
    }

    const CATEGORY_LABELS = {
      general: 'Información General',
      rooms: 'Habitaciones y Tipos',
      policies: 'Políticas (Check-in/out, cancelación)',
      activities: 'Actividades y Experiencias',
      transport: 'Cómo Llegar y Transporte',
      faq: 'Preguntas Frecuentes',
      restrictions: 'Restricciones Importantes',
      menu: 'Menú y Restaurante',
      contact: 'Contacto y Emergencias',
    };

    let sections = ['\n## BASE DE CONOCIMIENTO DE LA PROPIEDAD (dinámico, prioridad alta)'];
    for (const [cat, items] of Object.entries(grouped)) {
      sections.push(`\n### ${CATEGORY_LABELS[cat] || cat}`);
      sections.push(items.join('\n'));
    }
    return sections.join('\n');
  } catch {
    return '';
  }
}

// ============================================================
// Cargar intensidad de ventas desde settings
// ============================================================
const SALES_INTENSITY_PROMPTS = {
  soft: `
## INTENSIDAD DE VENTAS: SUAVE
- Sé informativo y servicial. No presiones.
- Máximo 1 seguimiento automático (a las 24 horas).
- Nunca uses frases de urgencia como "¡Últimas habitaciones!" a menos que sea verdad confirmada.
- Ofrece descuentos solo si el cliente lo solicita explícitamente.`,

  moderate: `
## INTENSIDAD DE VENTAS: MODERADA (por defecto)
- Vende con entusiasmo pero respeta el ritmo del cliente.
- Hasta 2-3 seguimientos: 6h → 24h → 72h.
- Puedes mencionar disponibilidad limitada si es real.
- Ofrece descuento como último recurso (solo si ocupación < umbral).`,

  intense: `
## INTENSIDAD DE VENTAS: INTENSA
- Prioriza cerrar la reserva en cada interacción.
- 3 seguimientos: 2h → 6h → 24h.
- Usa urgencia con base en datos reales: "Solo quedan X habitaciones".
- Escala descuentos gradualmente: empieza con 5%, sube a 10%, luego 15% máximo.
- Cierre proactivo: después de mostrar disponibilidad, pregunta directamente "¿Te confirmo estas fechas?"`,
};

async function loadSalesIntensity(propertyId) {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('property_id', propertyId)
      .eq('key', 'agent')
      .single();
    return data?.value?.sales_intensity || 'moderate';
  } catch {
    return 'moderate';
  }
}

// ============================================================
// SYSTEM PROMPT base del agente
// ============================================================
function buildSystemPrompt(property, dynamicKnowledge = '', salesIntensity = 'moderate') {
  const agentName = property.agent_name || `${property.name} AI`;
  const groupLine = property.group_name
    ? `\n## GRUPO HOTELERO\nPerteneces al grupo hotelero: **${property.group_name}**.${property.group_description ? ` ${property.group_description}` : ''}\nCuando un huésped pregunte por otras propiedades del grupo, puedes mencionarlas y ofrecer información.\n`
    : '';

  return `Eres el agente de ventas virtual de ${property.name}, un alojamiento en ${property.country || 'Colombia'}. Tu nombre es "${agentName}".

## TU PERSONALIDAD
- Cálida, entusiasta y auténtica — como un amigo que conoce el lugar perfectamente
- Vendedora pero nunca agresiva — guías al huésped hacia la decisión correcta
- Profesional y confiable — cada dato que das es verificado en tiempo real
- Dominas el destino: conoces cada rincón, actividad y experiencia
${groupLine}
## IDIOMAS
Detecta automáticamente el idioma del mensaje del cliente y responde SIEMPRE en ese idioma:
- Español → español
- English → English
- Français → français
- Deutsch → Deutsch
- Português → português
Soportas: es, en, fr, de, pt. Si el idioma del cliente no es ninguno de estos, responde en inglés.

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

Recuerda: eres la primera impresión de ${property.name}. Cada conversación es una oportunidad de crear un huésped de por vida.
${SALES_INTENSITY_PROMPTS[salesIntensity] || SALES_INTENSITY_PROMPTS.moderate}${dynamicKnowledge}`;
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
          description: 'El slug de la propiedad a consultar'
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
          description: 'El slug de la propiedad'
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
          description: 'El slug de la propiedad (ej: isla-palma, tayrona)'
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
          description: 'El slug de la propiedad, o "both" para ambas'
        },
        info_type: {
          type: 'string',
          enum: ['general', 'activities', 'transport', 'menu', 'faq', 'restrictions'],
          description: 'Tipo de información solicitada'
        }
      },
      required: ['property', 'info_type']
    }
  },
  {
    name: 'check_moon_phase',
    description: 'Verifica la fase lunar actual para saber si es posible ofrecer el tour de plancton bioluminiscente. El tour SOLO se puede hacer con luna oculta. Devuelve la fase actual y las próximas fechas válidas.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, default hoy)' },
        days_ahead: { type: 'number', description: 'Cuántos días mirar adelante (default 14)' }
      }
    }
  },
  {
    name: 'save_guest_contact',
    description: 'Guarda los datos del huésped en el CRM para seguimiento posterior por WhatsApp/email. Llamar SIEMPRE que el cliente proporcione su nombre+teléfono o nombre+email.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', description: 'Con código país, ej +573001234567' },
        email: { type: 'string' },
        language: { type: 'string', description: 'es|en|fr|de|pt' },
        source: { type: 'string', description: 'whatsapp|instagram|facebook|booking|airbnb|web' }
      },
      required: ['name']
    }
  },
  {
    name: 'request_approval',
    description: 'Solicita aprobación al gerente para un upgrade, descuento especial, actividad gratis o cualquier oferta fuera de política. NO ofrezcas nada gratis al huésped sin haber recibido aprobación primero. Tipos: upgrade, discount, free_activity, refund, special_offer, invoice.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['upgrade', 'discount', 'free_activity', 'refund', 'special_offer', 'invoice'] },
        description: { type: 'string', description: 'Descripción clara de lo que se pide' },
        guest_name: { type: 'string' },
        guest_contact: { type: 'string' },
        amount_cop: { type: 'number', description: 'Monto en COP si aplica' }
      },
      required: ['type', 'description', 'guest_name']
    }
  },
  {
    name: 'get_transport_options',
    description: 'Consulta opciones de transporte disponibles (Caribbean Treasures) entre un origen y la isla para una fecha. Úsalo cuando el cliente pregunta cómo llegar.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Cartagena, Rincón del Mar, Tintipán, Tolú' },
        destination: { type: 'string', description: 'Islas de San Bernardo o Isla Palma' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        passengers: { type: 'number', description: 'Número de pasajeros' }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'reserve_transport',
    description: 'Crea una reserva de transporte con Caribbean Treasures. Úsalo SOLO después de haber confirmado fecha, pasajeros y ruta con el huésped.',
    input_schema: {
      type: 'object',
      properties: {
        route_code: { type: 'string', description: 'CTG-ISL | RIN-ISL | ISL-CTG | RIN-CTG' },
        date: { type: 'string' },
        passengers: { type: 'number' },
        guest_name: { type: 'string' },
        guest_email: { type: 'string' },
        guest_phone: { type: 'string' },
        revio_reservation_id: { type: 'string', description: 'ID de la reserva Revio asociada (si existe)' }
      },
      required: ['route_code', 'date', 'passengers', 'guest_name']
    }
  },
  {
    name: 'create_cancellation_case',
    description: 'Crea un caso de cancelación con número de seguimiento. Úsalo cuando el cliente solicita cancelar. Evalúa primero las políticas y luego crea el caso. El caso va al gerente para aprobación del reembolso.',
    input_schema: {
      type: 'object',
      properties: {
        reservation_id: { type: 'string' },
        guest_name: { type: 'string' },
        guest_email: { type: 'string' },
        guest_phone: { type: 'string' },
        reason: { type: 'string', description: 'Motivo declarado por el huésped' },
        refund_amount_cop: { type: 'number', description: 'Monto calculado según política' }
      },
      required: ['guest_name', 'reason']
    }
  }
];

// ============================================================
// Ejecutar herramienta llamada por el agente
// ============================================================
async function executeTool(toolName, toolInput, conversation, propertyId) {
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
            { conversationId: conversation.id, propertyId }
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
      const result = await calculateDiscount(propertySlug, toolInput.checkin_date, { propertyId });
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
      // Lee info de la propiedad desde property_knowledge (multi-tenant).
      // NO contiene datos hardcodeados de ningún cliente.
      try {
        const targetId = propertyId;
        if (!targetId) return { error: 'property_id no disponible' };

        const { data: rows } = await supabase
          .from('property_knowledge')
          .select('category, key, value')
          .eq('property_id', targetId)
          .eq('is_active', true);

        const grouped = {};
        for (const row of rows || []) {
          if (!grouped[row.category]) grouped[row.category] = {};
          grouped[row.category][row.key] = row.value;
        }

        if (!Object.keys(grouped).length) {
          return { error: 'Propiedad sin información configurada. Pide al administrador que complete la Info Propiedad en Settings.' };
        }

        return {
          name: grouped.general?.nombre || 'Propiedad',
          type: grouped.general?.tipo || null,
          location: grouped.general?.ubicacion || null,
          gps: grouped.general?.gps || null,
          languages: grouped.general?.idiomas || null,
          includes: grouped.general?.incluye || null,
          environment: grouped.general?.entorno || null,
          policies: {
            checkin: grouped.policies?.checkin,
            checkout: grouped.policies?.checkout,
            cancellation: grouped.policies?.cancelacion,
            pets: grouped.policies?.mascotas,
            children: grouped.policies?.restriccion_ninos,
          },
          activities: {
            listing: grouped.activities?.listado,
            critical_note: grouped.activities?.nota_critica,
            bioluminescence_rule: grouped.activities?.bioluminiscencia_regla,
            url: grouped.activities?.link,
          },
          transport: {
            how_to_arrive: grouped.transport?.como_llegar,
            primary_partner: grouped.transport?.aliado_principal,
            secondary_partner: grouped.transport?.aliado_secundario,
            url: grouped.transport?.link,
          },
          food: grouped.food?.descripcion || null,
          contact: {
            hours: grouped.contact?.horario,
            whatsapp: grouped.contact?.whatsapp,
            web: grouped.contact?.web,
            booking_engine: grouped.contact?.booking_engine,
          },
          faq: {
            cash: grouped.faq?.efectivo,
            wifi: grouped.faq?.wifi,
          },
        };
      } catch (e) {
        return { error: 'Error al cargar info de propiedad: ' + e.message };
      }
    }

    case 'check_moon_phase': {
      const date = toolInput.date ? new Date(toolInput.date) : new Date();
      const current = getMoonPhase(date);
      const next = getBioluminescenceDates(date, toolInput.days_ahead || 14);
      return {
        current_phase: current.phase,
        emoji: current.emoji,
        bioluminescence_today: current.suitable_bioluminescence,
        next_valid_dates: next.slice(0, 5).map(d => d.date),
        note: current.suitable_bioluminescence
          ? 'HOY el tour de bioluminiscencia SÍ es posible (luna oculta).'
          : 'HOY el tour de bioluminiscencia NO es posible. La luna interfiere con el plancton. Sugiere una de las fechas válidas próximas.',
      };
    }

    case 'save_guest_contact': {
      const tenantId = conversation.tenant_id || null;
      if (!tenantId) return { success: false, error: 'tenant_id no disponible en conversación' };
      const contact = await saveContact(tenantId, {
        name: toolInput.name,
        phone: toolInput.phone,
        email: toolInput.email,
        language: toolInput.language || conversation.guest_language || 'es',
        source: toolInput.source || conversation.channel || 'web',
      });
      return { success: !!contact, contact_id: contact?.id };
    }

    case 'request_approval': {
      const tenantId = conversation.tenant_id || null;
      if (!tenantId) return { success: false, error: 'tenant_id no disponible' };
      const approval = await requestApproval(tenantId, propertyId, toolInput.type, {
        description: toolInput.description,
        guestName: toolInput.guest_name,
        guestContact: toolInput.guest_contact,
        amountCop: toolInput.amount_cop,
      });
      return {
        success: !!approval,
        case_id: approval?.id,
        status: 'pending_approval',
        note: 'Solicitud enviada al gerente. IMPORTANTE: no confirmes al huésped que se aprobó — espera respuesta del equipo.',
      };
    }

    case 'get_transport_options': {
      const options = await getTransportOptions(
        toolInput.origin,
        toolInput.destination,
        toolInput.date,
        toolInput.passengers || 1
      );
      return {
        options: options.direct,
        count: options.direct?.length || 0,
        formatted: formatTransportForAgent(options, toolInput.origin, toolInput.date),
      };
    }

    case 'reserve_transport': {
      // Resolver routeId desde routeCode
      const { getRoutes } = await import('../integrations/transport/caribbeanTreasures.js');
      const { routes } = await getRoutes();
      const route = routes.find(r => r.code === toolInput.route_code);
      if (!route) return { success: false, error: `Ruta ${toolInput.route_code} no encontrada` };

      // Resolver hotelId dinámicamente desde la propiedad del tenant
      let hotelId = 1; // fallback demo
      try {
        const { data: prop } = await supabase
          .from('properties')
          .select('ct_hotel_id')
          .eq('id', propertyId)
          .single();
        if (prop?.ct_hotel_id) hotelId = prop.ct_hotel_id;
      } catch { /* usa fallback */ }

      const result = await createTransportReservation({
        routeId: route.id,
        date: toolInput.date,
        passengers: toolInput.passengers,
        guestName: toolInput.guest_name,
        guestEmail: toolInput.guest_email,
        guestPhone: toolInput.guest_phone,
        hotelId,
        revioReservationId: toolInput.revio_reservation_id,
      });
      return result;
    }

    case 'create_cancellation_case': {
      const tenantId = conversation.tenant_id || null;
      if (!tenantId) return { success: false, error: 'tenant_id no disponible' };
      const caseNumber = `CAN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { data, error } = await supabase
        .from('cancellation_cases')
        .insert({
          case_number: caseNumber,
          tenant_id: tenantId,
          property_id: propertyId,
          reservation_id: toolInput.reservation_id,
          guest_name: toolInput.guest_name,
          guest_email: toolInput.guest_email,
          guest_phone: toolInput.guest_phone,
          cancellation_reason: toolInput.reason,
          refund_amount_cop: toolInput.refund_amount_cop || 0,
          refund_status: 'pending',
        })
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        case_number: caseNumber,
        status: 'pending_review',
        note: `Caso creado. Comparte el número ${caseNumber} con el huésped para seguimiento. El gerente decidirá el reembolso en 24-48h.`,
      };
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
      message: '⏸️ Nuestro equipo está atendiendo tu consulta personalmente. Te responderán en breve.',
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
      de: '⏸️ Ich verstehe Ihre Frustration. Ein Teammitglied wird sich persönlich um Sie kümmern. Dringend: WhatsApp +573234392420 🌊',
      pt: '⏸️ Entendo sua frustração. Conectei um membro da nossa equipe que vai atendê-lo pessoalmente em breve. Urgências: WhatsApp +573234392420 🌊'
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

  // Obtener datos de la propiedad + group_name del tenant para el system prompt
  let property = { name: 'la propiedad', slug: 'general' };
  try {
    const { data: propertiesWithGroup } = await supabase
      .from('properties')
      .select('*, tenants(group_name, group_description)')
      .eq('is_active', true);
    const flat = (propertiesWithGroup || []).map(p => ({
      ...p,
      group_name: p.tenants?.group_name || null,
      group_description: p.tenants?.group_description || null,
    }));
    if (flat.length === 1) property = flat[0];
    else if (conversationData.propertySlug) {
      property = flat.find(p => p.slug === conversationData.propertySlug) || flat[0] || property;
    } else if (propertyId) {
      property = flat.find(p => p.id === propertyId) || property;
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

  // Cargar base de conocimiento dinámica de la propiedad
  let dynamicKnowledge = '';
  try {
    dynamicKnowledge = await loadPropertyKnowledge(propertyId);
  } catch { /* silencioso */ }

  // Cargar intensidad de ventas configurada
  let salesIntensity = 'moderate';
  try {
    salesIntensity = await loadSalesIntensity(propertyId);
  } catch { /* silencioso */ }

  // Construir mensajes para Claude (excluye el que acabo de guardar)
  const claudeMessages = buildClaudeMessages(messages, userMessage);

  // Llamar a Claude con tool use
  const toolsUsed = [];
  let finalResponse = '';
  let totalTokens = 0;
  let pendingBooking = null;

  // Construir system prompt dinámico (luna, festivos, transporte live, multi-propiedad)
  let systemPromptText;
  try {
    const tenantId = conversation.tenant_id || null;
    // Verificar si el tenant tiene múltiples propiedades
    const { data: tenantProps } = await supabase
      .from('properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    const isMulti = (tenantProps || []).length > 1;
    const allIds = (tenantProps || []).map(p => p.id);

    systemPromptText = await buildDynamicSystemPrompt(propertyId, tenantId, {
      isMultiProperty: isMulti,
      allPropertyIds: allIds,
      groupName: property.group_name,
      groupDescription: property.group_description,
    });
    // Append knowledge base del learning engine + intensidad de ventas
    systemPromptText += (SALES_INTENSITY_PROMPTS[salesIntensity] || SALES_INTENSITY_PROMPTS.moderate);
    systemPromptText += knowledgeContext;
  } catch (promptErr) {
    console.warn('[Agent] Dynamic prompt failed, using static fallback:', promptErr.message);
    systemPromptText = buildSystemPrompt(property, dynamicKnowledge, salesIntensity) + knowledgeContext;
  }

  try {
    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPromptText,
      messages: claudeMessages,
      tools: TOOLS
    });

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Bucle de herramientas — acumula mensajes correctamente entre iteraciones
    let accumulatedMessages = [...claudeMessages];
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push({ name: toolUse.name, input: toolUse.input });
        const result = await executeTool(toolUse.name, toolUse.input, conversation, propertyId);

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

      // Acumular mensajes para mantener contexto completo entre iteraciones
      accumulatedMessages = [
        ...accumulatedMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ];

      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPromptText,
        messages: accumulatedMessages,
        tools: TOOLS
      });

      totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
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
    de: /\b(hallo|guten|ich|sie|wir|ist|sind|haben|möchte|suche|buchen|zimmer|verfügbar|danke|was|wie|wann|wo)\b/,
    pt: /\b(olá|oi|bom dia|boa tarde|boa noite|eu|você|nós|quero|procuro|reservar|quarto|disponível|obrigad[oa]|como|quando|onde|preciso)\b/
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
    de: 'Es tut mir leid, ich hatte ein kurzes technisches Problem. Könnten Sie Ihre Frage wiederholen? Ich bin hier um zu helfen! 🌊',
    pt: 'Desculpe, tive um problema técnico momentâneo. Poderia repetir sua pergunta? Estou aqui para ajudar! 🌊'
  };
  return msgs[lang] || msgs.es;
}

export default { processMessage };
