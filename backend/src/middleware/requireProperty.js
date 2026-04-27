/**
 * requireProperty — middleware multi-tenant isolation (E-AGENT-10 B-AGT-2).
 *
 * Verifica que el `req.params.propertyId` pertenezca al tenant del caller.
 * Si no matchea → 403. Esto evita el patrón de leak donde rutas como
 * /api/knowledge/:propertyId solo filtran `.eq('property_id', x)` y un
 * cliente autenticado lee/edita knowledge de otro hotel cambiando la URL.
 *
 * Uso:
 *   import { requireProperty } from '../middleware/requireProperty.js';
 *   router.get('/:propertyId', requireAuth, requireProperty(), handler);
 *
 * Si el caller es super_admin, bypassa el check.
 *
 * Asume `requireAuth` ya pobló `req.user` con `tenant_id` (auth.js post
 * E-AGENT-1) o `property_id` (compat tokens viejos). El middleware
 * resuelve el tenant del target property con un solo lookup por request.
 */
import { supabase } from '../models/supabase.js';

/**
 * @param {object} options
 * @param {string} [options.paramName='propertyId'] - nombre del param de la URL
 * @param {boolean} [options.allowSuperAdmin=true] - bypass para super_admin role
 */
export function requireProperty(options = {}) {
  const paramName = options.paramName || 'propertyId';
  const allowSuperAdmin = options.allowSuperAdmin !== false;

  return async (req, res, next) => {
    try {
      const propertyId = req.params[paramName];
      if (!propertyId) {
        return res.status(400).json({ error: `Missing :${paramName} en URL` });
      }

      // Bypass super_admin (mantenimiento/debug cross-tenant)
      const role = req.user?.role;
      if (allowSuperAdmin && (role === 'super_admin' || role === 'superadmin_tech')) {
        return next();
      }

      // Resolver tenant del caller
      let callerTenantId = req.user?.tenant_id;
      if (!callerTenantId && req.user?.property_id) {
        const { data: callerProp } = await supabase
          .from('properties').select('tenant_id').eq('id', req.user.property_id).maybeSingle();
        callerTenantId = callerProp?.tenant_id || null;
      }
      if (!callerTenantId) {
        return res.status(403).json({ error: 'Sin tenant válido en sesión' });
      }

      // Lookup tenant del target property
      const { data: targetProp, error } = await supabase
        .from('properties')
        .select('tenant_id, is_active')
        .eq('id', propertyId)
        .maybeSingle();
      if (error || !targetProp) {
        return res.status(404).json({ error: 'Propiedad no encontrada' });
      }

      if (targetProp.tenant_id !== callerTenantId) {
        return res.status(403).json({
          error: 'No tienes acceso a esta propiedad',
          code: 'CROSS_TENANT_DENIED',
        });
      }

      // Anexar al request para que el handler pueda usarlo sin re-lookup
      req.targetProperty = { id: propertyId, tenant_id: targetProp.tenant_id };
      next();
    } catch (err) {
      console.error('[requireProperty]', err.message);
      res.status(500).json({ error: 'Error verificando ownership de propiedad' });
    }
  };
}
