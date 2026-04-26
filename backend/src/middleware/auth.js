import jwt from 'jsonwebtoken';
import { supabase } from '../models/supabase.js';

// ============================================================
// requireAuth — valida JWT y popula req.user con role + tenant_id
// ============================================================
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'revio_dev_secret_2026');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ============================================================
// requireSuperAdmin — solo super_admin
// ============================================================
export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  });
}

// ============================================================
// requireRole(...allowedRoles) — RBAC simple basado en req.user.role del JWT.
// El role viene de public.users.role (TEXT field). super_admin siempre pasa.
//
// Uso:
//   router.delete('/users/:id', requireRole('admin', 'manager'), handler)
//
// Roles soportados (legacy + nuevos): super_admin, admin, manager,
// receptionist, staff, marketing, readonly, owner, operator, viewer.
// ============================================================
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      try {
        const role = req.user?.role;
        if (!role) {
          return res.status(403).json({ error: 'Sin rol en sesión' });
        }
        // super_admin (Alzio internal) bypassa RBAC
        if (role === 'super_admin') return next();
        // Match directo
        if (allowedRoles.includes(role)) return next();
        // Aliasing legacy: 'staff' y 'receptionist' equivalen a 'operator' nuevo
        const legacyAliases = {
          staff: 'operator',
          receptionist: 'operator',
          marketing: 'operator',
          readonly: 'viewer',
        };
        if (legacyAliases[role] && allowedRoles.includes(legacyAliases[role])) {
          return next();
        }
        return res.status(403).json({
          error: 'Permiso insuficiente',
          required: allowedRoles,
          your_role: role,
        });
      } catch (err) {
        return res.status(500).json({ error: 'Error verificando permisos: ' + err.message });
      }
    });
  };
}

// ============================================================
// requireWidgetKey — auth simple para widget embebible
// ============================================================
export function requireWidgetKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key requerida' });
  }
  req.apiKey = apiKey;
  next();
}
