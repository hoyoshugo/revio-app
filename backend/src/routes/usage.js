// /api/usage — Lectura de uso/costo del agente IA per tenant.
// E-AGENT-4 wrap-up: expone los datos que aiUsageTracker UPSERT-ea a tenant_usage.
import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ────────────────────────────────────────────────────────────
// GET /api/usage/current-month
// Resuelve tenant_id del user (vía property_id) y devuelve agregados
// del mes actual: messages, tokens in/out, costo USD, días activos,
// % consumido vs max_conversations_month del tenant.
//
// Query params (opcionales):
//   - tenant_id: solo para super_admin que quiere ver otro tenant
// ────────────────────────────────────────────────────────────
router.get('/current-month', requireAuth, async (req, res) => {
  try {
    // Resolver tenant_id efectivo
    let tenantId = null;
    if (req.user.role === 'super_admin' && req.query.tenant_id) {
      tenantId = req.query.tenant_id;
    } else if (req.user.tenant_id) {
      tenantId = req.user.tenant_id;
    } else if (req.user.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('tenant_id')
        .eq('id', req.user.property_id)
        .maybeSingle();
      tenantId = prop?.tenant_id || null;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'No se pudo determinar tenant_id' });
    }

    // Inicio del mes actual (UTC)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    // Cargar tenant para max_conversations_month + branding flags
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, business_name, max_conversations_month, byok_required, platform_billing_enabled')
      .eq('id', tenantId)
      .maybeSingle();
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });

    // Sumar tenant_usage del mes actual
    const { data: rows, error } = await supabase
      .from('tenant_usage')
      .select('date, messages_count, api_calls_claude, claude_input_tokens, claude_output_tokens, estimated_cost_usd')
      .eq('tenant_id', tenantId)
      .gte('date', monthStartStr)
      .order('date', { ascending: false });

    if (error) throw error;

    const totals = (rows || []).reduce(
      (acc, r) => ({
        messages: acc.messages + (r.messages_count || 0),
        api_calls: acc.api_calls + (r.api_calls_claude || 0),
        input_tokens: acc.input_tokens + (r.claude_input_tokens || 0),
        output_tokens: acc.output_tokens + (r.claude_output_tokens || 0),
        cost_usd: acc.cost_usd + Number(r.estimated_cost_usd || 0),
      }),
      { messages: 0, api_calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 }
    );

    const limit = tenant.max_conversations_month || 0;
    const usagePct = limit > 0 ? Math.min(100, Math.round((totals.messages / limit) * 100)) : 0;

    res.json({
      tenant_id: tenantId,
      tenant_name: tenant.business_name,
      billing_mode: tenant.byok_required ? 'byok' : 'platform',
      period: {
        start: monthStartStr,
        end: now.toISOString().slice(0, 10),
        active_days: rows?.length || 0,
      },
      totals: {
        messages: totals.messages,
        api_calls: totals.api_calls,
        input_tokens: totals.input_tokens,
        output_tokens: totals.output_tokens,
        cost_usd: Number(totals.cost_usd.toFixed(4)),
      },
      limit: {
        max_conversations_month: limit,
        used_pct: usagePct,
        remaining: Math.max(0, limit - totals.messages),
      },
      daily: rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
