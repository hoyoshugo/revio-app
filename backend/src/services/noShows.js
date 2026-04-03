/**
 * Servicio de No-Shows
 *
 * Flujo:
 * 1. Detectar reservas con check-in hoy sin pago ni check-in registrado
 * 2. 2 horas antes del horario estándar (15:00 → alerta a las 13:00):
 *    → Enviar mensaje al cliente por WhatsApp/email
 * 3. Si no responde en 2 horas:
 *    → Marcar como No-Show en LobbyPMS
 *    → Notificar al equipo interno
 *    → Registrar en Supabase
 */
import { supabase } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import { sendNotification, sendWhatsAppMessage } from '../integrations/whatsapp.js';

// ============================================================
// Detectar posibles no-shows (reservas del día sin check-in)
// ============================================================
export async function detectNoShows() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

  // Solo ejecutar entre las 13:00 y las 22:00
  if (currentHour < 13 || currentHour > 22) return { detected: 0 };

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, properties(name, slug, whatsapp_number, how_to_get_url, maps_url)')
    .eq('checkin_date', today)
    .in('status', ['confirmed', 'paid'])  // no canceladas, no ya hospedadas
    .neq('status', 'checked_in')
    .neq('status', 'cancelled')
    .neq('status', 'no_show');

  if (error) {
    console.error('[NoShows] Error consultando reservas del día:', error.message);
    return { detected: 0 };
  }

  console.log(`[NoShows] Revisando ${bookings.length} reservas para hoy (${today})`);
  let detected = 0;

  for (const booking of bookings) {
    try {
      // Verificar si ya hay un log de no-show para esta reserva
      const { data: existingLog } = await supabase
        .from('no_show_logs')
        .select('id, status, pre_checkin_alert_sent_at')
        .eq('booking_id', booking.id)
        .single();

      if (existingLog?.status === 'marked_noshow') continue; // ya procesado

      // --- FASE 1: Alerta pre check-in (13:00 - 15:00) ---
      if (currentHour >= 13 && currentHour < 15 && !existingLog?.pre_checkin_alert_sent_at) {
        await sendPreCheckinAlert(booking, existingLog);
        detected++;
        continue;
      }

      // --- FASE 2: Marcar como no-show (15:00+ y sin respuesta) ---
      if (currentHour >= 15 && existingLog?.pre_checkin_alert_sent_at && !existingLog?.guest_responded) {
        const alertTime = new Date(existingLog.pre_checkin_alert_sent_at);
        const hoursSinceAlert = (now - alertTime) / 3600000;

        // Solo marcar si pasaron más de 2 horas desde la alerta
        if (hoursSinceAlert >= 2) {
          await markAsNoShow(booking, existingLog);
          detected++;
        }
      }

      // --- Primer check: crear log si no existe y ya es >= 15:00 sin haber alertado ---
      if (currentHour >= 15 && !existingLog) {
        await sendPreCheckinAlert(booking, null);
        // Marcar de inmediato como no-show si ya es muy tarde (>= 19:00)
        if (currentHour >= 19) {
          const { data: newLog } = await supabase
            .from('no_show_logs')
            .select('*')
            .eq('booking_id', booking.id)
            .single();
          if (newLog) await markAsNoShow(booking, newLog);
        }
        detected++;
      }
    } catch (err) {
      console.error(`[NoShows] Error procesando reserva ${booking.id}:`, err.message);
    }
  }

  return { detected };
}

// ============================================================
// FASE 1: Enviar alerta pre check-in al cliente
// ============================================================
async function sendPreCheckinAlert(booking, existingLog) {
  const property = booking.properties;
  const guestLang = booking.guest_language || 'es';

  const messages = {
    es: `Hola ${booking.guest_name} 👋\n\nTe recordamos que hoy es tu check-in en *${property?.name}*.\n\n📍 Check-in: hoy ${booking.checkin_date}\n🏠 Habitación: ${booking.room_type || 'tu habitación'}\n\n¿Vas en camino? Si tienes algún inconveniente, escríbenos de inmediato.\n\n📞 WhatsApp: ${property?.whatsapp_number}\n🗺️ Cómo llegar: ${property?.how_to_get_url}\n\n¡Te esperamos! 🌊`,
    en: `Hi ${booking.guest_name} 👋\n\nJust a reminder that today is your check-in at *${property?.name}*.\n\n📍 Check-in: today ${booking.checkin_date}\n🏠 Room: ${booking.room_type || 'your room'}\n\nAre you on your way? If you have any issues, please contact us immediately.\n\n📞 WhatsApp: ${property?.whatsapp_number}\n🗺️ How to get there: ${property?.how_to_get_url}\n\nWe look forward to welcoming you! 🌊`,
    fr: `Bonjour ${booking.guest_name} 👋\n\nRappel: aujourd'hui est votre jour d'arrivée à *${property?.name}*.\n\n📞 WhatsApp: ${property?.whatsapp_number}\n🗺️ Comment y aller: ${property?.how_to_get_url}\n\nÀ bientôt! 🌊`,
    de: `Hallo ${booking.guest_name} 👋\n\nErinnerung: Heute ist Ihr Check-in bei *${property?.name}*.\n\n📞 WhatsApp: ${property?.whatsapp_number}\n\nWir freuen uns auf Sie! 🌊`
  };

  const messageText = messages[guestLang] || messages.es;
  const subject = `Recordatorio de check-in hoy — ${property?.name}`;

  // Enviar por WhatsApp + email
  const result = await sendNotification(booking, {
    subject,
    message: messageText,
    htmlMessage: `<p>${messageText.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</p>`
  });

  const channel = booking.guest_phone ? 'whatsapp' : 'email';
  const sent = result.whatsapp?.success || result.email?.success;

  // Crear o actualizar log de no-show
  if (existingLog) {
    await supabase
      .from('no_show_logs')
      .update({
        pre_checkin_alert_sent_at: new Date().toISOString(),
        pre_checkin_channel: channel,
        pre_checkin_message_id: result.whatsapp?.message_id || result.email?.message_id,
        status: 'alerted_guest'
      })
      .eq('id', existingLog.id);
  } else {
    await supabase.from('no_show_logs').insert({
      booking_id: booking.id,
      property_id: booking.property_id,
      status: 'alerted_guest',
      pre_checkin_alert_sent_at: new Date().toISOString(),
      pre_checkin_channel: channel,
      pre_checkin_message_id: result.whatsapp?.message_id || result.email?.message_id
    });
  }

  console.log(`[NoShows] Alerta enviada a ${booking.guest_name} (${booking.id}) via ${channel}`);
  return sent;
}

// ============================================================
// FASE 2: Marcar como No-Show
// ============================================================
async function markAsNoShow(booking, existingLog) {
  const property = booking.properties;
  console.log(`[NoShows] Marcando No-Show: ${booking.guest_name} (${booking.id})`);

  // 1. Actualizar estado en la tabla bookings interna
  await supabase
    .from('bookings')
    .update({ status: 'no_show' })
    .eq('id', booking.id);

  // 2. Cancelar en LobbyPMS (si tiene ID externo)
  let lobbyCancelId = null;
  let lobbyCancelError = null;

  if (booking.lobby_booking_id && property?.slug) {
    try {
      const result = await lobby.cancelBooking(
        property.slug,
        booking.lobby_booking_id,
        'No-Show: cliente no se presentó al check-in'
      );
      lobbyCancelId = result?.id || result?.cancellation_id;
      console.log(`[NoShows] Cancelado en LobbyPMS: ${lobbyCancelId}`);
    } catch (err) {
      lobbyCancelError = err.message;
      console.error(`[NoShows] Error cancelando en LobbyPMS:`, err.message);
    }
  }

  // 3. Notificar al equipo interno por WhatsApp
  const teamMsg = `🚨 *NO-SHOW* — ${property?.name}\n\n` +
    `👤 Huésped: ${booking.guest_name}\n` +
    `📅 Check-in: ${booking.checkin_date}\n` +
    `🏠 Hab: ${booking.room_type || 'N/A'}\n` +
    `📞 Tel: ${booking.guest_phone || 'N/A'}\n` +
    `📧 Email: ${booking.guest_email || 'N/A'}\n` +
    `💰 Total: $${(booking.total_amount / 1000000).toFixed(1)}M COP\n\n` +
    `${lobbyCancelId ? '✅ Cancelado en LobbyPMS' : '⚠️ Cancelación en LobbyPMS fallida'}\n` +
    `ID Reserva: ${booking.id}`;

  let teamNotifiedAt = null;
  try {
    const teamPhone = property?.whatsapp_number || process.env.WHATSAPP_NUMBER;
    if (teamPhone) {
      await sendWhatsAppMessage(teamPhone, teamMsg);
      teamNotifiedAt = new Date().toISOString();
    }
  } catch (err) {
    console.warn('[NoShows] Error notificando al equipo:', err.message);
  }

  // 4. Actualizar el log de no-show
  const logUpdate = {
    status: 'marked_noshow',
    lobby_cancelled_at: lobbyCancelId ? new Date().toISOString() : null,
    lobby_cancellation_id: lobbyCancelId,
    lobby_cancel_error: lobbyCancelError,
    team_notified_at: teamNotifiedAt,
    team_notified_via: 'whatsapp'
  };

  if (existingLog) {
    await supabase.from('no_show_logs').update(logUpdate).eq('id', existingLog.id);
  } else {
    await supabase.from('no_show_logs').insert({
      booking_id: booking.id,
      property_id: booking.property_id,
      ...logUpdate
    });
  }

  console.log(`[NoShows] No-Show procesado completamente: ${booking.guest_name}`);
}

// ============================================================
// Registrar respuesta del cliente (llamado desde el chat o webhook)
// Para que el sistema sepa que el huésped respondió y no es no-show
// ============================================================
export async function registerGuestResponse(bookingId) {
  const { error } = await supabase
    .from('no_show_logs')
    .update({
      guest_responded: true,
      guest_response_at: new Date().toISOString(),
      status: 'resolved'
    })
    .eq('booking_id', bookingId)
    .eq('status', 'alerted_guest');

  if (!error) {
    console.log(`[NoShows] Respuesta registrada para booking ${bookingId}`);
  }
}

// ============================================================
// Obtener logs de no-shows para el dashboard
// ============================================================
export async function getNoShowLogs(propertyId, filters = {}) {
  let query = supabase
    .from('no_show_logs')
    .select('*, bookings(guest_name, guest_email, checkin_date, room_type, total_amount)')
    .order('created_at', { ascending: false });

  if (propertyId) query = query.eq('property_id', propertyId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.limit) query = query.limit(filters.limit || 50);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export default { detectNoShows, registerGuestResponse, getNoShowLogs };
