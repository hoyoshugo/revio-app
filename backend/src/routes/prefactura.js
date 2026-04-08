import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sendWhatsAppMessage, requestApproval } from '../services/agentUtils.js';

const router = Router();

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

// POST /api/prefactura — crear prefactura y enviarla al gerente para aprobación
router.post('/', requireAuth, async (req, res) => {
  try {
    const { reservationId, guestName, guestEmail, guestPhone, items, propertyId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items requerido' });
    }

    const tenantId = await getTenantId(req.user);
    const subtotal = items.reduce((s, i) => s + (Number(i.price) * Number(i.qty || 1)), 0);
    const iva = Math.round(subtotal * 0.19);
    const total = subtotal + iva;

    const prefactura = {
      id: 'PRE-' + Date.now(),
      reservationId,
      guestName,
      guestEmail,
      guestPhone,
      items,
      subtotal,
      iva,
      total,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };

    const itemsList = items.map(i => `  • ${i.name}: $${(Number(i.price) * Number(i.qty || 1)).toLocaleString()}`).join('\n');
    const description =
      `Prefactura ${prefactura.id}\n` +
      `Cliente: ${guestName}\n` +
      `Reserva: ${reservationId || 'N/A'}\n\n` +
      `Conceptos:\n${itemsList}\n\n` +
      `Subtotal: $${subtotal.toLocaleString()}\n` +
      `IVA 19%: $${iva.toLocaleString()}\n` +
      `Total: $${total.toLocaleString()} COP`;

    await requestApproval(tenantId, propertyId, 'invoice', {
      description,
      guestName,
      guestContact: guestPhone || guestEmail,
      amountCop: total,
    });

    res.json({ success: true, prefactura });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
