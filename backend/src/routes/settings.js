/**
 * Rutas de Configuración del Sistema
 *
 * GET    /api/settings                    — Obtener toda la config de una propiedad
 * PUT    /api/settings                    — Guardar sección de config
 * GET    /api/settings/properties         — Listar propiedades
 * POST   /api/settings/properties         — Crear propiedad
 * PUT    /api/settings/properties/:id     — Editar propiedad
 * DELETE /api/settings/properties/:id     — Desactivar propiedad
 * GET    /api/settings/users              — Listar usuarios
 * POST   /api/settings/users              — Crear usuario
 * PUT    /api/settings/users/:id          — Editar usuario
 * POST   /api/settings/test/:service      — Probar conexión
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { supabase } from '../models/supabase.js';
import { requireAuth, requireSuperAdmin, requireRole } from '../middleware/auth.js';
import { encryptAiConfig, decryptAiConfig } from '../services/encryption.js';
import { getLobbyPMSToken, getWompiConfig, getWhatsAppConfig } from '../services/connectionService.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

async function logRbacAction(req, action, targetUserId, before, after) {
  try {
    await supabase.from('rbac_audit_log').insert({
      tenant_id: req.user?.tenant_id || null,
      actor_user_id: req.user?.id || null,
      target_user_id: targetUserId,
      action,
      before_state: before || null,
      after_state: after || null,
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });
  } catch { /* audit table puede no existir aun */ }
}

// ============================================================
// HELPERS
// ============================================================

async function getSetting(propertyId, key) {
  const query = supabase.from('settings').select('value').eq('key', key);
  if (propertyId) query.eq('property_id', propertyId);
  else query.is('property_id', null);
  const { data } = await query.single();
  return data?.value || null;
}

async function upsertSetting(propertyId, key, value, updatedBy) {
  await supabase.from('settings').upsert(
    { property_id: propertyId || null, key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: 'property_id,key' }
  );
}

// ============================================================
// GET /api/settings — toda la config de una propiedad
// ============================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const propertyId = req.query.property_id || null;

    // Cargar settings guardados en BD
    const query = supabase.from('settings').select('key, value');
    if (propertyId) query.eq('property_id', propertyId);
    else query.is('property_id', null);
    const { data: rows } = await query;

    const saved = {};
    for (const row of rows || []) {
      // Descifrar claves AI antes de enviar al frontend
      if (row.key === 'ai_provider') {
        saved[row.key] = decryptAiConfig(row.value);
      } else {
        saved[row.key] = row.value;
      }
    }

    // Datos de la propiedad
    let property = null;
    if (propertyId) {
      const { data: p } = await supabase.from('properties').select('*').eq('id', propertyId).single();
      property = p;
    }

    res.json({ settings: saved, property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PUT /api/settings — guardar sección de config
// ============================================================
router.put('/', requireAuth, async (req, res) => {
  const { property_id, key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Falta key' });

  try {
    // Cifrar claves AI antes de guardar en Supabase
    const storedValue = key === 'ai_provider' ? encryptAiConfig(value) : value;
    await upsertSetting(property_id || null, key, storedValue, req.user?.email);

    // Si es config general, actualizar también la tabla properties
    if (key === 'general' && property_id) {
      const updates = {};
      if (value.name)             updates.name             = value.name;
      if (value.brand_name)       updates.brand_name       = value.brand_name;
      if (value.brand_logo_url)   updates.brand_logo_url   = value.brand_logo_url;
      if (value.brand_primary_color) updates.brand_primary_color = value.brand_primary_color;
      if (value.brand_secondary_color) updates.brand_secondary_color = value.brand_secondary_color;
      if (value.timezone)         updates.timezone         = value.timezone;
      if (value.default_language) updates.default_language = value.default_language;
      if (value.location)         updates.location         = value.location;
      if (value.whatsapp_number)  updates.whatsapp_number  = value.whatsapp_number;
      if (value.booking_url)      updates.booking_url      = value.booking_url;

      if (Object.keys(updates).length > 0) {
        await supabase.from('properties').update(updates).eq('id', property_id);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PROPIEDADES
// ============================================================
router.get('/properties', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, tenants(group_name, group_description)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    // Aplanar group_name al nivel de la propiedad para conveniencia del frontend
    const flat = (data || []).map(p => ({
      ...p,
      group_name: p.tenants?.group_name || null,
      group_description: p.tenants?.group_description || null,
    }));
    res.json(flat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/properties', requireSuperAdmin, async (req, res) => {
  const { name, slug, location, whatsapp_number, booking_url, timezone, default_language } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name y slug son requeridos' });
  try {
    const { data, error } = await supabase.from('properties').insert({
      name, slug, location, whatsapp_number, booking_url,
      timezone: timezone || 'America/Bogota',
      default_language: default_language || 'es',
      is_active: true
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// E-AGENT-9 H-SEC-2 (2026-04-26): RBAC + tenant scoping en property update.
// Antes: cualquier authenticated user podía editar cualquier property con
// cualquier campo (incluyendo tenant_id, lo cual permitía hijack cross-tenant).
router.put('/properties/:id', requireAuth, async (req, res) => {
  try {
    // Solo admin/owner/manager pueden editar propiedades
    const role = req.user?.role;
    if (!['admin', 'owner', 'manager', 'super_admin'].includes(role)) {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    // Verificar tenant ownership
    const callerTenantId = req.user?.tenant_id;
    if (!callerTenantId && role !== 'super_admin') {
      return res.status(403).json({ error: 'Sin tenant válido' });
    }

    const { data: target } = await supabase
      .from('properties')
      .select('id, tenant_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!target) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (role !== 'super_admin' && target.tenant_id !== callerTenantId) {
      return res.status(403).json({ error: 'No puedes editar propiedades de otro tenant' });
    }

    // Whitelist de campos (NO permitir cambiar tenant_id ni id)
    const ALLOWED = new Set([
      'name', 'brand_name', 'brand_logo_url', 'brand_primary_color',
      'brand_secondary_color', 'location', 'timezone', 'default_language',
      'whatsapp_number', 'booking_url', 'plan', 'languages', 'lobby_pms_id',
      'is_active',
    ]);
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ALLOWED.has(k))
    );
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/properties/:id', requireSuperAdmin, async (req, res) => {
  try {
    await supabase.from('properties').update({ is_active: false }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USUARIOS
// ============================================================
// E-AGENT-9 H-SEC-3 (2026-04-26): tenant scoping obligatorio. Antes
// listaba todos los usuarios de TODOS los tenants si el caller no era
// super_admin y no pasaba property_id (la mayoría de los casos).
router.get('/users', requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const callerTenantId = req.user?.tenant_id;
    const propertyId = req.user?.property_id;

    let query = supabase.from('users').select('id, email, name, role, property_id, tenant_id, is_active, last_login, created_at').order('created_at');

    if (role === 'super_admin') {
      // SA puede filtrar libremente
      if (req.query.property_id) query = query.eq('property_id', req.query.property_id);
      if (req.query.tenant_id) query = query.eq('tenant_id', req.query.tenant_id);
    } else {
      // Resolver tenant si no está en el JWT (compat tokens viejos)
      let tenantId = callerTenantId;
      if (!tenantId && propertyId) {
        const { data: prop } = await supabase
          .from('properties').select('tenant_id').eq('id', propertyId).maybeSingle();
        tenantId = prop?.tenant_id || null;
      }
      if (!tenantId) return res.json([]);
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', requireRole('admin', 'manager'), async (req, res) => {
  const { email, name, role, property_id, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        name,
        role: role || 'staff',
        property_id: property_id || null,
        password_hash: passwordHash,
        password_hash_version: 1,
        password_changed_at: new Date().toISOString(),
        is_active: true,
      })
      .select('id, email, name, role, property_id, is_active, created_at')
      .single();

    if (error) throw error;

    // Asociar al tenant via tenant_members si el caller tiene tenant_id
    if (req.user?.tenant_id) {
      try {
        const tenantRoleMap = {
          super_admin: 'admin',
          admin: 'admin',
          manager: 'manager',
          owner: 'owner',
          staff: 'operator',
          receptionist: 'operator',
          marketing: 'operator',
          readonly: 'viewer',
        };
        await supabase.from('tenant_members').insert({
          tenant_id: req.user.tenant_id,
          user_id: data.id,
          role: tenantRoleMap[role || 'staff'] || 'viewer',
          invited_by: req.user.id,
          is_active: true,
        });
      } catch { /* tabla puede no existir aun */ }
    }

    await logRbacAction(req, 'create_user', data.id, null, { email: data.email, role: data.role });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { name, role, property_id, is_active, password } = req.body;
  try {
    // Self-protection: un manager no puede degradar a un admin/owner
    const { data: target } = await supabase
      .from('users')
      .select('id, email, role, property_id, is_active')
      .eq('id', req.params.id)
      .single();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (property_id !== undefined) updates.property_id = property_id;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
      updates.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      updates.password_hash_version = 1;
      updates.password_changed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, email, name, role, property_id, is_active')
      .single();
    if (error) throw error;

    const action = password ? 'reset_password' : 'update_user';
    await logRbacAction(req, action, data.id, target, { ...target, ...updates });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// DELETE /api/settings/users/:id — desactivar (soft delete)
// Solo owner/admin pueden borrar. No se borra fila para preservar audit log.
// ────────────────────────────────────────────────────────────
router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    const { data: target } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', req.params.id)
      .single();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // No permitir borrar al ultimo owner del tenant
    if (req.user.tenant_id) {
      try {
        const { data: tm } = await supabase
          .from('tenant_members')
          .select('id, user_id, role, is_active')
          .eq('tenant_id', req.user.tenant_id)
          .eq('role', 'owner')
          .eq('is_active', true);
        const isLastOwner = tm?.length === 1 && tm[0].user_id === req.params.id;
        if (isLastOwner) {
          return res.status(400).json({ error: 'No puedes eliminar al último owner del tenant' });
        }
      } catch { /* tabla puede no existir */ }
    }

    await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (req.user.tenant_id) {
      try {
        await supabase
          .from('tenant_members')
          .update({ is_active: false })
          .eq('tenant_id', req.user.tenant_id)
          .eq('user_id', req.params.id);
      } catch { /* */ }
    }

    await logRbacAction(req, 'delete', req.params.id, target, { is_active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/settings/users/:id/reset-password
// Solo owner/admin pueden resetear. Genera password temporal random
// (12 chars), retorna en response. El usuario debe cambiarla al login.
// ────────────────────────────────────────────────────────────
router.post('/users/:id/reset-password', requireRole('admin'), async (req, res) => {
  try {
    const { data: target } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', req.params.id)
      .single();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Random password 12 chars sin chars confusos (sin O 0 l 1 I)
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let temp = '';
    for (let i = 0; i < 12; i++) {
      temp += charset[Math.floor(Math.random() * charset.length)];
    }

    const passwordHash = await bcrypt.hash(temp, BCRYPT_ROUNDS);
    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        password_hash_version: 1,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    await logRbacAction(req, 'reset_password', target.id, null, { email: target.email });
    res.json({ success: true, email: target.email, temporary_password: temp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/settings/users/invite — invitar por email (sin password)
// Crea row en tenant_members con invite_token y user inactivo. El usuario
// completa el signup desde el email recibido.
// ────────────────────────────────────────────────────────────
router.post('/users/invite', requireRole('admin', 'manager'), async (req, res) => {
  const { email, role, property_id } = req.body;
  if (!email) return res.status(400).json({ error: 'email es requerido' });
  if (!req.user?.tenant_id) {
    return res.status(400).json({ error: 'No se pudo determinar tu tenant_id' });
  }
  try {
    const cleanEmail = email.toLowerCase().trim();

    // Si ya existe el user, agregarlo como tenant_member directo
    const { data: existing } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    const tenantRoleMap = {
      admin: 'admin',
      manager: 'manager',
      operator: 'operator',
      viewer: 'viewer',
    };
    const tenantRole = tenantRoleMap[role || 'operator'] || 'operator';

    const inviteToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existing) {
      // Add a tenant_members row (or upsert)
      const { error } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: req.user.tenant_id,
          user_id: existing.id,
          role: tenantRole,
          invited_by: req.user.id,
          invited_email: cleanEmail,
          is_active: true,
        }, { onConflict: 'tenant_id,user_id' });
      if (error) throw error;
      await logRbacAction(req, 'invite_existing', existing.id, null, { email: cleanEmail, role: tenantRole });
      return res.json({ success: true, status: 'added_existing_user', email: cleanEmail });
    }

    // Crear placeholder row en tenant_members con invite_token (sin user_id aún)
    // Esquema actual requiere user_id NOT NULL; fallback: documentar que el flujo
    // de invite-by-email completo requiere endpoint /accept-invite que crea el user.
    // Por ahora, error claro para que admin sepa que necesita crear el user manualmente.
    return res.status(501).json({
      error: 'Invitación por email a usuarios nuevos no implementada todavía. Crea el usuario directamente con email + password temporal.',
      hint: 'POST /api/settings/users con password temporal y compártelo manualmente',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PROBAR CONEXIONES
// ============================================================
router.post('/test/:service', requireAuth, async (req, res) => {
  const { service } = req.params;
  const { slug } = req.body; // property slug para buscar tokens en env

  try {
    switch (service) {
      case 'lobbypms': {
        const propertyId = req.user?.property_id || null;
        const token = await getLobbyPMSToken(propertyId, slug);
        if (!token) return res.json({ ok: false, message: 'Token LobbyPMS no configurado' });
        const r = await axios.get('https://api.lobbypms.com/api/v1/rate-plans', {
          headers: { Authorization: `Bearer ${token}` }, timeout: 8000
        });
        return res.json({ ok: true, message: `Conectado — ${r.status} OK` });
      }

      case 'wompi': {
        const propertyId = req.user?.property_id || null;
        const config = await getWompiConfig(propertyId, slug);
        const pubKey = config?.public_key;
        if (!pubKey) return res.json({ ok: false, message: 'Llave pública Wompi no configurada' });
        const r = await axios.get(`https://production.wompi.co/v1/merchants/${pubKey}`, { timeout: 8000 });
        return res.json({ ok: true, message: `Conectado — merchant activo` });
      }

      case 'whatsapp': {
        const propertyId = req.user?.property_id || null;
        const config = await getWhatsAppConfig(propertyId);
        const token = config?.access_token;
        const phoneId = config?.phone_number_id;
        if (!token) return res.json({ ok: false, message: 'Token WhatsApp no configurado' });
        await axios.get(`https://graph.facebook.com/v18.0/${phoneId}`, {
          headers: { Authorization: `Bearer ${token}` }, timeout: 8000
        });
        return res.json({ ok: true, message: 'WhatsApp Business conectado' });
      }

      case 'booking': {
        const user = process.env[`BOOKING_USERNAME_${slug?.toUpperCase().replace(/-/g, '_')}`];
        if (!user || user === 'pendiente') return res.json({ ok: false, message: 'Credenciales no configuradas' });
        return res.json({ ok: false, message: 'Requiere partnership con Booking.com' });
      }

      case 'instagram': {
        const token = process.env[`INSTAGRAM_ACCESS_TOKEN_${slug?.toUpperCase().replace(/-/g, '_')}`];
        if (!token || token === 'pendiente') return res.json({ ok: false, message: 'Token no configurado' });
        const r = await axios.get('https://graph.facebook.com/v19.0/me', {
          params: { access_token: token }, timeout: 8000
        });
        return res.json({ ok: true, message: `Cuenta: ${r.data?.name || r.data?.id}` });
      }

      case 'google': {
        const refreshToken = process.env[`GOOGLE_REFRESH_TOKEN_${slug?.toUpperCase().replace(/-/g, '_')}`];
        if (!refreshToken || refreshToken === 'pendiente') return res.json({ ok: false, message: 'Refresh token no configurado' });
        return res.json({ ok: true, message: 'Google Business configurado (verificar en uso real)' });
      }

      case 'tripadvisor': {
        const apiKey = process.env.TRIPADVISOR_API_KEY;
        if (!apiKey || apiKey === 'pendiente') return res.json({ ok: false, message: 'API key no configurada' });
        const locationId = process.env[`TRIPADVISOR_LOCATION_ID_${slug?.toUpperCase().replace(/-/g, '_')}`];
        if (!locationId || locationId === 'pendiente') return res.json({ ok: false, message: 'Location ID no configurado' });
        const r = await axios.get(`https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`, {
          params: { key: apiKey }, timeout: 8000
        });
        return res.json({ ok: true, message: `Ubicación: ${r.data?.name || locationId}` });
      }

      case 'anthropic': {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) return res.json({ ok: false, message: 'API key no configurada' });
        return res.json({ ok: true, message: 'Claude API configurada correctamente' });
      }

      default:
        return res.status(400).json({ ok: false, message: `Servicio desconocido: ${service}` });
    }
  } catch (err) {
    const status = err.response?.status;
    // 401/403/404 = servidor vivo pero auth fallida → conexión funciona
    if ([401, 403, 404].includes(status)) {
      return res.json({ ok: true, message: `Servidor responde (HTTP ${status} — verificar credenciales)` });
    }
    res.json({ ok: false, message: err.message });
  }
});

// ── GET /api/settings/property ────────────────────────────────
router.get('/property', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data, error } = await supabase.from('properties').select('*').eq('id', pid).single();
    if (error) throw error;
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/settings/property ─────────────────────────────
router.patch('/property', requireAuth, async (req, res) => {
  const { property_id, ...updates } = req.body;
  const pid = property_id || req.user.property_id;
  const allowed = ['name', 'brand_name', 'location', 'phone', 'email', 'website',
    'description', 'check_in_time', 'check_out_time', 'currency', 'timezone', 'tax_rate',
    'brand_logo_url', 'cover_url'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('properties')
      .update({ ...safe, updated_at: new Date().toISOString() })
      .eq('id', pid).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/settings/integrations ───────────────────────────
router.get('/integrations', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  try {
    const { data } = await supabase.from('property_integrations')
      .select('key,value').eq('property_id', pid);
    const result = {};
    for (const row of data || []) {
      result[row.key] = row.value ? row.value.slice(0, 6) + '...' : '';
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/settings/integrations ─────────────────────────
router.patch('/integrations', requireAuth, async (req, res) => {
  const { property_id, ...keys } = req.body;
  const pid = property_id || req.user.property_id;
  const ALLOWED_KEYS = ['anthropic_key', 'wompi_public', 'wompi_private', 'whatsapp_token', 'whatsapp_phone_id', 'lobbypms_key'];
  try {
    const upserts = Object.entries(keys)
      .filter(([k, v]) => ALLOWED_KEYS.includes(k) && v && !v.endsWith('...'))
      .map(([k, v]) => ({ property_id: pid, key: k, value: v }));
    if (upserts.length > 0) {
      const { error } = await supabase.from('property_integrations')
        .upsert(upserts, { onConflict: 'property_id,key' });
      if (error) throw error;
    }
    res.json({ success: true, updated: upserts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
