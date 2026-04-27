import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Resolver tenant_id efectivo del user autenticado.
// Prefer JWT.tenant_id (lo setea auth.js en login). Fallback: lookup en
// properties via user.property_id (compat tokens viejos pre-E-AGENT-1).
async function resolveCallerTenantId(user) {
  if (user.tenant_id) return user.tenant_id;
  if (!user.property_id) return null;
  const { data } = await supabase
    .from('properties')
    .select('tenant_id')
    .eq('id', user.property_id)
    .maybeSingle();
  return data?.tenant_id || null;
}

// GET /api/users — list users for the current tenant only
router.get('/', requireAuth, async (req, res) => {
  try {
    const { role, active } = req.query;
    const tenantId = await resolveCallerTenantId(req.user);
    if (!tenantId) return res.json([]);

    let query = supabase.from('users').select('id, full_name, email, role, active, created_at, last_login_at')
      .eq('tenant_id', tenantId)
      .order('full_name');

    if (role) query = query.eq('role', role);
    if (active !== undefined) query = query.eq('active', active === 'true');

    const { data, error } = await query;
    if (error) return res.json([]);
    res.json(data || []);
  } catch (e) {
    res.json([]);
  }
});

// PATCH /api/users/:id — update role or active status (admin/owner only,
// tenant-scoped). E-AGENT-9: antes cualquier authenticated user editaba
// cualquier user de cualquier tenant.
router.patch('/:id', requireAuth, requireRole('admin', 'manager', 'owner'), async (req, res) => {
  try {
    const callerTenantId = await resolveCallerTenantId(req.user);
    if (!callerTenantId) return res.status(403).json({ error: 'Sin tenant válido' });

    // Verificar que el target user pertenezca al mismo tenant
    const { data: target, error: tErr } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (tErr || !target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.tenant_id !== callerTenantId) {
      return res.status(403).json({ error: 'No puedes modificar usuarios de otro tenant' });
    }

    // Whitelist de campos editables (no permitir cambiar email, password_hash, tenant_id)
    const allowed = ['role', 'active', 'full_name'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Sin campos válidos para actualizar' });
    }

    // Bloquear self-demotion del último owner (evita lockout)
    if (req.user.id === req.params.id && updates.role && updates.role !== 'owner') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', callerTenantId)
        .eq('role', 'owner')
        .eq('active', true);
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'No puedes demoverte como único owner del tenant' });
      }
    }

    const { data, error } = await supabase.from('users')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', callerTenantId) // doble check defensa-en-profundidad
      .select('id, full_name, email, role, active')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
