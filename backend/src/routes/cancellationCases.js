import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendWhatsAppMessage } from '../services/agentUtils.js';

const router = Router();

function generateCaseNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CAN-${year}-${seq}`;
}

async function getTenantId(user) {
  if (user.tenant_id) return user.tenant_id;
  if (!user.property_id) return null;
  const { data } = await supabase
    .from('properties')
    .select('tenant_id')
    .eq('id', user.property_id)
    .single();
  return data?.tenant_id || null;
}

// POST /api/cancellation-cases — crear caso
router.post('/', requireAuth, async (req, res) => {
  try {
    const { reservationId, guestName, guestEmail, guestPhone, reason, propertyId, refundAmountCop } = req.body;
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });

    const caseNumber = generateCaseNumber();
    const { data, error } = await supabase
      .from('cancellation_cases')
      .insert({
        case_number: caseNumber,
        tenant_id: tenantId,
        property_id: propertyId,
        reservation_id: reservationId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        cancellation_reason: reason,
        refund_amount_cop: refundAmountCop || 0,
        refund_status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (guestPhone) {
      await sendWhatsAppMessage(
        guestPhone,
        `Hola ${guestName} 👋\n\n` +
        `Tu solicitud de cancelación ha sido recibida.\n` +
        `📋 Caso: *${caseNumber}*\n` +
        `Estado: en revisión\n\n` +
        `Te notificaremos en las próximas 24-48 horas con la decisión sobre tu reembolso.`
      );
    }

    res.json({ success: true, case: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cancellation-cases — listar casos del tenant
router.get('/', requireAuth, async (req, res) => {
  const tenantId = await getTenantId(req.user);
  const { data, error } = await supabase
    .from('cancellation_cases')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ cases: data || [] });
});

// PATCH /api/cancellation-cases/:id — actualizar estado / reembolso
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { refundStatus, approvedBy, note, refundMethod } = req.body;
    const tenantId = await getTenantId(req.user);

    const updates = {
      refund_status: refundStatus,
      approved_by: approvedBy,
      approval_note: note,
      refund_method: refundMethod,
      updated_at: new Date().toISOString(),
    };
    if (refundStatus === 'approved') updates.approved_at = new Date().toISOString();
    if (refundStatus === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('cancellation_cases')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (refundStatus === 'approved' && data.guest_phone) {
      await sendWhatsAppMessage(
        data.guest_phone,
        `✅ Tu cancelación ${data.case_number} fue *APROBADA*\n\n` +
        `💰 Reembolso: $${(data.refund_amount_cop || 0).toLocaleString()} COP\n` +
        `Método: ${refundMethod || 'Por definir'}\n\n` +
        `El proceso toma 3-5 días hábiles.`
      );
    }

    res.json({ success: true, case: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
