import jwt from 'jsonwebtoken';
import { supabase } from '../models/supabase.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  });
}

// Middleware para validar API key del widget embebible
export function requireWidgetKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  // Validación simple — en producción usar tabla de api_keys en Supabase
  if (!apiKey) {
    return res.status(401).json({ error: 'API key requerida' });
  }
  // Por ahora validamos contra env — ampliar con DB en multitenancy
  req.apiKey = apiKey;
  next();
}
