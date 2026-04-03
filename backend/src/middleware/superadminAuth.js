/**
 * Middleware de autenticación exclusivo para el Super Admin (Mística Tech)
 * Usa JWT_SUPERADMIN_SECRET separado del JWT de los clientes.
 * Las credenciales vienen de SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en .env.
 */
import jwt from 'jsonwebtoken';

const SA_SECRET = process.env.JWT_SUPERADMIN_SECRET || process.env.JWT_SECRET + '_superadmin';

export function requireSuperadminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, SA_SECRET);
    if (decoded.role !== 'superadmin_tech') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    req.superadmin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function signSuperadminToken(email) {
  return jwt.sign(
    { email, role: 'superadmin_tech', iss: 'mystica-tech' },
    SA_SECRET,
    { expiresIn: '12h' }
  );
}
