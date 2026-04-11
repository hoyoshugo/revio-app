/**
 * System Health — estado consolidado de backend, BD, crons, webhooks.
 * Usado por el Monitor (página /health del dashboard del cliente).
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';

const router = Router();

const START_TIME = Date.now();

// GET /api/system/health
router.get('/health', requireAuth, async (_req, res) => {
  const uptimeSec = Math.floor(process.uptime());

  // Chequeo rápido de BD
  let dbStatus = 'up';
  let dbTables = null;
  try {
    const r = await supabase.from('tenants').select('id', { count: 'exact', head: true });
    if (r.error) dbStatus = 'error';
    dbTables = 'ok';
  } catch {
    dbStatus = 'error';
  }

  // Webhook Meta: consideramos "pending" si no está verificado
  const webhookStatus = process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN
    ? 'configured'
    : 'pending';

  // Crons — lectura best-effort de timestamps conocidos
  const crons = {
    ical: {
      schedule: 'cada 15 min',
      last_run: null,
      status: 'scheduled',
    },
    currency: {
      schedule: 'cada 2h',
      last_run: null,
      status: 'scheduled',
    },
    audit: {
      schedule: 'domingos 08:00 Bogotá',
      next_run: null,
      status: 'scheduled',
    },
  };

  // Intentar leer última ejecución de currency_rates
  try {
    const { data } = await supabase
      .from('currency_rates')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1);
    if (data?.[0]) crons.currency.last_run = data[0].fetched_at;
  } catch {}

  // Last iCal sync
  try {
    const { data } = await supabase
      .from('property_channels')
      .select('last_sync_at')
      .not('last_sync_at', 'is', null)
      .order('last_sync_at', { ascending: false })
      .limit(1);
    if (data?.[0]) crons.ical.last_run = data[0].last_sync_at;
  } catch {}

  res.json({
    backend: {
      status: 'up',
      uptime_sec: uptimeSec,
      uptime_human: humanUptime(uptimeSec),
      started_at: new Date(START_TIME).toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    database: {
      status: dbStatus,
      tables: dbTables,
    },
    webhook: {
      status: webhookStatus,
      url: '/api/webhooks/meta',
    },
    crons,
  });
});

// GET /api/system/audit-log
router.get('/audit-log', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const { data } = await supabase
      .from('platform_audits')
      .select('*')
      .order('audited_at', { ascending: false })
      .limit(limit);
    res.json({ events: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function humanUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default router;
