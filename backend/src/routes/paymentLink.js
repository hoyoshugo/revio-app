import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendPaymentLinkToGuest } from '../services/paymentLinkDelivery.js';

const router = Router();

// POST /api/payment-link/send — genera link y lo envía por WhatsApp + email
router.post('/send', requireAuth, async (req, res) => {
  try {
    const result = await sendPaymentLinkToGuest(req.body);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
