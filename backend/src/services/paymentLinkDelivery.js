/**
 * Envía un link de pago al huésped por WhatsApp + email simultáneamente.
 * Usado al confirmar una reserva desde el agente o el dashboard.
 */
import { sendWhatsAppMessage } from './agentUtils.js';
import { sendEmail, wrapEmailTemplate } from './emailService.js';
import { createPaymentLink } from './paymentGateways.js';
import { supabase } from '../models/supabase.js';

/**
 * @param {object} params
 *   reservationId, propertyId, guestName, guestPhone, guestEmail,
 *   amountCop, currency, gateway?, reference
 * @returns {{success, paymentLink, whatsappResult, emailResult}}
 */
export async function sendPaymentLinkToGuest(params) {
  const {
    reservationId,
    propertyId,
    guestName,
    guestPhone,
    guestEmail,
    amountCop,
    currency = 'COP',
    gateway = 'wompi',
    reference,
  } = params;

  // 1. Resolver config del gateway desde settings (multi-tenant)
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('property_id', propertyId)
    .eq('key', 'wompi_config')
    .maybeSingle();

  const tenantConfig = {
    wompi_public_key: setting?.value?.public_key || process.env[`WOMPI_PUBLIC_KEY_${propertyId}`],
  };

  // 2. Generar link de pago
  const paymentLink = await createPaymentLink(
    gateway,
    amountCop,
    currency,
    reference || `REVIO-${reservationId}`,
    tenantConfig
  );

  if (!paymentLink) {
    return { success: false, error: 'no_gateway_configured' };
  }

  // 3. Nombre de la propiedad
  const { data: prop } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single();
  const propertyName = prop?.name || 'tu reserva';

  // 4. Mensaje WhatsApp
  const whatsappMessage =
    `¡Hola ${guestName}! 🌴\n\n` +
    `Tu reserva en *${propertyName}* está confirmada.\n\n` +
    `💳 Para asegurar tu espacio, completa el pago aquí:\n${paymentLink}\n\n` +
    `Monto: *$${amountCop.toLocaleString()} ${currency}*\n` +
    `Referencia: ${reference || reservationId}\n\n` +
    `El link es seguro y está emitido por la pasarela oficial. ✨`;

  // 5. Email
  const emailHtml = wrapEmailTemplate(
    `Tu reserva en ${propertyName}`,
    `<p>¡Hola <strong>${guestName}</strong>! 🌴</p>
     <p>Tu reserva está confirmada. Para asegurar tu espacio, completa el pago haciendo clic en el botón de abajo.</p>
     <table style="width:100%;border-collapse:collapse;margin:20px 0;">
       <tr><td style="padding:8px 0;color:#666;">Reserva:</td><td style="padding:8px 0;font-weight:600;">${reservationId || reference}</td></tr>
       <tr><td style="padding:8px 0;color:#666;">Propiedad:</td><td style="padding:8px 0;font-weight:600;">${propertyName}</td></tr>
       <tr><td style="padding:8px 0;color:#666;">Monto:</td><td style="padding:8px 0;font-weight:600;font-size:18px;color:#0ea5e9;">$${amountCop.toLocaleString()} ${currency}</td></tr>
     </table>
     <p style="color:#666;font-size:13px;">El link es seguro y está emitido por la pasarela oficial del establecimiento.</p>`,
    { href: paymentLink, label: '💳 Completar pago' }
  );

  // 6. Enviar en paralelo
  const [whatsappResult, emailResult] = await Promise.all([
    guestPhone ? sendWhatsAppMessage(guestPhone, whatsappMessage) : Promise.resolve({ skipped: 'no_phone' }),
    guestEmail ? sendEmail({ to: guestEmail, subject: `Pago — ${propertyName}`, html: emailHtml }) : Promise.resolve({ skipped: 'no_email' }),
  ]);

  return {
    success: true,
    paymentLink,
    whatsappResult,
    emailResult,
  };
}
