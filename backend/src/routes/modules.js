import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperadminAuth } from '../middleware/superadminAuth.js';

// Compat: el ModulesPanel usa el token de super-admin tech (sa_token), no el
// JWT regular. requireSuperAdmin del middleware/auth.js valida un role
// 'super_admin' que NO existe en el flujo actual. Usamos requireSuperadminAuth
// que valida JWT_SUPERADMIN_SECRET + role 'superadmin_tech'.
const requireSuperAdmin = requireSuperadminAuth;

const router = Router();

// Obtener tenant_id del usuario autenticado via property_id
async function getTenantId(user) {
  if (!user.property_id) return null;
  const { data } = await supabase
    .from('properties')
    .select('tenant_id')
    .eq('id', user.property_id)
    .single();
  return data?.tenant_id || null;
}

// GET /api/modules — módulos activos del tenant actual
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);

    const { data: allModules, error: modErr } = await supabase
      .from('revio_modules')
      .select('*')
      .order('priority');
    if (modErr) throw modErr;

    let activeMap = {};
    if (tenantId) {
      const { data: tenantMods } = await supabase
        .from('tenant_modules')
        .select('module_id, is_active, activated_at, expires_at')
        .eq('tenant_id', tenantId);
      (tenantMods || []).forEach(tm => { activeMap[tm.module_id] = tm; });
    }

    const modules = (allModules || []).map(m => ({
      ...m,
      tenant_active: activeMap[m.id]?.is_active || false,
      activated_at: activeMap[m.id]?.activated_at || null,
    }));

    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/modules/active — solo IDs de módulos activos del tenant
router.get('/active', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.json({ modules: [{ id: 'revenue_agent' }] });

    const { data, error } = await supabase
      .from('tenant_modules')
      .select('module_id, revio_modules(id, name, icon, status, completion_pct)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;

    const modules = (data || []).map(d => d.revio_modules).filter(Boolean);
    // Revenue agent siempre activo
    if (!modules.find(m => m.id === 'revenue_agent')) {
      modules.unshift({ id: 'revenue_agent', name: 'Revenue Agent', icon: '🤖', status: 'production' });
    }
    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/modules/all — superadmin: todos los módulos + estado por tenant
router.get('/all', requireSuperAdmin, async (req, res) => {
  try {
    const { data: modules, error: modErr } = await supabase
      .from('revio_modules')
      .select('*')
      .order('priority');
    if (modErr) throw modErr;

    const { data: tenantModules, error: tmErr } = await supabase
      .from('tenant_modules')
      .select('tenant_id, module_id, is_active, notes, activated_at');
    if (tmErr) throw tmErr;

    res.json({ modules: modules || [], tenantModules: tenantModules || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/modules/:moduleId/toggle — superadmin: activar/desactivar módulo para un tenant
router.patch('/:moduleId/toggle', requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, active, notes } = req.body;
    const { moduleId } = req.params;
    if (!tenantId) return res.status(400).json({ error: 'tenantId requerido' });

    const { data, error } = await supabase
      .from('tenant_modules')
      .upsert({
        tenant_id: tenantId,
        module_id: moduleId,
        is_active: Boolean(active),
        activated_at: active ? new Date().toISOString() : null,
        notes: notes || null,
      }, { onConflict: 'tenant_id,module_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, module: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/modules/:moduleId — superadmin: actualizar metadata de un módulo
router.patch('/:moduleId', requireSuperAdmin, async (req, res) => {
  try {
    const { completion_pct, status, is_sellable, base_price_cop } = req.body;
    const { data, error } = await supabase
      .from('revio_modules')
      .update({ completion_pct, status, is_sellable, base_price_cop, updated_at: new Date().toISOString() })
      .eq('id', req.params.moduleId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, module: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
