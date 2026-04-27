/**
 * POST /api/register — Registro público de nuevos tenants Alzio
 * Crea tenant + property + user en un paso y devuelve token de onboarding.
 *
 * E-AGENT-9 (2026-04-26): bcrypt en password (antes plaintext en
 * users.password_hash y tenants.dashboard_password) + JWT_SECRET
 * centralizado (antes default 'dev-secret').
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../models/supabase.js';
import { JWT_SECRET, hashPassword } from '../utils/security.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/register
router.post('/', authLimiter, async (req, res) => {
  const { email, password, name, business_name, phone, plan = 'pro' } = req.body;

  if (!email || !password || !name || !business_name) {
    return res.status(400).json({ error: 'email, password, name y business_name son requeridos' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
    }

    // Get plan by key name
    const planName = plan === 'enterprise' ? 'Enterprise' : plan === 'basico' ? 'Básico' : 'Pro';
    const { data: planData } = await supabase
      .from('tenant_plans')
      .select('id, name, price_monthly')
      .ilike('name', `%${planName.split('á').join('a')}%`)
      .single();

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const tenantSlug = business_name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Create tenant — NO guardar password plaintext en dashboard_password.
    // El campo legacy queda NULL; la auth real vive en users.password_hash (bcrypt).
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        business_name,
        slug: tenantSlug,
        contact_email: email.toLowerCase().trim(),
        contact_phone: phone || null,
        contact_name: name,
        plan_id: planData?.id || null,
        billing_cycle: 'monthly',
        status: 'trial',
        trial_ends_at: trialEnd,
        dashboard_email: email.toLowerCase().trim(),
        dashboard_password: null,
        onboarding_completed: false,
        onboarding_checklist: { tenant_created: true, property_created: false, apis_configured: false, test_conversation: false }
      })
      .select()
      .single();

    if (tenantErr) throw tenantErr;

    // Create admin user con bcrypt
    const passwordHash = await hashPassword(password);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        name,
        role: 'admin',
        password_hash: passwordHash,
        password_hash_version: 1,
        password_changed_at: new Date().toISOString(),
        is_active: true,
        // property_id will be set after onboarding
      })
      .select()
      .single();

    if (userErr) throw userErr;

    // Issue onboarding JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'admin', tenant_id: tenant.id },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      token,
      tenant: {
        id: tenant.id,
        business_name: tenant.business_name,
        slug: tenant.slug,
        plan_key: plan,
        trial_ends_at: trialEnd,
      },
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('[Register]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/onboarding/complete — save property + connections after wizard
router.post('/onboarding/complete', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const {
    property_name, location, booking_url, language = 'es',
    lobby_pms_id, lobby_pms_token,
    whatsapp_number, whatsapp_token, whatsapp_phone_id,
  } = req.body;

  const tenantId = decoded.tenant_id;
  if (!tenantId) return res.status(400).json({ error: 'tenant_id no encontrado en el token' });

  try {
    let property = null;

    if (property_name) {
      const propSlug = (property_name || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .insert({
          name: property_name,
          slug: propSlug,
          location: location || '',
          booking_url: booking_url || null,
          whatsapp_number: whatsapp_number || null,
          lobby_pms_id: lobby_pms_id || null,
          tenant_id: tenantId,
          is_active: true,
          languages: language ? [language] : ['es'],
        })
        .select()
        .single();

      if (propErr) throw propErr;
      property = prop;

      // Link user to property
      await supabase.from('users')
        .update({ property_id: property.id })
        .eq('id', decoded.id);

      // Save WhatsApp token as settings
      if (whatsapp_token && property.id) {
        await supabase.from('settings').upsert({
          property_id: property.id,
          key: 'whatsapp_config',
          value: { token: whatsapp_token, phone_id: whatsapp_phone_id },
        }, { onConflict: 'property_id,key' });
      }

      // Save LobbyPMS token as settings
      if (lobby_pms_token && property.id) {
        await supabase.from('settings').upsert({
          property_id: property.id,
          key: 'lobbypms_token',
          value: lobby_pms_token,
        }, { onConflict: 'property_id,key' });
      }

      // Update tenant onboarding checklist
      await supabase.from('tenants').update({
        onboarding_completed: true,
        onboarding_checklist: {
          tenant_created: true,
          property_created: true,
          apis_configured: !!(whatsapp_token || lobby_pms_token),
          test_conversation: false
        }
      }).eq('id', tenantId);
    }

    // Issue full dashboard token
    const dashToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: 'admin', property_id: property?.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token: dashToken, property });
  } catch (err) {
    console.error('[Onboarding complete]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
