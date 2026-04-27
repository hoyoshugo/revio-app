/**
 * aiUsageTracker — registra el uso de Anthropic per-tenant.
 *
 * Llamar después de cada respuesta exitosa de Claude:
 *   await trackAnthropicUsage({ tenantId, propertyId, source, usage, model });
 *
 * Hace UPSERT a tenant_usage agregando conversations/tokens del día.
 *
 * Costos (USD per 1M tokens) actualizados periódicamente. Estos son
 * estimaciones — el cobro real al cliente final viene de la factura de
 * Anthropic + margin de Alzio.
 */
import { supabase } from '../models/supabase.js';

// Pricing por 1M tokens (USD). Source: anthropic.com/pricing 2026-04-26.
const PRICING = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  // Fallback genérico
  default: { input: 3.0, output: 15.0 },
};

function priceFor(model) {
  if (!model) return PRICING.default;
  const key = String(model).toLowerCase().replace(/-\d{8}$/, '');
  return PRICING[key] || PRICING.default;
}

/**
 * Trackea uso de Anthropic.
 * @param {object} params
 * @param {string|null} params.tenantId  — REQUERIDO para attribuir el costo
 * @param {string|null} params.propertyId
 * @param {string} params.source         — 'agent' | 'escalation' | 'audit' | 'reviews'
 * @param {object} params.usage          — { input_tokens, output_tokens } del response Anthropic
 * @param {string} params.model          — modelo usado
 * @param {number} params.messages       — cuantos messages se enviaron al modelo (típicamente 1)
 * @param {boolean} params.platformPaid  — true si se uso la key plataforma (cobro a Alzio)
 */
export async function trackAnthropicUsage({
  tenantId,
  propertyId = null,
  source = 'agent',
  usage,
  model,
  messages = 1,
  platformPaid = false,
}) {
  if (!tenantId) {
    console.warn('[aiUsageTracker] skipped: no tenantId provided');
    return;
  }
  if (!usage || (typeof usage.input_tokens !== 'number' && typeof usage.output_tokens !== 'number')) {
    return; // sin tokens no hay nada que loguear
  }

  const inputTokens = Number(usage.input_tokens) || 0;
  const outputTokens = Number(usage.output_tokens) || 0;
  const p = priceFor(model);
  const costUsd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // E-AGENT-13 M5 (2026-04-26): atomic increment via Postgres function.
  // Antes era SELECT-then-UPDATE sin transaction → race condition con
  // calls concurrentes (dos respuestas en paralelo del mismo tenant
  // leían la misma row, calculaban totals, el segundo write pisaba al
  // primer → undercounting → undercharging).
  //
  // La función `increment_tenant_usage` (creada en migration_012) hace
  // INSERT ... ON CONFLICT DO UPDATE atómicamente.
  try {
    const { error: rpcErr } = await supabase.rpc('increment_tenant_usage', {
      p_tenant_id: tenantId,
      p_date: today,
      p_messages: messages,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cost_usd: Number(costUsd.toFixed(4)),
    });

    // Fallback: si la función todavía no existe (migration pendiente),
    // usar el patrón viejo SELECT/UPDATE con warning. Esto evita que
    // el upgrade rompa producción mientras la migration aplica.
    if (rpcErr) {
      console.warn('[aiUsageTracker] RPC increment_tenant_usage falló, fallback a SELECT/UPDATE:', rpcErr.message);
      const { data: existing } = await supabase
        .from('tenant_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('tenant_usage')
          .update({
            messages_count: (existing.messages_count || 0) + messages,
            api_calls_claude: (existing.api_calls_claude || 0) + 1,
            claude_input_tokens: (existing.claude_input_tokens || 0) + inputTokens,
            claude_output_tokens: (existing.claude_output_tokens || 0) + outputTokens,
            estimated_cost_usd: Number((Number(existing.estimated_cost_usd || 0) + costUsd).toFixed(4)),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('tenant_usage').insert({
          tenant_id: tenantId,
          date: today,
          messages_count: messages,
          api_calls_claude: 1,
          claude_input_tokens: inputTokens,
          claude_output_tokens: outputTokens,
          estimated_cost_usd: Number(costUsd.toFixed(4)),
        });
      }
    }
  } catch (err) {
    console.error('[aiUsageTracker] Failed to log usage:', err.message);
    // No tirar el error — el tracking no debe romper la respuesta del agente
  }
}

/**
 * Verifica si el tenant superó su límite de conversaciones del mes.
 * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
 */
export async function checkMonthlyConversationLimit(tenantId) {
  if (!tenantId) return { allowed: true, used: 0, limit: 0 };
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const { data: tenant } = await supabase
      .from('tenants')
      .select('max_conversations_month')
      .eq('id', tenantId)
      .maybeSingle();

    const limit = tenant?.max_conversations_month || 0;
    if (!limit) return { allowed: true, used: 0, limit: 0 };

    const { data: usage } = await supabase
      .from('tenant_usage')
      .select('messages_count')
      .eq('tenant_id', tenantId)
      .gte('date', monthStartStr);

    const used = (usage || []).reduce((acc, r) => acc + (r.messages_count || 0), 0);
    return { allowed: used < limit, used, limit };
  } catch (err) {
    console.error('[aiUsageTracker] limit check failed:', err.message);
    return { allowed: true, used: 0, limit: 0 };
  }
}

/**
 * Verifica si el tenant tiene su propia API key Anthropic configurada.
 * Si byok_required = true y no hay key, retorna { configured: false, reason }.
 */
export async function checkBYOKStatus(tenantId, propertyId) {
  if (!tenantId) return { configured: true, byokRequired: false };
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('byok_required, platform_billing_enabled')
      .eq('id', tenantId)
      .maybeSingle();

    const byokRequired = !!tenant?.byok_required;
    const platformBillingEnabled = !!tenant?.platform_billing_enabled;

    // Buscar key per-property en settings
    let hasKey = false;
    if (propertyId) {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('property_id', propertyId)
        .eq('key', 'anthropic_config')
        .maybeSingle();
      const cfg = setting?.value;
      // value puede venir parseado (object) o como string
      const apiKey = (typeof cfg === 'string' ? JSON.parse(cfg) : cfg)?.api_key;
      hasKey = !!(apiKey && String(apiKey).trim().length > 10);
    }

    if (byokRequired && !hasKey) {
      return {
        configured: false,
        byokRequired: true,
        platformBillingEnabled,
        reason: 'Tu tenant requiere BYOK pero no hay API key Anthropic configurada en Settings.',
      };
    }
    if (!hasKey && !platformBillingEnabled) {
      return {
        configured: false,
        byokRequired: false,
        platformBillingEnabled: false,
        reason: 'No hay API key configurada y el billing plataforma está deshabilitado.',
      };
    }
    return { configured: true, byokRequired, platformBillingEnabled, hasKey };
  } catch (err) {
    console.error('[aiUsageTracker] checkBYOKStatus failed:', err.message);
    return { configured: true, byokRequired: false };
  }
}

export default { trackAnthropicUsage, checkMonthlyConversationLimit, checkBYOKStatus };
