import axios from 'axios';
import nodemailer from 'nodemailer';

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_CONFIGURED = WHATSAPP_TOKEN && WHATSAPP_TOKEN !== 'pendiente';

// ============================================================
// Crear transporter de email (alternativa a WhatsApp)
// ============================================================
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ============================================================
// Enviar mensaje de WhatsApp
// ============================================================
export async function sendWhatsAppMessage(to, message) {
  if (!WHATSAPP_CONFIGURED) {
    console.warn('[WhatsApp] Token no configurado, usando email como fallback');
    return { skipped: true, reason: 'whatsapp_not_configured' };
  }

  const phone = to.replace(/\D/g, '');
  const client = axios.create({
    baseURL: WHATSAPP_API_URL,
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });

  const { data } = await client.post(`/${WHATSAPP_PHONE_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message }
  });

  return {
    success: true,
    message_id: data.messages?.[0]?.id,
    response: data
  };
}

// ============================================================
// Enviar email
// ============================================================
export async function sendEmail(to, subject, htmlBody, textBody = '') {
  if (!process.env.SMTP_USER) {
    console.warn('[Email] SMTP no configurado');
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const transporter = createEmailTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `Mística Hostels <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: htmlBody,
    text: textBody || htmlBody.replace(/<[^>]*>/g, '')
  });

  return {
    success: true,
    message_id: info.messageId,
    response: info
  };
}

// ============================================================
// Canal unificado: WhatsApp primero, email como fallback
// ============================================================
export async function sendNotification(booking, { subject, message, htmlMessage }) {
  let whatsappResult = null;
  let emailResult = null;

  // Intentar WhatsApp si está configurado y hay teléfono
  if (WHATSAPP_CONFIGURED && booking.guest_phone) {
    try {
      whatsappResult = await sendWhatsAppMessage(booking.guest_phone, message);
    } catch (err) {
      console.error('[WhatsApp] Error enviando mensaje:', err.message);
    }
  }

  // Siempre enviar email si hay dirección (registro + redundancia)
  if (booking.guest_email && process.env.SMTP_USER) {
    try {
      emailResult = await sendEmail(
        booking.guest_email,
        subject,
        htmlMessage || `<p>${message.replace(/\n/g, '<br>')}</p>`
      );
    } catch (err) {
      console.error('[Email] Error enviando email:', err.message);
    }
  }

  return { whatsapp: whatsappResult, email: emailResult };
}

// ============================================================
// TEMPLATES de mensajes por secuencia
// ============================================================
export const templates = {
  confirmation: (booking, paymentUrl, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¡Reserva confirmada! ${booking.property_name || 'Mística'} 🌊`,
        message: `¡Hola ${booking.guest_name}! 🎉\n\nTu reserva en *${booking.property_name}* está confirmada.\n\n📅 Check-in: ${booking.checkin_date}\n📅 Check-out: ${booking.checkout_date}\n🏠 Habitación: ${booking.room_name || booking.room_type}\n💰 Total: COP ${Number(booking.total_amount).toLocaleString('es-CO')}\n\nCompleta tu pago aquí:\n${paymentUrl}\n\n¡Te esperamos! 🌴`,
        html: `<h2>¡Reserva Confirmada! 🌊</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>Tu reserva en <strong>${booking.property_name}</strong> está confirmada.</p><ul><li>📅 Check-in: <strong>${booking.checkin_date}</strong></li><li>📅 Check-out: <strong>${booking.checkout_date}</strong></li><li>🏠 Habitación: <strong>${booking.room_name || booking.room_type}</strong></li><li>💰 Total: <strong>COP ${Number(booking.total_amount).toLocaleString('es-CO')}</strong></li></ul><p><a href="${paymentUrl}" style="background:#00b4d8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Completar pago</a></p>`
      },
      en: {
        subject: `Booking confirmed! ${booking.property_name || 'Mística'} 🌊`,
        message: `Hi ${booking.guest_name}! 🎉\n\nYour booking at *${booking.property_name}* is confirmed.\n\n📅 Check-in: ${booking.checkin_date}\n📅 Check-out: ${booking.checkout_date}\n🏠 Room: ${booking.room_name || booking.room_type}\n💰 Total: COP ${Number(booking.total_amount).toLocaleString('es-CO')}\n\nComplete your payment here:\n${paymentUrl}\n\nSee you soon! 🌴`,
        html: `<h2>Booking Confirmed! 🌊</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Your booking at <strong>${booking.property_name}</strong> is confirmed.</p><ul><li>📅 Check-in: <strong>${booking.checkin_date}</strong></li><li>📅 Check-out: <strong>${booking.checkout_date}</strong></li><li>🏠 Room: <strong>${booking.room_name || booking.room_type}</strong></li><li>💰 Total: <strong>COP ${Number(booking.total_amount).toLocaleString('es-CO')}</strong></li></ul><p><a href="${paymentUrl}" style="background:#00b4d8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Complete Payment</a></p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  reminder7days: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `7 días para tu llegada a ${booking.property_name} 🌴`,
        message: `¡Hola ${booking.guest_name}! 🌊\n\n¡Faltan solo 7 días para tu estancia en ${booking.property_name}!\n\nCómo llegar: ${booking.how_to_get_url}\n\n¿Necesitas ayuda con el transporte? ¡Escríbenos por WhatsApp al ${booking.whatsapp_number}!\n\nNos vemos pronto 🌴`,
        html: `<h2>¡Faltan 7 días! 🌴</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>Tu viaje a <strong>${booking.property_name}</strong> se acerca. Check-in: <strong>${booking.checkin_date}</strong>.</p><p><a href="${booking.how_to_get_url}">Ver cómo llegar</a></p><p>WhatsApp: ${booking.whatsapp_number}</p>`
      },
      en: {
        subject: `7 days until your stay at ${booking.property_name} 🌴`,
        message: `Hi ${booking.guest_name}! 🌊\n\nOnly 7 days until your stay at ${booking.property_name}!\n\nHow to get there: ${booking.how_to_get_url}\n\nNeed help with transport? Message us on WhatsApp at ${booking.whatsapp_number}!\n\nSee you soon! 🌴`,
        html: `<h2>7 days to go! 🌴</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Your trip to <strong>${booking.property_name}</strong> is coming up. Check-in: <strong>${booking.checkin_date}</strong>.</p><p><a href="${booking.how_to_get_url}">How to get there</a></p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  reminder3days: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¡Tu aventura en ${booking.property_name} empieza en 3 días! 🚀`,
        message: `¡Hola ${booking.guest_name}! ⭐\n\n¡Solo 3 días! Recuerda hacer tu check-in online para agilizar tu llegada.\n\n📋 Check-in: ${booking.checkin_date}\n🏠 Habitación: ${booking.room_name || booking.room_type}\n\nWhatsApp: ${booking.whatsapp_number}\n\n¡Nos vemos pronto! 🌊`,
        html: `<h2>¡3 días para tu aventura! 🚀</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>¡Casi es hora! Tienes tu check-in el <strong>${booking.checkin_date}</strong>.</p><p>WhatsApp: ${booking.whatsapp_number}</p>`
      },
      en: {
        subject: `Your adventure at ${booking.property_name} starts in 3 days! 🚀`,
        message: `Hi ${booking.guest_name}! ⭐\n\nOnly 3 days to go! Remember to do your online check-in.\n\n📋 Check-in: ${booking.checkin_date}\n🏠 Room: ${booking.room_name || booking.room_type}\n\nWhatsApp: ${booking.whatsapp_number}\n\nSee you soon! 🌊`,
        html: `<h2>3 days to your adventure! 🚀</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Your check-in is on <strong>${booking.checkin_date}</strong>.</p><p>WhatsApp: ${booking.whatsapp_number}</p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  reminder1day: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¡Mañana llegas a ${booking.property_name}! Instrucciones de llegada 🗺️`,
        message: `¡Hola ${booking.guest_name}! ¡Mañana es el gran día! 🎉\n\nTu check-in es mañana ${booking.checkin_date}.\n\n📍 Cómo llegar: ${booking.how_to_get_url}\n📍 Ubicación: ${booking.maps_url}\n📞 Emergencias: ${booking.whatsapp_number}\n\n¡Te esperamos con los brazos abiertos! 🌊`,
        html: `<h2>¡Mañana llegas! 🎉</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>Tu check-in es mañana <strong>${booking.checkin_date}</strong>.</p><p><a href="${booking.how_to_get_url}">Instrucciones de llegada</a></p><p><a href="${booking.maps_url}">Ver en mapa</a></p><p>WhatsApp emergencias: ${booking.whatsapp_number}</p>`
      },
      en: {
        subject: `You arrive at ${booking.property_name} tomorrow! Arrival guide 🗺️`,
        message: `Hi ${booking.guest_name}! Tomorrow is the big day! 🎉\n\nYour check-in is tomorrow ${booking.checkin_date}.\n\n📍 How to get there: ${booking.how_to_get_url}\n📍 Location: ${booking.maps_url}\n📞 Emergency: ${booking.whatsapp_number}\n\nWe can't wait to welcome you! 🌊`,
        html: `<h2>You arrive tomorrow! 🎉</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Your check-in is tomorrow <strong>${booking.checkin_date}</strong>.</p><p><a href="${booking.how_to_get_url}">Arrival guide</a></p><p>Emergency WhatsApp: ${booking.whatsapp_number}</p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  welcomeDay: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¡Bienvenido a ${booking.property_name}! 🌊`,
        message: `¡Hola ${booking.guest_name}! Bienvenido a ${booking.property_name}! 🎉\n\n¡Hoy empieza tu aventura! Nuestro equipo está listo para recibirte.\n\nSi necesitas algo durante tu estadía, no dudes en escribirnos:\nWhatsApp: ${booking.whatsapp_number}\n\n¡Disfruta al máximo! 🌴`,
        html: `<h2>¡Bienvenido! 🌊</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>¡Bienvenido a <strong>${booking.property_name}</strong>! Nuestro equipo está listo para recibirte.</p><p>WhatsApp: ${booking.whatsapp_number}</p>`
      },
      en: {
        subject: `Welcome to ${booking.property_name}! 🌊`,
        message: `Hi ${booking.guest_name}! Welcome to ${booking.property_name}! 🎉\n\nYour adventure starts today! Our team is ready to welcome you.\n\nNeed anything during your stay? Reach us on:\nWhatsApp: ${booking.whatsapp_number}\n\nEnjoy your stay! 🌴`,
        html: `<h2>Welcome! 🌊</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Welcome to <strong>${booking.property_name}</strong>! Our team is ready for you.</p><p>WhatsApp: ${booking.whatsapp_number}</p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  reviewRequest: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¿Cómo estuvo tu estadía en ${booking.property_name}? ⭐`,
        message: `¡Hola ${booking.guest_name}! 🌊\n\nEsperamos que hayas tenido una experiencia increíble en ${booking.property_name}.\n\nTu opinión nos ayuda mucho. ¿Podrías dejarnos una reseña?\n\n⭐ Google: https://g.page/r/review\n⭐ Booking.com: ${booking.booking_url}\n\n¡Gracias y hasta pronto! 🌴`,
        html: `<h2>¿Cómo estuvo tu estadía? ⭐</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>Esperamos que hayas disfrutado <strong>${booking.property_name}</strong>.</p><p>¡Tu reseña nos ayuda mucho!</p>`
      },
      en: {
        subject: `How was your stay at ${booking.property_name}? ⭐`,
        message: `Hi ${booking.guest_name}! 🌊\n\nWe hope you had an amazing time at ${booking.property_name}!\n\nYour review means a lot to us.\n\n⭐ Google: https://g.page/r/review\n⭐ Booking.com: ${booking.booking_url}\n\nThanks and hope to see you again! 🌴`,
        html: `<h2>How was your stay? ⭐</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>We hope you loved <strong>${booking.property_name}</strong>.</p><p>Please leave us a review!</p>`
      }
    };
    return msgs[lang] || msgs.es;
  },

  loyaltyOffer: (booking, lang = 'es') => {
    const msgs = {
      es: {
        subject: `¡Vuelve a Mística! Oferta exclusiva para ti 🎁`,
        message: `¡Hola ${booking.guest_name}! 🌊\n\nEchas de menos el paraíso? ¡Vuelve a visitarnos!\n\nComo cliente especial, tienes acceso a nuestra tarifa de fidelidad.\n\nReserva aquí: ${booking.booking_url}\n\n¡Te esperamos! 🌴`,
        html: `<h2>¡Oferta de regreso! 🎁</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>¿Listo para volver al paraíso? ¡Tenemos una oferta especial para ti!</p><p><a href="${booking.booking_url}" style="background:#00b4d8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Ver disponibilidad</a></p>`
      },
      en: {
        subject: `Come back to Mística! Exclusive offer for you 🎁`,
        message: `Hi ${booking.guest_name}! 🌊\n\nMissing paradise? Come back for another adventure!\n\nAs a returning guest, you have access to our loyalty rate.\n\nBook here: ${booking.booking_url}\n\nSee you soon! 🌴`,
        html: `<h2>Come back! 🎁</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Ready for another adventure? We have a special offer for you!</p><p><a href="${booking.booking_url}" style="background:#00b4d8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Check availability</a></p>`
      }
    };
    return msgs[lang] || msgs.es;
  }
};

export default {
  sendWhatsAppMessage,
  sendEmail,
  sendNotification,
  templates,
  WHATSAPP_CONFIGURED
};
