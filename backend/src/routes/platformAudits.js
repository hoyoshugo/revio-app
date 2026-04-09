import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function getTenantId(user) {
  if (user.tenant_id) return user.tenant_id;
  if (!user.property_id) return null;
  const { data } = await supabase.from('properties').select('tenant_id').eq('id', user.property_id).single();
  return data?.tenant_id || null;
}

// GET /api/platform-audits
router.get('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const { platform, property_id, limit = 50 } = req.query;
    let q = supabase.from('platform_audits').select('*').eq('tenant_id', tenantId)
      .order('audited_at', { ascending: false }).limit(parseInt(limit));
    if (platform) q = q.eq('platform', platform);
    if (property_id) q = q.eq('property_id', property_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ audits: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/platform-audits
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user);
    if (!tenantId) return res.status(400).json({ error: 'tenant_id requerido' });
    const {
      property_id, platform, audit_type, total_reviews, avg_rating,
      new_reviews, pending_responses, sentiment_positive, sentiment_neutral,
      sentiment_negative, key_issues, recommendations, raw_data,
    } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform requerido' });
    const { data, error } = await supabase.from('platform_audits').insert({
      tenant_id: tenantId, property_id: property_id || req.user.property_id,
      platform, audit_type: audit_type || 'weekly',
      total_reviews: total_reviews || 0, avg_rating, new_reviews: new_reviews || 0,
      pending_responses: pending_responses || 0,
      sentiment_positive: sentiment_positive || 0,
      sentiment_neutral: sentiment_neutral || 0,
      sentiment_negative: sentiment_negative || 0,
      key_issues: key_issues || [], recommendations: recommendations || [],
      raw_data: raw_data || {},
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
