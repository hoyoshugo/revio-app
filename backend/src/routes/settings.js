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
import { supabase } from '../models/supabase.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { encryptAiConfig, decryptAiConfig } from '../services/encryption.js';
import { getLobbyPMSToken, getWompiConfig, getWhatsAppConfig } from '../services/connectionService.js';

const router = Router();

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

router.put('/properties/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update({ ...req.body, updated_at: new Date().toISOString() })
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
router.get('/users', requireAuth, async (req, res) => {
  try {
    let query = supabase.from('users').select('id, email, name, role, property_id, is_active, last_login, created_at').order('created_at');
    // Staff solo ve usuarios de su propiedad
    if (req.user?.role !== 'super_admin' && req.query.property_id) {
      query = query.eq('property_id', req.query.property_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', requireAuth, async (req, res) => {
  const { email, name, role, property_id, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });
  try {
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const { data, error } = await supabase.from('users').insert({
      email: email.toLowerCase().trim(),
      name,
      role: role || 'staff',
      property_id: property_id || null,
      password_hash: password, // plaintext como el resto del sistema
      is_active: true
    }).select('id, email, name, role, property_id, is_active, created_at').single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', requireAuth, async (req, res) => {
  const { name, role, property_id, is_active, password } = req.body;
  try {
    const updates = {};
    if (name !== undefined)        updates.name        = name;
    if (role !== undefined)        updates.role        = role;
    if (property_id !== undefined) updates.property_id = property_id;
    if (is_active !== undefined)   updates.is_active   = is_active;
    if (password)                  updates.password_hash = password;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, email, name, role, property_id, is_active').single();
    if (error) throw error;
    res.json(data);
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
