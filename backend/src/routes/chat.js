import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { processMessage } from '../agents/hotelAgent.js';
import { db } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import wompi from '../integrations/wompi.js';
import whatsapp from '../integrations/whatsapp.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ============================================================
// POST /api/chat — Mensaje principal del widget
// ============================================================
router.post('/', chatLimiter, async (req, res) => {
  const {
    message,
    session_id,
    property_slug = 'isla-palma', // propiedad por defecto
    utm_source,
    utm_medium,
    utm_campaign
  } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  }

  // Generar session_id si no viene del cliente
  const sessionId = session_id || uuidv4();

  try {
    // Obtener propiedad para tener su ID
    let propertyId = null;
    try {
      const property = await db.getProperty(property_slug);
      propertyId = property.id;

      // Actualizar UTMs si vienen
      if (utm_source) {
        const conv = await db.getOrCreateConversation(sessionId, propertyId);
        await db.updateConversation(conv.id, { utm_source, utm_medium, utm_campaign });
      }
    } catch { /* propiedad no encontrada, continúa sin ID */ }

    // Procesar con el agente IA
    const result = await processMessage(sessionId, message.trim(), propertyId, { propertySlug: property_slug });

    // Si el agente detectó una reserva pendiente, crearla
    if (result.pending_booking) {
      try {
        const bookingResult = await createBookingFromAgent(result.pending_booking, propertyId, property_slug, result.conversation_id);
        result.booking = bookingResult;
      } catch (err) {
        console.error('[Chat] Error creando reserva desde agente:', err.message);
      }
    }

    res.json({
      reply: result.message,
      session_id: sessionId,
      conversation_id: result.conversation_id,
      booking: result.booking || null,
      response_time_ms: result.response_time_ms
    });

  } catch (err) {
    console.error('[Chat] Error procesando mensaje:', err);
    res.status(500).json({
      error: 'Error interno del servidor',
      reply: 'Lo siento, tuve un problema técnico. Por favor intenta de nuevo o contáctanos por WhatsApp: +573234392420'
    });
  }
});

// ============================================================
// Función: crear reserva completa desde datos del agente
// ============================================================
async function createBookingFromAgent(bookingData, propertyId, propertySlug, conversationId) {
  // 1. Crear cliente en LobbyPMS
  let lobbyCustomerId = null;
  try {
    const customerResult = await lobby.createCustomer(propertySlug, 'individual', {
      name: bookingData.guest_name,
      email: bookingData.guest_email,
      phone: bookingData.guest_phone,
      nationality: bookingData.guest_nationality
    });
    lobbyCustomerId = customerResult?.id || customerResult?.data?.id;
  } catch (err) {
    console.warn('[Chat] No se pudo crear cliente en LobbyPMS:', err.message);
  }

  // 2. Crear reserva en LobbyPMS
  let lobbyBookingId = null;
  try {
    const lobbyBooking = await lobby.createBooking(propertySlug, {
      customer_id: lobbyCustomerId,
      room_type: bookingData.room_type,
      checkin: bookingData.checkin_date,
      checkout: bookingData.checkout_date,
      adults: bookingData.adults,
      children: bookingData.children || 0,
      special_requests: bookingData.special_requests
    });
    lobbyBookingId = lobbyBooking?.id || lobbyBooking?.data?.id;
  } catch (err) {
    console.warn('[Chat] No se pudo crear reserva en LobbyPMS:', err.message);
  }

  const nights = Math.ceil(
    (new Date(bookingData.checkout_date) - new Date(bookingData.checkin_date)) / (1000 * 60 * 60 * 24)
  );

  // 3. Guardar en Supabase
  const booking = await db.createBooking({
    property_id: propertyId,
    conversation_id: conversationId,
    lobby_booking_id: lobbyBookingId,
    lobby_customer_id: lobbyCustomerId,
    guest_name: bookingData.guest_name,
    guest_email: bookingData.guest_email,
    guest_phone: bookingData.guest_phone,
    guest_nationality: bookingData.guest_nationality,
    room_type: bookingData.room_type,
    checkin_date: bookingData.checkin_date,
    checkout_date: bookingData.checkout_date,
    nights,
    adults: bookingData.adults,
    children: bookingData.children || 0,
    total_amount: bookingData.total_amount,
    currency: 'COP',
    special_requests: bookingData.special_requests,
    status: 'confirmed'
  });

  // 4. Obtener datos de la propiedad para el link de pago
  const property = await db.getProperty(propertySlug);

  // 5. Crear link de pago Wompi
  let paymentInfo = null;
  try {
    paymentInfo = await wompi.createPaymentLink(propertySlug, {
      ...booking,
      property_slug: propertySlug
    });
    await db.updateBooking(booking.id, { status: 'confirmed' });
  } catch (err) {
    console.error('[Chat] Error creando link de pago:', err.message);
  }

  // 6. Enviar confirmación automática
  if (paymentInfo?.payment_link_url) {
    const template = whatsapp.templates.confirmation(
      {
        ...booking,
        property_name: property.name,
        room_name: bookingData.room_type
      },
      paymentInfo.payment_link_url,
      'es'
    );

    try {
      await whatsapp.sendNotification(booking, template);

      // Programar secuencia de comunicaciones
      await scheduleBookingCommunications(booking, property);
    } catch (err) {
      console.error('[Chat] Error enviando confirmación:', err.message);
    }
  }

  return {
    booking_id: booking.id,
    lobby_booking_id: lobbyBookingId,
    payment_link_url: paymentInfo?.payment_link_url,
    total_amount: booking.total_amount,
    status: 'confirmed'
  };
}

// ============================================================
// Programar comunicaciones automáticas post-reserva
// ============================================================
async function scheduleBookingCommunications(booking, property) {
  const checkin = new Date(booking.checkin_date);
  const checkout = new Date(booking.checkout_date);
  const now = new Date();

  const schedules = [
    // 7 días antes del check-in
    {
      step: 'reminder_7d',
      date: new Date(checkin.getTime() - 7 * 24 * 60 * 60 * 1000)
    },
    // 3 días antes
    {
      step: 'reminder_3d',
      date: new Date(checkin.getTime() - 3 * 24 * 60 * 60 * 1000)
    },
    // 1 día antes
    {
      step: 'reminder_1d',
      date: new Date(checkin.getTime() - 1 * 24 * 60 * 60 * 1000)
    },
    // Día del check-in (9 AM)
    {
      step: 'welcome_day',
      date: new Date(checkin.setHours(9, 0, 0, 0))
    },
    // 1 día después del checkout
    {
      step: 'review_request',
      date: new Date(checkout.getTime() + 1 * 24 * 60 * 60 * 1000)
    },
    // 15 días después del checkout
    {
      step: 'loyalty_offer',
      date: new Date(checkout.getTime() + 15 * 24 * 60 * 60 * 1000)
    }
  ];

  for (const { step, date } of schedules) {
    if (date > now) {
      await db.scheduleCommunication({
        booking_id: booking.id,
        property_id: booking.property_id,
        type: booking.guest_phone ? 'whatsapp' : 'email',
        sequence_step: step,
        recipient_phone: booking.guest_phone,
        recipient_email: booking.guest_email,
        body: step, // el scheduler genera el mensaje real al enviar
        scheduled_for: date.toISOString(),
        status: 'pending'
      });
    }
  }
}

// ============================================================
// GET /api/chat/history/:sessionId — Historial de conversación
// ============================================================
router.get('/history/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const conversation = await db.getOrCreateConversation(sessionId, null);
    const messages = await db.getConversationMessages(conversation.id);
    res.json({ conversation, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/chat/init — Inicializar sesión del widget
// ============================================================
router.post('/init', async (req, res) => {
  const { property_slug = 'isla-palma', language = 'es' } = req.body;
  const sessionId = uuidv4();

  const greetings = {
    es: '¡Hola! 🌊 Soy Mística AI, tu asistente para descubrir el paraíso en Colombia. ¿Estás pensando en una escapada a la isla o al Tayrona?',
    en: 'Hi there! 🌊 I\'m Mística AI, your guide to paradise in Colombia. Are you thinking of a getaway to the island or to Tayrona?',
    fr: 'Bonjour! 🌊 Je suis Mística AI, votre guide pour le paradis en Colombie. Vous pensez à une escapade sur l\'île ou au Tayrona?',
    de: 'Hallo! 🌊 Ich bin Mística AI, Ihr Guide für das Paradies in Kolumbien. Denken Sie an einen Ausflug zur Insel oder zum Tayrona?'
  };

  res.json({
    session_id: sessionId,
    greeting: greetings[language] || greetings.es,
    property_slug
  });
});

export default router;
