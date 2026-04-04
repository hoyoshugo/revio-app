/**
 * Servicio de Cancelaciones
 *
 * Flujo automatizado:
 * 1. Calcular penalidad según política de LobbyPMS y días antes del check-in
 * 2. Cancelar en LobbyPMS via API
 * 3. Procesar reembolso en Wompi si aplica
 * 4. Notificar al cliente por WhatsApp + email
 * 5. Registrar en cancellation_logs para reportes
 */
import { supabase } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import wompiModule from '../integrations/wompi.js';
import { sendNotification } from '../integrations/whatsapp.js';

// ============================================================
// Políticas de cancelación (pueden venir de LobbyPMS en producción)
// ============================================================
const DEFAULT_POLICIES = [
  { name: 'flexible', days_threshold: 7, penalty_pct: 0 },    // > 7 días: sin penalidad
  { name: 'moderate', days_threshold: 3, penalty_pct: 50 },   // 3-7 días: 50%
  { name: 'strict', days_threshold: 0, penalty_pct: 100 }     // < 3 días / no-show: 100%
];

function calculatePenalty(checkinDate, cancellationDate = new Date()) {
  const checkin = new Date(checkinDate);
  const cancellation = new Date(cancellationDate);
  const daysBeforeCheckin = Math.max(0, Math.ceil((checkin - cancellation) / 86400000));

  let policy = DEFAULT_POLICIES[2]; // por defecto: estricta
  for (const p of DEFAULT_POLICIES) {
    if (daysBeforeCheckin >= p.days_threshold) {
      policy = p;
      break;
    }
  }

  return { policy, days_before_checkin: daysBeforeCheckin };
}

// ============================================================
// FUNCIÓN PRINCIPAL: Procesar cancelación completa
// ============================================================
export async function processCancellation({
  bookingId,
  cancelledBy = 'guest',    // guest | staff | system | ota | no_show
  reason = '',
  waiveRefund = false,       // staff puede renunciar al reembolso
  propertySlug = null
}) {
  // Obtener datos completos de la reserva
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, properties(name, slug, whatsapp_number, booking_url)')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error(`Reserva no encontrada: ${bookingId}`);
  }

  if (['cancelled', 'no_show'].includes(booking.status)) {
    throw new Error(`La reserva ya está en estado: ${booking.status}`);
  }

  const slug = propertySlug || booking.properties?.slug;
  const property = booking.properties;

  // 1. Calcular penalidad
  const { policy, days_before_checkin } = calculatePenalty(booking.checkin_date);
  const penaltyAmount = Math.round((booking.total_amount || 0) * (policy.penalty_pct / 100));
  const refundAmount = (booking.total_amount || 0) - penaltyAmount;
  const refundEligible = refundAmount > 0 && !waiveRefund;

  console.log(`[Cancellations] Reserva ${bookingId}: ${days_before_checkin} días antes, penalidad ${policy.penalty_pct}%, reembolso $${(refundAmount/1000000).toFixed(1)}M`);

  // 2. Cancelar en LobbyPMS
  let lobbyCancelResponse = null;
  try {
    if (booking.lobby_booking_id && slug) {
      lobbyCancelResponse = await lobby.cancelBooking(slug, booking.lobby_booking_id, reason);
      console.log(`[Cancellations] Cancelado en LobbyPMS: ${booking.lobby_booking_id}`);
    }
  } catch (err) {
    console.error('[Cancellations] Error en LobbyPMS:', err.message);
    // Continuar aunque falle LobbyPMS — registrar el error
    lobbyCancelResponse = { error: err.message };
  }

  // 3. Actualizar estado en Supabase
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', internal_notes: reason })
    .eq('id', bookingId);

  // 4. Crear log de cancelación
  const { data: cancelLog } = await supabase
    .from('cancellation_logs')
    .insert({
      booking_id: bookingId,
      property_id: booking.property_id,
      cancelled_by: cancelledBy,
      cancellation_reason: reason,
      policy_name: policy.name,
      days_before_checkin,
      penalty_percentage: policy.penalty_pct,
      penalty_amount: penaltyAmount,
      refund_eligible: refundEligible,
      refund_amount: refundAmount,
      refund_status: refundEligible ? 'pending' : 'waived',
      lobby_cancel_response: lobbyCancelResponse,
      lobby_cancelled_at: new Date().toISOString()
    })
    .select()
    .single();

  // 5. Procesar reembolso Wompi (si aplica)
  if (refundEligible && booking.status === 'paid') {
    await processRefund(cancelLog, booking, slug, refundAmount);
  }

  // 6. Notificar al cliente
  const notifyResult = await notifyGuestCancellation(booking, {
    policy,
    penaltyAmount,
    refundAmount,
    refundEligible: refundEligible && booking.status === 'paid',
    days_before_checkin
  });

  // 7. Actualizar log con notificación
  if (cancelLog?.id) {
    await supabase
      .from('cancellation_logs')
      .update({
        guest_notified_at: new Date().toISOString(),
        guest_notified_via: booking.guest_phone ? 'whatsapp' : 'email'
      })
      .eq('id', cancelLog.id);
  }

  return {
    success: true,
    booking_id: bookingId,
    status: 'cancelled',
    policy: policy.name,
    days_before_checkin,
    penalty_amount: penaltyAmount,
    penalty_pct: policy.penalty_pct,
    refund_amount: refundAmount,
    refund_eligible: refundEligible,
    lobby_cancelled: !lobbyCancelResponse?.error,
    guest_notified: notifyResult
  };
}

// ============================================================
// Procesar reembolso via Wompi
// ============================================================
async function processRefund(cancelLog, booking, propertySlug, refundAmount) {
  console.log(`[Cancellations] Procesando reembolso de $${(refundAmount/1000000).toFixed(1)}M para ${booking.guest_name}`);

  // Buscar la transacción de Wompi asociada a esta reserva
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('status', 'approved')
    .single();

  if (!payment?.wompi_transaction_id) {
    console.warn('[Cancellations] No se encontró transacción Wompi aprobada para hacer reembolso');
    if (cancelLog?.id) {
      await supabase
        .from('cancellation_logs')
        .update({
          refund_status: 'failed',
          refund_error: 'No se encontró transacción Wompi aprobada'
        })
        .eq('id', cancelLog.id);
    }
    return;
  }

  try {
    // Wompi Refund API
    // Nota: Wompi maneja reembolsos via panel o API privada
    // Por ahora registramos la intención y el equipo la procesa manualmente si la API no está disponible
    const wompiRefundReference = `REFUND-${cancelLog?.id?.substring(0, 8) || Date.now()}`;

    // Intentar via API si está disponible
    let wompiRefundData = { manual_required: true, original_transaction_id: payment.wompi_transaction_id };

    try {
      const { supabase: sb } = await import('../models/supabase.js');
      // La API de Wompi para reembolsos usa:
      // POST /transactions/{id}/void (anulación) o refund según el tiempo
      const axios = (await import('axios')).default;
      const WOMPI_API_URL = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';

      // Determinar clave privada desde BD (con fallback a ENV)
      const { getWompiConfig } = await import('./connectionService.js');
      const wompiCfg = await getWompiConfig(booking.property_id, propertySlug);
      const privateKey = wompiCfg?.private_key
        || (propertySlug === 'isla-palma' ? process.env.WOMPI_PRIVATE_KEY_ISLA : process.env.WOMPI_PRIVATE_KEY_TAYRONA);

      const { data: refundData } = await axios.post(
        `${WOMPI_API_URL}/transactions/${payment.wompi_transaction_id}/refund`,
        { amount_in_cents: Math.round(refundAmount * 100) },
        { headers: { Authorization: `Bearer ${privateKey}` } }
      );

      wompiRefundData = refundData;
      console.log(`[Cancellations] Reembolso Wompi iniciado: ${wompiRefundReference}`);
    } catch (refundErr) {
      // Si la API de reembolso falla, marcar para proceso manual
      console.warn('[Cancellations] API de reembolso Wompi no disponible, marcando para revisión manual:', refundErr.message);
      wompiRefundData.error = refundErr.message;
    }

    if (cancelLog?.id) {
      await supabase
        .from('cancellation_logs')
        .update({
          refund_status: wompiRefundData.manual_required ? 'pending' : 'processing',
          wompi_refund_reference: wompiRefundReference,
          wompi_refund_data: wompiRefundData,
          refund_processed_at: new Date().toISOString()
        })
        .eq('id', cancelLog.id);
    }
  } catch (err) {
    console.error('[Cancellations] Error procesando reembolso:', err.message);
    if (cancelLog?.id) {
      await supabase
        .from('cancellation_logs')
        .update({ refund_status: 'failed', refund_error: err.message })
        .eq('id', cancelLog.id);
    }
  }
}

// ============================================================
// Notificar al cliente sobre la cancelación
// ============================================================
async function notifyGuestCancellation(booking, { policy, penaltyAmount, refundAmount, refundEligible, days_before_checkin }) {
  const lang = booking.guest_language || 'es';
  const property = booking.properties;

  const policyTexts = {
    es: {
      flexible: 'Sin cargo de cancelación.',
      moderate: `Se aplica penalidad del 50%: $${(penaltyAmount/1000000).toFixed(1)}M COP.`,
      strict: `Se aplica penalidad del 100% por cancelación tardía.`
    },
    en: {
      flexible: 'No cancellation fee.',
      moderate: `A 50% penalty applies: $${(penaltyAmount/1000000).toFixed(1)}M COP.`,
      strict: 'A 100% penalty applies due to late cancellation.'
    }
  };

  const policyText = (policyTexts[lang] || policyTexts.es)[policy.name] || '';

  const messages = {
    es: {
      subject: `Tu reserva en ${property?.name} ha sido cancelada`,
      message: `Hola ${booking.guest_name},\n\nTu reserva en ${property?.name} ha sido cancelada.\n\n📅 Check-in: ${booking.checkin_date}\n\n${policyText}\n${refundEligible ? `💳 Reembolso: $${(refundAmount/1000000).toFixed(1)}M COP (procesando en 5-10 días hábiles).` : ''}\n\nEsperamos verte en una próxima visita 🌊\n\nEquipo Mística`,
      html: `<h2>Cancelación confirmada</h2><p>Hola <strong>${booking.guest_name}</strong>,</p><p>Tu reserva en <strong>${property?.name}</strong> ha sido cancelada.</p><p>${policyText}</p>${refundEligible ? `<p><strong>Reembolso:</strong> $${(refundAmount/1000000).toFixed(1)}M COP (5-10 días hábiles)</p>` : ''}<p>Equipo Mística 🌊</p>`
    },
    en: {
      subject: `Your booking at ${property?.name} has been cancelled`,
      message: `Hi ${booking.guest_name},\n\nYour booking at ${property?.name} has been cancelled.\n\n📅 Check-in: ${booking.checkin_date}\n\n${policyText}\n${refundEligible ? `💳 Refund: $${(refundAmount/1000000).toFixed(1)}M COP (processing in 5-10 business days).` : ''}\n\nHope to see you on a future visit 🌊\n\nMística Team`,
      html: `<h2>Cancellation confirmed</h2><p>Hi <strong>${booking.guest_name}</strong>,</p><p>Your booking at <strong>${property?.name}</strong> has been cancelled.</p><p>${policyText}</p>${refundEligible ? `<p><strong>Refund:</strong> $${(refundAmount/1000000).toFixed(1)}M COP (5-10 business days)</p>` : ''}<p>Mística Team 🌊</p>`
    }
  };

  const template = messages[lang] || messages.es;

  try {
    return await sendNotification(booking, template);
  } catch (err) {
    console.error('[Cancellations] Error notificando cancelación:', err.message);
    return { error: err.message };
  }
}

// ============================================================
// Obtener logs de cancelaciones para el dashboard
// ============================================================
export async function getCancellationLogs(propertyId, filters = {}) {
  let query = supabase
    .from('cancellation_logs')
    .select(`
      *,
      bookings(guest_name, guest_email, checkin_date, room_type, total_amount, source)
    `)
    .order('cancellation_date', { ascending: false });

  if (propertyId) query = query.eq('property_id', propertyId);
  if (filters.refund_status) query = query.eq('refund_status', filters.refund_status);
  if (filters.limit) query = query.limit(filters.limit || 50);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================
// Obtener métricas de cancelaciones
// ============================================================
export async function getCancellationMetrics(propertyId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data } = await supabase
    .from('cancellation_logs')
    .select('penalty_amount, refund_amount, refund_status, cancelled_by, policy_name')
    .eq('property_id', propertyId)
    .gte('cancellation_date', thirtyDaysAgo);

  const logs = data || [];
  return {
    total: logs.length,
    total_penalties: logs.reduce((s, l) => s + (l.penalty_amount || 0), 0),
    total_refunds: logs.reduce((s, l) => s + (l.refund_amount || 0), 0),
    pending_refunds: logs.filter(l => l.refund_status === 'pending').length,
    by_policy: logs.reduce((acc, l) => {
      acc[l.policy_name] = (acc[l.policy_name] || 0) + 1;
      return acc;
    }, {}),
    by_source: logs.reduce((acc, l) => {
      acc[l.cancelled_by] = (acc[l.cancelled_by] || 0) + 1;
      return acc;
    }, {})
  };
}

export default { processCancellation, getCancellationLogs, getCancellationMetrics };
