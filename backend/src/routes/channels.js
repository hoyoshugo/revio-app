import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getProviderSelections,
  saveProviderSelection,
  getPropertyChannels,
  saveChannelConfig,
  pingChannel,
  getUnifiedInbox,
} from '../services/channelService.js';

const router = Router();

// ── PROVIDERS ──────────────────────────────────────────
router.get('/channels/:propertyId/providers', requireAuth, async (req, res) => {
  try {
    const selections = await getProviderSelections(req.params.propertyId);
    res.json({ selections });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/channels/:propertyId/providers', requireAuth, async (req, res) => {
  try {
    const { category, providerKey } = req.body;
    if (!category || !providerKey) {
      return res.status(400).json({ error: 'category and providerKey required' });
    }
    const result = await saveProviderSelection(req.params.propertyId, category, providerKey);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CHANNELS ───────────────────────────────────────────
router.get('/channels/:propertyId', requireAuth, async (req, res) => {
  try {
    const channels = await getPropertyChannels(req.params.propertyId);
    res.json({ channels });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/channels/:propertyId/:channelKey', requireAuth, async (req, res) => {
  try {
    const result = await saveChannelConfig(req.params.propertyId, req.params.channelKey, req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/channels/:propertyId/:channelKey/ping', requireAuth, async (req, res) => {
  try {
    const result = await pingChannel(req.params.propertyId, req.params.channelKey);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── UNIFIED INBOX ──────────────────────────────────────
router.get('/channels/:propertyId/inbox', requireAuth, async (req, res) => {
  try {
    const { channel, limit } = req.query;
    const messages = await getUnifiedInbox(req.params.propertyId, {
      limit: parseInt(limit) || 50,
      channelKey: channel || null,
    });
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
