import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  pingAllIntegrations,
  getIntegrationHealth,
} from '../services/integrationHealth.js';

const router = Router();

// GET /api/integration-health?property_id=X
router.get('/', requireAuth, async (req, res) => {
  try {
    const propertyId = req.query.property_id || req.user.property_id;
    if (!propertyId) return res.status(400).json({ error: 'property_id_required' });
    const health = await getIntegrationHealth(propertyId);
    res.json({ health });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/integration-health/ping — verifica todas y persiste
router.post('/ping', requireAuth, async (req, res) => {
  try {
    const propertyId = req.body.property_id || req.query.property_id || req.user.property_id;
    if (!propertyId) return res.status(400).json({ error: 'property_id_required' });
    const results = await pingAllIntegrations(propertyId);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
