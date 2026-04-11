// /api/auth — Authentication endpoints for Revio
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*, properties(id,name,slug,brand_name,brand_logo_url,location,plan)')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (password !== user.password_hash) return res.status(401).json({ error: 'Credenciales inválidas' });

    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, property_id: user.property_id },
      process.env.JWT_SECRET || 'revio_dev_secret_2026',
      { expiresIn: '7d' }
    );

    // Fetch all properties + group_name del tenant
    const { data: properties } = await supabase
      .from('properties')
      .select('id,name,slug,brand_name,brand_logo_url,location,plan,is_active,tenant_id,tenants(group_name,group_description)')
      .eq('is_active', true)
      .order('name');

    const flatProperties = (properties || []).map(p => ({
      ...p,
      group_name: p.tenants?.group_name || null,
      group_description: p.tenants?.group_description || null,
    }));

    const { password_hash, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
      properties: flatProperties,
      current_property: user.properties || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, phone, property_name, property_type, city, plan = 'starter' } = req.body;
  if (!name || !email || !password || !property_name) {
    return res.status(400).json({ error: 'name, email, password y property_name son requeridos' });
  }

  try {
    // Check for existing email
    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Este email ya está registrado' });

    // Create property slug
    const baseSlug = property_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix   = Math.random().toString(36).slice(2, 6);
    const slug     = `${baseSlug}-${suffix}`;

    // Create property
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({
        slug, name: property_name, brand_name: property_name,
        location: city || 'Colombia', plan,
        is_active: true
      })
      .select().single();
    if (propErr) throw propErr;

    // Create admin user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        property_id: property.id, email: email.toLowerCase(), password_hash: password,
        name, role: 'admin', is_active: true
      })
      .select().single();
    if (userErr) throw userErr;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, property_id: property.id },
      process.env.JWT_SECRET || 'revio_dev_secret_2026',
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.status(201).json({
      token,
      user: safeUser,
      properties: [property],
      current_property: property,
      message: `¡Bienvenido a Revio, ${name}! Tu propiedad "${property_name}" está lista.`
    });
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
      .eq('id', req.user.id).single();
    if (error) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { data: properties } = await supabase
      .from('properties')
      .select('id,name,slug,brand_name,brand_logo_url,location,plan,is_active,tenant_id,tenants(group_name,group_description)')
      .eq('is_active', true);

    // Aplanar group_name al nivel de propiedad
    const flatProperties = (properties || []).map(p => ({
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
  // JWT is stateless; client clears token. Server-side: could add to blocklist.
  res.json({ success: true });
});

export default router;
