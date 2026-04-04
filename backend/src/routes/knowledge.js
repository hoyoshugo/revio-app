/**
 * knowledge.js — Base de conocimiento dinámica por propiedad
 * GET  /api/knowledge/:propertyId           — listar entradas
 * POST /api/knowledge/:propertyId           — crear entrada
 * PUT  /api/knowledge/:propertyId/:id       — actualizar entrada
 * DELETE /api/knowledge/:propertyId/:id     — eliminar entrada
 */
import express from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/knowledge/:propertyId — listar entradas activas + inactivas
router.get('/:propertyId', requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { category } = req.query;

    let query = supabase
      .from('property_knowledge')
      .select('*')
      .eq('property_id', propertyId)
      .order('category')
      .order('sort_order');

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ entries: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/:propertyId — crear entrada
router.post('/:propertyId', requireAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { category, key, value, is_active = true, sort_order = 0 } = req.body;

    if (!category || !key || !value) {
      return res.status(400).json({ error: 'category, key y value son requeridos' });
    }

    const { data, error } = await supabase
      .from('property_knowledge')
      .insert({ property_id: propertyId, category, key, value, is_active, sort_order })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una entrada con esa categoría y clave' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ entry: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/knowledge/:propertyId/:id — actualizar entrada
router.put('/:propertyId/:id', requireAuth, async (req, res) => {
  try {
    const { propertyId, id } = req.params;
    const { value, is_active, sort_order, key } = req.body;

    const updates = {};
    if (value !== undefined) updates.value = value;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (key !== undefined) updates.key = key;

    const { data, error } = await supabase
      .from('property_knowledge')
      .update(updates)
      .eq('id', id)
      .eq('property_id', propertyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Entrada no encontrada' });

    res.json({ entry: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/knowledge/:propertyId/:id — eliminar entrada
router.delete('/:propertyId/:id', requireAuth, async (req, res) => {
  try {
    const { propertyId, id } = req.params;

    const { error } = await supabase
      .from('property_knowledge')
      .delete()
      .eq('id', id)
      .eq('property_id', propertyId);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
