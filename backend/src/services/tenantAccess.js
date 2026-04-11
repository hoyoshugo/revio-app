/**
 * Control de acceso para tenants.
 * Un tenant está habilitado si:
 *   1. Status 'active' con current_period_end futuro (pago confirmado), O
 *   2. Status 'trial' con trial_ends_at futuro, O
 *   3. manually_enabled_until futuro (admin lo habilitó a mano)
 *
 * Fail-open: si no hay registro de billing asume trial (no romper servicio existente).
 */
import { supabase } from '../models/supabase.js';

export async function isTenantEnabled(tenantId) {
  if (!tenantId) return { enabled: true, reason: 'no_tenant_id' };

  try {
    const { data, error } = await supabase
      .from('tenant_billing')
      .select('status, trial_ends_at, manually_enabled_until, current_period_end')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      // Sin billing = trial automático (fail open)
      return { enabled: true, reason: 'no_billing_record_trial' };
    }

    const now = new Date();

    // 1. Suscripción activa con período vigente
    if (
      data.status === 'active' &&
      data.current_period_end &&
      new Date(data.current_period_end) > now
    ) {
      return {
        enabled: true,
        reason: 'active_subscription',
        expiresAt: data.current_period_end,
      };
    }

    // 2. Trial vigente
    if (
      data.status === 'trial' &&
      data.trial_ends_at &&
      new Date(data.trial_ends_at) > now
    ) {
      return { enabled: true, reason: 'trial', expiresAt: data.trial_ends_at };
    }

    // 3. Habilitado manualmente
    if (data.manually_enabled_until && new Date(data.manually_enabled_until) > now) {
      return {
        enabled: true,
        reason: 'manually_enabled',
        expiresAt: data.manually_enabled_until,
      };
    }

    return {
      enabled: false,
      reason: data.status || 'no_access',
      message: 'Tu cuenta está suspendida. Contacta a soporte@revio.co para renovar.',
    };
  } catch (e) {
    console.error('[TenantAccess] error:', e.message);
    // Fail open — no interrumpir servicio por error de BD
    return { enabled: true, reason: 'error_fallback' };
  }
}

/**
 * Habilitar manualmente (SuperAdmin).
 */
export async function enableTenantManually(tenantId, daysCount, enabledBy, notes = '') {
  const until = new Date();
  until.setDate(until.getDate() + daysCount);

  const { data, error } = await supabase
    .from('tenant_billing')
    .upsert(
      {
        tenant_id: tenantId,
        manually_enabled_until: until.toISOString(),
        enabled_by: enabledBy,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}

/**
 * Confirmar pago (llamado desde webhook Wompi/PayU o manualmente).
 */
export async function confirmPayment(tenantId, amountCop, paymentMethod, periodDays = 30) {
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + periodDays);

  const { data, error } = await supabase
    .from('tenant_billing')
    .upsert(
      {
        tenant_id: tenantId,
        status: 'active',
        last_payment_at: new Date().toISOString(),
        last_payment_amount_cop: amountCop,
        payment_method: paymentMethod,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_due_at: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}

/**
 * Middleware Express para proteger rutas por tenant habilitado.
 */
export async function requireEnabledTenant(req, res, next) {
  const tenantId = req.user?.tenantId || req.user?.tenant_id;
  if (!tenantId) return next();

  const access = await isTenantEnabled(tenantId);
  if (!access.enabled) {
    return res.status(402).json({
      error: 'tenant_suspended',
      message: access.message,
      reason: access.reason,
    });
  }

  req.tenantAccess = access;
  next();
}
