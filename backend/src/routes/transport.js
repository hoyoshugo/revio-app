import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getRoutes,
  getSchedules,
  checkAvailability,
  getPartnerHotels,
  createTransportReservation,
  getTransportOptions,
  formatTransportForAgent,
} from '../integrations/transport/caribbeanTreasures.js';

const router = Router();

// Nota: las rutas GET son públicas por diseño — consumidas por el agente IA
// (hotelAgent.js) que no porta JWT. Solo /reserve requiere auth.

// GET /api/transport/routes
router.get('/routes', async (_req, res) => {
  res.json(await getRoutes());
});

// GET /api/transport/schedules?routeCode=CTG-ISL
router.get('/schedules', async (req, res) => {
  res.json(await getSchedules(req.query.routeCode));
});

// GET /api/transport/hotels
router.get('/hotels', async (_req, res) => {
  res.json(await getPartnerHotels());
});

// GET /api/transport/availability?routeId=...&date=...&passengers=...
router.get('/availability', async (req, res) => {
  const { routeId, date, passengers } = req.query;
  res.json(await checkAvailability(routeId, date, parseInt(passengers) || 1));
});

// GET /api/transport/options?origin=Cartagena&destination=Isla+Palma&date=2026-04-15&passengers=2
router.get('/options', async (req, res) => {
  const { origin, destination, date, passengers } = req.query;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin y destination son requeridos' });
  }
  const options = await getTransportOptions(origin, destination, date, parseInt(passengers) || 1);
  const formatted = formatTransportForAgent(options, origin, date);
  res.json({ options, formatted });
});

// POST /api/transport/reserve
router.post('/reserve', requireAuth, async (req, res) => {
  try {
    const result = await createTransportReservation(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
