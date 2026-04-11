/**
 * Learning route — gestión de items de aprendizaje del agente IA.
 * Cuando un admin "aplica" un item, hace UPSERT en property_knowledge.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = Router();

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

// GET /api/learning/:propertyId — list items
router.get('/learning/:propertyId', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('learning_items')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ items: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/learning/:propertyId — crear item
router.post('/learning/:propertyId', requireAuth, async (req, res) => {
  try {
    const { source, original_question, agent_response, issue_type, suggested_fix, conversation_id } = req.body;
    if (!original_question) return res.status(400).json({ error: 'original_question requerido' });
    const { data, error } = await supabase
      .from('learning_items')
      .insert({
        property_id: req.params.propertyId,
        source: source || 'ensayo',
        original_question,
        agent_response: agent_response || null,
        issue_type: issue_type || 'no_answer',
        suggested_fix: suggested_fix || null,
        conversation_id: conversation_id || null,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ item: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/learning/:itemId/apply — aplicar fix → upsert en property_knowledge
router.put('/learning/:itemId/apply', requireAuth, async (req, res) => {
  try {
    const { suggested_fix } = req.body;

    const { data: item } = await supabase
      .from('learning_items')
      .select('*')
      .eq('id', req.params.itemId)
      .single();
    if (!item) return res.status(404).json({ error: 'item_not_found' });

    const fix = suggested_fix || item.suggested_fix;
    if (!fix) return res.status(400).json({ error: 'no_fix_provided' });

    // UPSERT en property_knowledge
    const key = slugify(item.original_question);
    await supabase
      .from('property_knowledge')
      .upsert(
        {
          property_id: item.property_id,
          category: 'faq',
          key,
          value: fix,
          is_active: true,
        },
        { onConflict: 'property_id,category,key' }
      );

    // Marcar item como applied
    const { data, error } = await supabase
      .from('learning_items')
      .update({
        status: 'applied',
        suggested_fix: fix,
        applied_at: new Date().toISOString(),
        applied_by: req.user?.email || 'admin',
      })
      .eq('id', req.params.itemId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/learning/:itemId/dismiss
router.put('/learning/:itemId/dismiss', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('learning_items')
      .update({ status: 'dismissed' })
      .eq('id', req.params.itemId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
