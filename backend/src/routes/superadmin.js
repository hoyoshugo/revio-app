/**
 * Rutas del Super Admin (Mística Tech)
 * Completamente separadas de las rutas de clientes.
 *
 * POST /api/sa/login
 * GET  /api/sa/dashboard
 * GET  /api/sa/tenants
 * POST /api/sa/tenants
 * PUT  /api/sa/tenants/:id
 * POST /api/sa/tenants/:id/toggle
 * POST /api/sa/tenants/:id/payment
 * GET  /api/sa/tenants/:id/usage
 * GET  /api/sa/plans
 * POST /api/sa/plans
 * PUT  /api/sa/plans/:id
 * GET  /api/sa/errors
 * PUT  /api/sa/errors/:id
 * POST /api/sa/errors/:id/correct
 * GET  /api/sa/usage
 * POST /api/sa/onboarding
 */
import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireSuperadminAuth, signSuperadminToken } from '../middleware/superadminAuth.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp.js';
import { getIpStatus } from '../utils/ipMonitor.js';

const router = Router();

// ============================================================
// AUTENTICACIÓN SEPARADA
// ============================================================
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const validEmail = process.env.SUPERADMIN_EMAIL || 'admin@misticatech.co';
  const validPass  = process.env.SUPERADMIN_PASSWORD || 'MisticaTech2026!';

  if (email?.toLowerCase().trim() !== validEmail || password !== validPass) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = signSuperadminToken(email);
  res.json({
    token,
    user: { email: validEmail, name: 'Super Admin', role: 'superadmin_tech', company: 'Mística Tech' }
  });
});

// ============================================================
// MÓDULO 1: DASHBOARD GLOBAL
// ============================================================
router.get('/dashboard', requireSuperadminAuth, async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = now.toISOString().split('T')[0];

    const [tenantsRes, usageTodayRes, usageMonthRes, errorsRes, plansRes] = await Promise.all([
      supabase.from('tenants').select('id, status, created_at'),
      supabase.from('tenant_usage').select('conversations_count, estimated_cost_usd').eq('date', today),
      supabase.from('tenant_usage').select('conversations_count, estimated_cost_usd').gte('date', monthStart),
      supabase.from('system_errors').select('id, severity, status').eq('status', 'open'),
      supabase.from('tenant_plans').select('id, name, price_monthly').eq('is_active', true)
    ]);

    const tenants = tenantsRes.data || [];
    const countBy = (arr, status) => arr.filter(t => t.status === status).length;

    // MRR: suma del plan de cada tenant activo
    let mrr = 0;
    if (tenants.length > 0) {
      const { data: activeWithPlan } = await supabase
        .from('tenants')
        .select('plan_id, tenant_plans(price_monthly)')
        .eq('status', 'active');
      mrr = (activeWithPlan || []).reduce((sum, t) => sum + (t.tenant_plans?.price_monthly || 0), 0);
    }

    // Crecimiento de clientes por mes (últimos 6 meses)
    const growth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = tenants.filter(t => {
        const c = new Date(t.created_at);
        return c >= d && c < end;
      }).length;
      growth.push({ month: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), count });
    }

    const todayUsage = usageTodayRes.data || [];
    const monthUsage = usageMonthRes.data || [];

    res.json({
      tenants: {
        total: tenants.length,
        active: countBy(tenants, 'active'),
        trial: countBy(tenants, 'trial'),
        suspended: countBy(tenants, 'suspended'),
        cancelled: countBy(tenants, 'cancelled'),
        overdue: countBy(tenants, 'overdue')
      },
      mrr: Math.round(mrr * 100) / 100,
      conversations: {
        today: todayUsage.reduce((s, u) => s + u.conversations_count, 0),
        month: monthUsage.reduce((s, u) => s + u.conversations_count, 0)
      },
      estimated_cost_month_usd: monthUsage.reduce((s, u) => s + Number(u.estimated_cost_usd || 0), 0).toFixed(4),
      open_errors: {
        total: (errorsRes.data || []).length,
        critical: (errorsRes.data || []).filter(e => e.severity === 'critical').length
      },
      growth,
      plans: plansRes.data || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 2: GESTIÓN DE TENANTS
// ============================================================
router.get('/tenants', requireSuperadminAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase
      .from('v_tenant_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('business_name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tenants/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*, tenant_plans(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    // Obtener propiedades del tenant
    const { data: props } = await supabase
      .from('properties')
      .select('id, name, slug, is_active')
      .eq('tenant_id', req.params.id);

    // Obtener historial de pagos
    const { data: payments } = await supabase
      .from('tenant_payments')
      .select('*')
      .eq('tenant_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ ...data, properties: props || [], payments: payments || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants', requireSuperadminAuth, async (req, res) => {
  const {
    business_name, slug, contact_email, contact_phone, contact_name,
    plan_id, status, trial_days, dashboard_email, dashboard_password, internal_notes
  } = req.body;

  if (!business_name || !contact_email) {
    return res.status(400).json({ error: 'business_name y contact_email son requeridos' });
  }

  try {
    const trialEnd = trial_days
      ? new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 días por defecto

    const { data, error } = await supabase.from('tenants').insert({
      business_name,
      slug: slug || business_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      contact_email,
      contact_phone,
      contact_name,
      plan_id: plan_id || null,
      status: status || 'trial',
      trial_ends_at: trialEnd,
      dashboard_email: dashboard_email || contact_email,
      dashboard_password: dashboard_password || 'Mistica2026!',
      internal_notes
    }).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tenants/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants/:id/toggle', requireSuperadminAuth, async (req, res) => {
  try {
    const { data: tenant } = await supabase.from('tenants').select('status, business_name, contact_phone').eq('id', req.params.id).single();
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';

    await supabase.from('tenants').update({ status: newStatus }).eq('id', req.params.id);

    if (tenant.contact_phone) {
      const supportEmail = process.env.SUPPORT_EMAIL || 'soporte@alzio.co';
      const msg = newStatus === 'active'
        ? `✅ *Alzio reactivado* — Tu acceso ha sido reactivado. ¡Bienvenido de vuelta!`
        : `⚠️ *Alzio suspendido* — Tu acceso ha sido suspendido. Contacta soporte: ${supportEmail}`;
      sendWhatsAppMessage(tenant.contact_phone, msg).catch(() => {});
    }

    res.json({ success: true, new_status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants/:id/payment', requireSuperadminAuth, async (req, res) => {
  const { amount, currency = 'USD', period_start, period_end, payment_method, external_ref, notes } = req.body;
  try {
    const { data: payment, error } = await supabase.from('tenant_payments').insert({
      tenant_id: req.params.id,
      amount, currency, status: 'paid',
      period_start, period_end,
      payment_method, external_ref, notes,
      paid_at: new Date().toISOString()
    }).select().single();
    if (error) throw error;

    // Actualizar estado del tenant
    await supabase.from('tenants').update({
      status: 'active',
      next_payment_at: period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }).eq('id', req.params.id);

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 4: PLANES
// ============================================================
router.get('/plans', requireSuperadminAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('tenant_plans').select('*').order('price_monthly');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('tenant_plans').insert(req.body).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenant_plans')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 5: ERRORES DEL SISTEMA
// ============================================================
router.get('/errors', requireSuperadminAuth, async (req, res) => {
  try {
    const { status, severity, tenant_id, limit = 100 } = req.query;
    let query = supabase
      .from('system_errors')
      .select('*, tenants(business_name)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (tenant_id) query = query.eq('tenant_id', tenant_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/errors/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = req.superadmin?.email;
    }
    const { data, error } = await supabase
      .from('system_errors')
      .update(updates)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/errors/:id/correct', requireSuperadminAuth, async (req, res) => {
  const { title, description, success = true, result_notes } = req.body;
  try {
    // Registrar corrección
    const { data } = await supabase.from('system_corrections').insert({
      error_id: req.params.id,
      title, description, success, result_notes,
      applied_by: req.superadmin?.email
    }).select().single();

    // Marcar error como resuelto
    if (success) {
      await supabase.from('system_errors').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: req.superadmin?.email,
        resolution_notes: result_notes
      }).eq('id', req.params.id);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 6: USO
// ============================================================
router.get('/usage', requireSuperadminAuth, async (req, res) => {
  try {
    const { tenant_id, days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = supabase
      .from('tenant_usage')
      .select('*, tenants(business_name)')
      .gte('date', since)
      .order('date', { ascending: false });

    if (tenant_id) query = query.eq('tenant_id', tenant_id);

    const { data, error } = await query;
    if (error) throw error;

    // Agregar totales por tenant
    const byTenant = {};
    for (const row of data || []) {
      const id = row.tenant_id;
      if (!byTenant[id]) byTenant[id] = {
        tenant_id: id, business_name: row.tenants?.business_name,
        conversations: 0, messages: 0,
        api_calls_claude: 0, api_calls_lobbypms: 0, api_calls_wompi: 0, api_calls_whatsapp: 0,
        claude_tokens: 0, estimated_cost_usd: 0
      };
      byTenant[id].conversations += row.conversations_count || 0;
      byTenant[id].messages += row.messages_count || 0;
      byTenant[id].api_calls_claude += row.api_calls_claude || 0;
      byTenant[id].api_calls_lobbypms += row.api_calls_lobbypms || 0;
      byTenant[id].api_calls_wompi += row.api_calls_wompi || 0;
      byTenant[id].api_calls_whatsapp += row.api_calls_whatsapp || 0;
      byTenant[id].claude_tokens += (row.claude_input_tokens || 0) + (row.claude_output_tokens || 0);
      byTenant[id].estimated_cost_usd += Number(row.estimated_cost_usd || 0);
    }

    res.json({ rows: data || [], summary_by_tenant: Object.values(byTenant) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 7: ONBOARDING
// ============================================================
router.post('/onboarding', requireSuperadminAuth, async (req, res) => {
  const {
    business_name, slug, contact_email, contact_phone, contact_name,
    plan_id, trial_days = 14, billing_cycle = 'monthly',
    property_name, property_slug, property_location, whatsapp_number, lobby_pms_id,
    dashboard_email, dashboard_password,
    user_name, user_role = 'admin',
    send_welcome
  } = req.body;

  if (!business_name || !contact_email) {
    return res.status(400).json({ error: 'business_name y contact_email son requeridos' });
  }

  try {
    // 1. Crear tenant
    const trialEnd = new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000).toISOString();
    const tenantSlug = slug || business_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const { data: tenant, error: tenantErr } = await supabase.from('tenants').insert({
      business_name, slug: tenantSlug,
      contact_email, contact_phone, contact_name,
      plan_id: plan_id || null,
      billing_cycle,
      status: 'trial', trial_ends_at: trialEnd,
      dashboard_email: dashboard_email || contact_email,
      dashboard_password: dashboard_password || 'Cambiar2026!',
      onboarding_completed: false,
      onboarding_checklist: { tenant_created: true, property_created: false, apis_configured: false, test_conversation: false }
    }).select().single();

    if (tenantErr) throw tenantErr;

    // 2. Crear propiedad inicial
    let property = null;
    if (property_name) {
      const propSlug = property_slug || (tenantSlug + '-prop1');
      const { data: prop } = await supabase.from('properties').insert({
        name: property_name,
        slug: propSlug,
        location: property_location || '',
        whatsapp_number: whatsapp_number || null,
        lobby_pms_id: lobby_pms_id || null,
        tenant_id: tenant.id,
        is_active: true
      }).select().single();
      property = prop;

      await supabase.from('tenants').update({
        onboarding_checklist: { tenant_created: true, property_created: true, apis_configured: false, test_conversation: false }
      }).eq('id', tenant.id);
    }

    // 3. Crear usuario de acceso al dashboard
    await supabase.from('users').insert({
      email: (dashboard_email || contact_email).toLowerCase(),
      name: user_name || contact_name || business_name,
      role: user_role || 'admin',
      property_id: property?.id || null,
      password_hash: dashboard_password || 'Cambiar2026!',
      is_active: true
    }).select().single();

    // 4. Notificación de bienvenida
    if (send_welcome) {
      const panelUrl = process.env.PANEL_URL || 'https://app.alzio.co';
      const welcomeMsg = `*¡Bienvenido a Alzio!*\n\n` +
        `Hola ${contact_name || business_name},\n\n` +
        `Tu cuenta está lista. Accede a tu panel en:\n` +
        `🔗 ${panelUrl}\n\n` +
        `📧 Usuario: ${dashboard_email || contact_email}\n` +
        `🔑 Contraseña: ${dashboard_password || 'Cambiar2026!'}\n\n` +
        `Tienes *${trial_days} días de prueba gratuita*.\n\n` +
        `Si necesitas ayuda, escríbenos aquí mismo.\n` +
        `Equipo Alzio`;

      if (contact_phone) {
        sendWhatsAppMessage(contact_phone, welcomeMsg).catch(() => {});
      }
    }

    res.json({ tenant, property, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MÓDULO 8: DESCUENTOS PERSONALIZADOS
// ============================================================

// GET /api/sa/discounts
router.get('/discounts', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenant_discounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error && error.message.includes('does not exist')) {
      return res.json([]); // Table not yet migrated — return empty
    }
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sa/discounts
router.post('/discounts', requireSuperadminAuth, async (req, res) => {
  const { tenant_id, type, value, expires_at, note, upgraded_plan_id } = req.body;
  if (!tenant_id || !type) return res.status(400).json({ error: 'tenant_id y type requeridos' });
  try {
    const { data, error } = await supabase
      .from('tenant_discounts')
      .insert({
        tenant_id, type,
        value: value ? Number(value) : null,
        expires_at: expires_at || null,
        note: note || null,
        upgraded_plan_id: upgraded_plan_id || null,
        created_by: 'superadmin'
      })
      .select()
      .single();
    if (error && error.message.includes('does not exist')) {
      return res.status(503).json({ error: 'Tabla tenant_discounts no existe. Ejecutar migration_008.' });
    }
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sa/discounts/:id
router.delete('/discounts/:id', requireSuperadminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tenant_discounts')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SYSTEM GUARDIAN — Reportes de salud del sistema
// ============================================================

// GET /api/sa/health-reports — listar reportes recientes
router.get('/health-reports', requireSuperadminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { data, error } = await supabase
      .from('system_health_reports')
      .select('id, status, critical_count, warning_count, ok_count, triggered_by, whatsapp_alert_sent, created_at, duration_seconds')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sa/health-reports/latest — último reporte completo
router.get('/health-reports/latest', requireSuperadminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_health_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sa/health-reports — guardar nuevo reporte (desde system-guardian)
router.post('/health-reports', requireSuperadminAuth, async (req, res) => {
  const {
    status = 'healthy', critical_count = 0, warning_count = 0, ok_count = 0,
    findings = {}, report_text = '', duration_seconds = null,
    triggered_by = 'manual', recurring_issues = []
  } = req.body;

  try {
    const { data, error } = await supabase
      .from('system_health_reports')
      .insert({
        status, critical_count, warning_count, ok_count,
        findings, report_text, duration_seconds, triggered_by, recurring_issues
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    // Si la tabla no existe todavía, devolver OK de todas formas
    if (err.message?.includes('does not exist')) {
      return res.json({ id: null, status, critical_count, warning_count, ok_count, created_at: new Date().toISOString(), _note: 'Tabla pendiente de migración' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sa/health-reports/alert — enviar alerta WhatsApp crítica
router.post('/health-reports/alert', requireSuperadminAuth, async (req, res) => {
  const { message, report_id } = req.body;
  const alertNumber = process.env.ALERT_WHATSAPP || '+573234392420';

  try {
    await sendWhatsAppMessage(alertNumber, message);

    // Marcar en el reporte que se envió la alerta
    if (report_id) {
      await supabase.from('system_health_reports').update({
        whatsapp_alert_sent: true,
        alert_sent_at: new Date().toISOString()
      }).eq('id', report_id);
    }

    res.json({ sent: true, to: alertNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PLAN USAGE ALERTS — Verificar si cliente superó límites
// ============================================================
router.get('/tenants/:id/limit-check', requireSuperadminAuth, async (req, res) => {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*, tenant_plans(*)')
      .eq('id', req.params.id)
      .single();

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const { data: usage } = await supabase
      .from('tenant_usage')
      .select('conversations_count')
      .eq('tenant_id', req.params.id)
      .gte('date', monthStart);

    const usedConversations = (usage || []).reduce((s, u) => s + u.conversations_count, 0);
    const maxConversations = tenant?.tenant_plans?.max_conversations_month || tenant?.max_conversations_month || 0;
    const pct = maxConversations > 0 ? Math.round(usedConversations / maxConversations * 100) : 0;

    res.json({
      conversations_used: usedConversations,
      conversations_limit: maxConversations,
      usage_pct: pct,
      over_limit: pct >= 100,
      warning: pct >= 80
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ESTADO DEL SERVIDOR — IP dinámica Railway
// ============================================================

/**
 * GET /api/sa/server-ip
 * Retorna la IP actual del servidor Railway y su historial.
 * Solo accesible para superadmin.
 */
router.get('/server-ip', requireSuperadminAuth, async (_req, res) => {
  try {
    const status = await getIpStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
