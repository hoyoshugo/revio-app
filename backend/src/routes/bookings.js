import { Router } from 'express';
import { db } from '../models/supabase.js';
import lobby from '../integrations/lobbyPMS.js';
import wompi from '../integrations/wompi.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/bookings — Listar reservas (dashboard)
router.get('/', requireAuth, async (req, res) => {
  const { property_id, property_slug, status, checkin_date, limit = 50 } = req.query;
  try {
    let pid = property_id;
    if (!pid && property_slug) {
      const prop = await db.getProperty(property_slug);
      pid = prop.id;
    }
    const bookings = await db.getBookingsByProperty(pid, { status, checkin_date, limit: parseInt(limit) });
    res.json({ bookings, total: bookings.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:id — Detalle de reserva
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await db.getBooking(req.params.id);
    res.json(booking);
  } catch (err) {
    res.status(404).json({ error: 'Reserva no encontrada' });
  }
});

// PATCH /api/bookings/:id/status — Actualizar estado
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status, internal_notes } = req.body;
  const validStatuses = ['pending', 'confirmed', 'paid', 'checked_in', 'checked_out', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${validStatuses.join(', ')}` });
  }

  try {
    const booking = await db.updateBooking(req.params.id, {
      status,
      ...(internal_notes && { internal_notes })
    });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/cancel — Cancelar reserva
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const { reason = 'Cancelado por administrador' } = req.body;
  try {
    const booking = await db.getBooking(req.params.id);

    // Cancelar en LobbyPMS si existe
    if (booking.lobby_booking_id && booking.properties?.slug) {
      try {
        await lobby.cancelBooking(booking.properties.slug, booking.lobby_booking_id, reason);
      } catch (err) {
        console.warn('[Bookings] Error cancelando en LobbyPMS:', err.message);
      }
    }

    const updated = await db.updateBooking(req.params.id, {
      status: 'cancelled',
      internal_notes: reason
    });

    res.json({ success: true, booking: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/resend-payment — Reenviar link de pago
router.post('/:id/resend-payment', requireAuth, async (req, res) => {
  try {
    const booking = await db.getBooking(req.params.id);
    const propertySlug = booking.properties?.slug;
    if (!propertySlug) return res.status(400).json({ error: 'Propiedad no encontrada' });

    const paymentInfo = await wompi.createPaymentLink(propertySlug, {
      ...booking,
      property_slug: propertySlug
    });

    res.json({ success: true, payment_link_url: paymentInfo.payment_link_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/today/summary — Resumen del día
router.get('/today/summary', requireAuth, async (req, res) => {
  const { property_id } = req.query;
  try {
    const today = new Date().toISOString().split('T')[0];
    const [checkins, checkouts] = await Promise.all([
      db.getBookingsByProperty(property_id, { checkin_date: today }),
      db.getBookingsByProperty(property_id, { checkin_date: today, status: 'checked_out' })
    ]);
    res.json({ checkins_today: checkins, checkouts_today: checkouts, date: today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
