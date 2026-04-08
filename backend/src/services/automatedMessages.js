import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from './agentUtils.js';

/**
 * Reemplaza variables {{key}} en una plantilla con los valores dados.
 */
export function buildMessage(template, variables = {}) {
  let msg = template;
  for (const [k, v] of Object.entries(variables)) {
    msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), v ?? '');
  }
  return msg;
}

/**
 * Envía mensaje automático según el trigger configurado en automated_messages.
 * triggerType: booking_confirmed | pre_arrival | check_in_day | during_stay | check_out_day | post_stay
 */
export async function sendAutomatedMessage(tenantId, propertyId, triggerType, reservation) {
  const { data: templates, error } = await supabase
    .from('automated_messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true);

  if (error || !templates?.length) return [];

  const variables = {
    guest_name:           reservation.guestName,
    property_name:        reservation.propertyName,
    check_in:             reservation.checkIn,
    check_out:            reservation.checkOut,
    guests:               reservation.guests,
    room_type:            reservation.roomType,
    payment_status:       reservation.paymentStatus,
    payment_link:         reservation.paymentLink,
    checkin_link:         reservation.checkInLink,
    arrival_instructions: reservation.arrivalInstructions,
    available_activities: reservation.availableActivities,
    google_review_link:   reservation.googleReviewLink,
    tripadvisor_link:     reservation.tripadvisorLink,
    booking_review_link:  reservation.bookingReviewLink,
  };

  const sent = [];
  for (const template of templates) {
    const message = buildMessage(template.message_template, variables);

    if ((template.channel === 'whatsapp' || template.channel === 'both') && reservation.guestPhone) {
      const r = await sendWhatsAppMessage(reservation.guestPhone, message);
      sent.push({ template: template.name, channel: 'whatsapp', result: r });
    }

    if ((template.channel === 'email' || template.channel === 'both') && reservation.guestEmail) {
      // TODO: integrar SendGrid/Resend
      console.log(JSON.stringify({
        level: 'info',
        event: 'email_pending',
        to: reservation.guestEmail,
        subject: template.name,
      }));
      sent.push({ template: template.name, channel: 'email', result: 'pending_provider' });
    }
  }
  return sent;
}

/**
 * Calcula los timestamps en los que cada mensaje debe dispararse para una reserva.
 * En producción, encolar en cron/scheduler para enviarlos automáticamente.
 */
export function scheduleMessages(reservation) {
  const checkIn = new Date(reservation.checkIn);
  const checkOut = new Date(reservation.checkOut);

  return [
    { type: 'booking_confirmed', sendAt: new Date()                                          },
    { type: 'pre_arrival',       sendAt: new Date(checkIn.getTime()  - 48 * 60 * 60 * 1000) },
    { type: 'check_in_day',      sendAt: new Date(checkIn.getTime()  + 9  * 60 * 60 * 1000) },
    { type: 'during_stay',       sendAt: new Date(checkIn.getTime()  + 48 * 60 * 60 * 1000) },
    { type: 'check_out_day',     sendAt: new Date(checkOut.getTime() + 8  * 60 * 60 * 1000) },
    { type: 'post_stay',         sendAt: new Date(checkOut.getTime() + 24 * 60 * 60 * 1000) },
  ];
}
