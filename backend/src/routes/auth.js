// /api/auth — Authentication endpoints for Alzio
// E-AGENT-1 (2026-04-26): bcrypt hashing + auto-rehash de legacy plaintext.
// E-AGENT-9 (2026-04-26): centralizado JWT_SECRET + verifyPassword/hashPassword
// en utils/security.js (fail-closed en producción).
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { JWT_SECRET, hashPassword, verifyPassword } from '../utils/security.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { v, validate } from '../utils/validate.js';

const router = Router();

// Schemas (E-AGENT-13 M1)
const loginSchema = {
  email: v.string().email().required(),
  password: v.string().min(1).required(),
};
const registerSchema = {
  name: v.string().min(2).max(100).required(),
  email: v.string().email().required(),
  password: v.string().min(8).max(100).required(),
  property_name: v.string().min(2).max(100).required(),
  phone: v.string().max(30),
  property_type: v.string().max(50),
  city: v.string().max(100),
  plan: v.string().max(50),
};

// Resolver tenant_id principal de un user (vía tenant_members; fallback a property)
async function resolveTenantId(userId, propertyId) {
  try {
    const { data: member } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (member?.tenant_id) return member.tenant_id;
  } catch { /* tabla puede no existir aún (pre-migration) */ }

  if (propertyId) {
    const { data: prop } = await supabase
      .from('properties').select('tenant_id').eq('id', propertyId).maybeSingle();
    return prop?.tenant_id || null;
  }
  return null;
}

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, properties(id,name,slug,brand_name,brand_logo_url,location,plan)')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const { ok, needsRehash } = await verifyPassword(
      password,
      user.password_hash,
      user.password_hash_version
    );
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Auto-rehash legacy plaintext en background (no bloquea login)
    if (needsRehash) {
      (async () => {
        try {
          const newHash = await hashPassword(password);
          await supabase
            .from('users')
            .update({
              password_hash: newHash,
              password_hash_version: 1,
              password_changed_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          console.log(`[auth] Rehashed legacy password for user ${user.id}`);
        } catch (err) {
          console.error('[auth] Rehash failed:', err.message);
        }
      })();
    }

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const tenantId = await resolveTenantId(user.id, user.property_id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        property_id: user.property_id,
        tenant_id: tenantId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Fetch all properties + group_name del tenant
    const { data: properties } = await supabase
      .from('properties')
      .select('id,name,slug,brand_name,brand_logo_url,location,plan,is_active,tenant_id,tenants(group_name,group_description)')
      .eq('is_active', true)
      .order('name');

    const flatProperties = (properties || []).map((p) => ({
      ...p,
      group_name: p.tenants?.group_name || null,
      group_description: p.tenants?.group_description || null,
    }));

    const { password_hash, password_hash_version, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
      properties: flatProperties,
      current_property: user.properties || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password, phone, property_name, property_type, city, plan = 'starter' } = req.body;

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'Este email ya está registrado' });

    const baseSlug = property_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${baseSlug}-${suffix}`;

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({
        slug,
        name: property_name,
        brand_name: property_name,
        location: city || 'Colombia',
        plan,
        is_active: true,
      })
      .select()
      .single();
    if (propErr) throw propErr;

    const passwordHash = await hashPassword(password);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        property_id: property.id,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        password_hash_version: 1,
        password_changed_at: new Date().toISOString(),
        name,
        role: 'admin',
        is_active: true,
      })
      .select()
      .single();
    if (userErr) throw userErr;

    // Crear tenant_members owner si la tabla existe
    try {
      if (property.tenant_id) {
        await supabase.from('tenant_members').insert({
          tenant_id: property.tenant_id,
          user_id: user.id,
          role: 'owner',
          is_active: true,
        });
      }
    } catch { /* tabla puede no existir aún */ }

    const tenantId = property.tenant_id || (await resolveTenantId(user.id, property.id));

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        property_id: property.id,
        tenant_id: tenantId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, password_hash_version, ...safeUser } = user;
    res.status(201).json({
      token,
      user: safeUser,
      properties: [property],
      current_property: property,
      message: `¡Bienvenido a Alzio, ${name}! Tu propiedad "${property_name}" está lista.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/change-password ────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password y new_password requeridos' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash, password_hash_version')
      .eq('id', req.user.id)
      .single();
    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { ok } = await verifyPassword(current_password, user.password_hash, user.password_hash_version);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const newHash = await hashPassword(new_password);
    await supabase
      .from('users')
      .update({
        password_hash: newHash,
        password_hash_version: 1,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Audit log
    try {
      await supabase.from('rbac_audit_log').insert({
        actor_user_id: req.user.id,
        target_user_id: req.user.id,
        action: 'change_password',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || null,
      });
    } catch { /* audit table puede no existir aún */ }

    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id,email,name,role,property_id,last_login,created_at')
      .eq('id', req.user.id)
      .single();
    if (error) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { data: properties } = await supabase
      .from('properties')
      .select('id,name,slug,brand_name,brand_logo_url,location,plan,is_active,tenant_id,tenants(group_name,group_description)')
      .eq('is_active', true);

    const flatProperties = (properties || []).map((p) => ({
      ...p,
      group_name: p.tenants?.group_name || null,
      group_description: p.tenants?.group_description || null,
    }));

    res.json({ user, properties: flatProperties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

export default router;
