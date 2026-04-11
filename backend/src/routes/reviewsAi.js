import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';
import {
  fetchTripAdvisorReviews,
  generateReviewResponse,
  getReviewsWithResponses,
  markReviewPublished,
} from '../services/reviewsAiService.js';

const router = Router();

// GET /api/reviews-ai/:propertyId — listar reseñas con respuestas IA
router.get('/reviews-ai/:propertyId', requireAuth, async (req, res) => {
  try {
    const { status, limit } = req.query;
    const reviews = await getReviewsWithResponses(req.params.propertyId, {
      status: status || null,
      limit: parseInt(limit) || 100,
    });
    res.json({ reviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews-ai/:propertyId/fetch — gatillar fetch a TripAdvisor
router.post('/reviews-ai/:propertyId/fetch', requireAuth, async (req, res) => {
  try {
    const result = await fetchTripAdvisorReviews(req.params.propertyId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews-ai/:reviewId/generate — IA redacta respuesta
router.post('/reviews-ai/:reviewId/generate', requireAuth, async (req, res) => {
  try {
    const result = await generateReviewResponse(req.params.reviewId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/reviews-ai/:reviewId — actualizar respuesta editada
router.patch('/reviews-ai/:reviewId', requireAuth, async (req, res) => {
  try {
    const { ai_response } = req.body;
    const { data, error } = await supabase
      .from('property_reviews')
      .update({ ai_response, status: 'response_ready' })
      .eq('id', req.params.reviewId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews-ai/:reviewId/publish — marcar como publicada
router.post('/reviews-ai/:reviewId/publish', requireAuth, async (req, res) => {
  try {
    const result = await markReviewPublished(req.params.reviewId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/waitlist — registrar email en lista de espera de feature
router.post('/waitlist', async (req, res) => {
  try {
    const { email, feature, property_id, notes } = req.body;
    if (!email || !feature) return res.status(400).json({ error: 'email y feature requeridos' });
    const { data, error } = await supabase
      .from('waitlist_features')
      .insert({ email, feature, property_id: property_id || null, notes: notes || null })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
