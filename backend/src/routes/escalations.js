/**
 * Escalations route — gestión de escalaciones del agente al equipo humano.
 * Lee/escribe en `conversations` con las columnas escalated/agent_paused.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from '../services/agentUtils.js';

const router = Router();

// GET /api/escalations/:propertyId — escalaciones de la propiedad
router.get('/escalations/:propertyId', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .eq('escalated', true)
      .order('escalated_at', { ascending: false });
    if (status === 'active')   query = query.is('resolved_at', null);
    if (status === 'resolved') query = query.not('resolved_at', 'is', null);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ escalations: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/escalations/:conversationId/resolve — marcar como resuelta
router.put('/escalations/:conversationId/resolve', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        escalated: false,
        agent_paused: false,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.params.conversationId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, conversation: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/conversations/:id/resume-agent — reactivar agente
router.put('/conversations/:id/resume-agent', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({ agent_paused: false })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, conversation: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/escalations/notify — disparar manualmente notificación a alert phones
router.post('/escalations/notify', requireAuth, async (req, res) => {
  try {
    const { property_id, conversation_id, reason, phones } = req.body;
    const message =
      `🚨 *ESCALACIÓN*\n\n` +
      `Propiedad: ${property_id}\n` +
      `Conversación: ${conversation_id}\n` +
      `Razón: ${reason || 'sin especificar'}\n\n` +
      `Ver: https://revio-app-production.up.railway.app/conversations/${conversation_id}`;
    for (const phone of (phones || [])) {
      if (phone) await sendWhatsAppMessage(phone, message);
    }
    res.json({ success: true, notified: phones?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
