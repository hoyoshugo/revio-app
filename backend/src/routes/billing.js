import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import {
  isTenantEnabled,
  enableTenantManually,
  confirmPayment,
} from '../services/tenantAccess.js';
import {
  convertAmount,
  getPriceInCurrencies,
  SUPPORTED_CURRENCIES,
  refreshAllRates,
} from '../services/currencyService.js';
import { supabase } from '../models/supabase.js';

const router = Router();

async function getTenantId(user) {
  if (user.tenant_id) return user.tenant_id;
  if (user.tenantId) return user.tenantId;
  if (!user.property_id) return null;
  const { data } = await supabase
    .from('properties')
    .select('tenant_id')
    .eq('id', user.property_id)
    .single();
  return data?.tenant_id || null;
}

// GET /api/billing/status — estado del tenant actual
router.get('/status', requireAuth, async (req, res) => {
  const tenantId = await getTenantId(req.user);
  if (!tenantId) return res.status(400).json({ error: 'no_tenant_id' });

  const access = await isTenantEnabled(tenantId);
  const { data: billing } = await supabase
    .from('tenant_billing')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  res.json({ access, billing });
});

// POST /api/billing/enable — habilitar manualmente (SuperAdmin)
router.post('/enable', requireSuperAdmin, async (req, res) => {
  const { tenantId, days, notes } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
  const result = await enableTenantManually(
    tenantId,
    days || 30,
    req.user?.email || 'superadmin',
    notes || ''
  );
  res.json(result);
});

// POST /api/billing/confirm-payment — confirmar pago (SuperAdmin o webhook)
router.post('/confirm-payment', requireSuperAdmin, async (req, res) => {
  const { tenantId, amountCop, paymentMethod, periodDays } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
  const result = await confirmPayment(
    tenantId,
    amountCop || 0,
    paymentMethod || 'manual',
    periodDays || 30
  );
  res.json(result);
});

// GET /api/billing/tenants — todos los tenants con estado (SuperAdmin)
router.get('/tenants', requireSuperAdmin, async (_req, res) => {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, business_name, contact_email, created_at');

  const results = await Promise.all(
    (tenants || []).map(async (tenant) => {
      const { data: billing } = await supabase
        .from('tenant_billing')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single();
      const access = await isTenantEnabled(tenant.id);
      return { ...tenant, billing, access };
    })
  );

  res.json({ tenants: results });
});

// GET /api/billing/currencies — tasas actuales
router.get('/currencies', requireAuth, async (_req, res) => {
  const { data: rates } = await supabase
    .from('currency_rates')
    .select('*')
    .order('base_currency');
  res.json({ rates: rates || [], supported: SUPPORTED_CURRENCIES });
});

// POST /api/billing/convert — convertir monto
router.post('/convert', requireAuth, async (req, res) => {
  const { amount, from, to } = req.body;
  if (!amount || !to) return res.status(400).json({ error: 'amount_and_to_required' });
  const result = await convertAmount(Number(amount), from || 'COP', to);
  res.json(result);
});

// POST /api/billing/price-in-currencies — precio en múltiples monedas
router.post('/price-in-currencies', requireAuth, async (req, res) => {
  const { amountCop, currencies } = req.body;
  if (!amountCop) return res.status(400).json({ error: 'amountCop_required' });
  const result = await getPriceInCurrencies(
    Number(amountCop),
    currencies || ['COP', 'USD', 'EUR']
  );
  res.json(result);
});

// POST /api/billing/refresh-rates — forzar actualización (SuperAdmin)
router.post('/refresh-rates', requireSuperAdmin, async (_req, res) => {
  const result = await refreshAllRates();
  res.json(result);
});

export default router;
