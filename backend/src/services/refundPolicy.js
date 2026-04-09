/**
 * Motor de evaluación de políticas de cancelación + aprendizaje por
 * pattern matching sobre cancellation_cases históricas.
 *
 * NO procesa refunds automáticamente sin aprobación — devuelve una
 * recomendación que el gerente revisa. Esto evita fraude y errores
 * costosos.
 */
import { supabase } from '../models/supabase.js';
import { getSetting } from './connectionService.js';

/**
 * Política por defecto de Revio (editable por tenant en settings.key='refund_policy').
 * Basada en días de anticipación al check-in.
 */
const DEFAULT_POLICY = {
  full_refund_days: 7,      // >= 7 días antes: reembolso 100%
  half_refund_days: 3,      // >= 3 días antes: reembolso 50%
  no_refund_days: 0,        // < 3 días: 0%
  force_majeure_refund: 1.0, // fuerza mayor: 100%
  dispute_hours_limit: 24,  // ventana post-reserva para reembolso completo sin penalidad
};

// Keywords que disparan política de fuerza mayor (caso especial)
const FORCE_MAJEURE_KEYWORDS = [
  'emergencia', 'hospital', 'enfermedad grave', 'fallecimiento', 'luto',
  'accidente', 'covid', 'desastre natural', 'huracán', 'inundación',
  'emergency', 'hospital', 'death', 'accident', 'natural disaster',
];

/**
 * Calcula días entre dos fechas.
 */
function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

/**
 * Evalúa el contexto de la cancelación y devuelve una recomendación.
 * @param {object} params
 *   - tenantId
 *   - propertyId
 *   - reservationId
 *   - totalAmountCop
 *   - checkInDate (YYYY-MM-DD)
 *   - reservationCreatedAt (ISO)
 *   - cancellationReason (texto libre del cliente)
 *   - bookingSource (direct|ota_booking|ota_airbnb|...)
 * @returns {object} { recommendedRefundCop, recommendedPct, reasoning, confidence, requiresApproval }
 */
export async function evaluateRefund(params) {
  const {
    tenantId,
    propertyId,
    totalAmountCop = 0,
    checkInDate,
    reservationCreatedAt,
    cancellationReason = '',
    bookingSource = 'direct',
  } = params;

  // 1. Cargar política del tenant (o default)
  const customPolicy = await getSetting(propertyId, 'refund_policy');
  const policy = { ...DEFAULT_POLICY, ...(customPolicy || {}) };

  const today = new Date();
  const daysToCheckIn = daysBetween(checkInDate, today);

  // 2. Caso especial: fuerza mayor (keywords detectados)
  const reasonLower = cancellationReason.toLowerCase();
  const isForceMajeure = FORCE_MAJEURE_KEYWORDS.some(k => reasonLower.includes(k));

  if (isForceMajeure) {
    return {
      recommendedRefundCop: Math.round(totalAmountCop * policy.force_majeure_refund),
      recommendedPct: policy.force_majeure_refund * 100,
      reasoning: `Caso de fuerza mayor detectado ("${cancellationReason.slice(0, 60)}..."). Política humanitaria: reembolso ${policy.force_majeure_refund * 100}%.`,
      confidence: 0.85,
      requiresApproval: true,
      category: 'force_majeure',
    };
  }

  // 3. Caso especial: cancelación dentro de la ventana de disputa (reserva reciente)
  if (reservationCreatedAt) {
    const hoursSinceBooking = (today - new Date(reservationCreatedAt)) / (1000 * 60 * 60);
    if (hoursSinceBooking <= policy.dispute_hours_limit) {
      return {
        recommendedRefundCop: totalAmountCop,
        recommendedPct: 100,
        reasoning: `Cancelación dentro de la ventana de disputa (${Math.round(hoursSinceBooking)}h de ${policy.dispute_hours_limit}h). Reembolso 100% obligatorio por ley de consumidor.`,
        confidence: 0.95,
        requiresApproval: false,
        category: 'dispute_window',
      };
    }
  }

  // 4. Política estándar por días de anticipación
  let recommendedPct;
  let category;
  if (daysToCheckIn >= policy.full_refund_days) {
    recommendedPct = 1.0;
    category = 'full_refund';
  } else if (daysToCheckIn >= policy.half_refund_days) {
    recommendedPct = 0.5;
    category = 'half_refund';
  } else {
    recommendedPct = 0;
    category = 'no_refund';
  }

  // 5. Ajuste por canal de venta (OTAs pueden tener condiciones distintas)
  let noteOta = '';
  if (bookingSource.startsWith('ota_')) {
    noteOta = ` Nota: reserva de ${bookingSource.replace('ota_', '')}. Verificar si la OTA aplica su propia política — a veces el huésped ya recibió reembolso desde la OTA y no corresponde el de Revio.`;
  }

  // 6. Aprendizaje por pattern matching sobre casos pasados similares
  let historicalNote = '';
  try {
    const { data: historical } = await supabase
      .from('cancellation_cases')
      .select('refund_status, refund_amount_cop, approval_note')
      .eq('tenant_id', tenantId)
      .eq('refund_status', 'completed')
      .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (historical && historical.length > 0) {
      const approved = historical.filter(c => (c.refund_amount_cop || 0) > 0);
      const avgApprovedPct = approved.length > 0
        ? approved.reduce((s, c) => s + (c.refund_amount_cop || 0), 0) / (approved.length * Math.max(totalAmountCop, 1))
        : 0;
      historicalNote = ` Histórico (últimos 180 días): ${approved.length}/${historical.length} casos aprobados con reembolso promedio ${Math.round(avgApprovedPct * 100)}%.`;
    }
  } catch {
    // tabla puede no existir aún — no romper
  }

  return {
    recommendedRefundCop: Math.round(totalAmountCop * recommendedPct),
    recommendedPct: recommendedPct * 100,
    reasoning: `Cancelación a ${daysToCheckIn} días del check-in. Política: ${category.replace('_', ' ')} (${recommendedPct * 100}%).${noteOta}${historicalNote}`,
    confidence: 0.75,
    requiresApproval: recommendedPct < 1.0 || totalAmountCop > 500000,
    category,
    daysToCheckIn,
  };
}

/**
 * Aplica una decisión aprobada: actualiza el caso y (futuro) dispara refund
 * vía pasarela de pago. Requiere aprobación previa del gerente.
 */
export async function executeApprovedRefund(caseId, approvedBy, approvalNote) {
  const { data: caseRow, error } = await supabase
    .from('cancellation_cases')
    .select('*')
    .eq('id', caseId)
    .single();

  if (error || !caseRow) return { success: false, error: 'case_not_found' };
  if (caseRow.refund_status !== 'approved') {
    return { success: false, error: `case_status_is_${caseRow.refund_status}, expected 'approved'` };
  }

  const { error: updErr } = await supabase
    .from('cancellation_cases')
    .update({
      refund_status: 'processing',
      approved_by: approvedBy,
      approval_note: approvalNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (updErr) return { success: false, error: updErr.message };

  // TODO: disparar refund via Wompi/PayU/gateway usado originalmente
  // Esto requiere el payment_reference original y acceso al service role de la gateway
  // Por ahora solo dejamos el caso en 'processing' para que el gerente finalice manual.

  return { success: true, caseId, newStatus: 'processing', note: 'Refund marcado en processing. Ejecutar manualmente en la pasarela hasta completar la integración de refunds automáticos.' };
}
