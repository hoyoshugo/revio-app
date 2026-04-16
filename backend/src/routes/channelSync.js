/**
 * Channel Sync Routes — bidirectional channel manager endpoints
 *
 * Protected:
 *   POST /api/dashboard/channel-sync/push           — push availability
 *   POST /api/dashboard/channel-sync/pull           — pull reservations
 *   POST /api/dashboard/channel-sync/import-ical    — import external iCal
 *   GET  /api/dashboard/channel-sync/log            — sync log with pagination
 *   POST /api/dashboard/channel-sync/detect-conflicts — conflict detection
 *
 * Public:
 *   GET  /api/channel-sync/ical/:propertyId/:roomTypeId.ics — iCal feed
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../models/supabase.js';
import {
  pushAvailability,
  pullReservations,
  generateIcal,
  parseIcal,
  syncRates,
  detectConflicts,
} from '../services/channelSync.js';

const router = Router();

// ── POST /push — trigger availability push ─────────────────
router.post('/dashboard/channel-sync/push', requireAuth, async (req, res) => {
  const propertyId = req.body.property_id || req.user.property_id;
  const { room_type_id, date_from, date_to } = req.body;

  if (!room_type_id || !date_from || !date_to) {
    return res.status(400).json({ error: 'room_type_id, date_from, and date_to are required' });
  }

  try {
    const result = await pushAvailability(propertyId, room_type_id, date_from, date_to);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /pull — trigger reservation pull ──────────────────
router.post('/dashboard/channel-sync/pull', requireAuth, async (req, res) => {
  const propertyId = req.body.property_id || req.user.property_id;
  const { channel_key } = req.body;

  if (!channel_key) {
    return res.status(400).json({ error: 'channel_key is required' });
  }

  try {
    const reservations = await pullReservations(propertyId, channel_key);
    res.json({ success: true, reservations, count: reservations.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ical/:propertyId/:roomTypeId.ics — PUBLIC iCal feed
router.get('/channel-sync/ical/:propertyId/:roomTypeId.ics', async (req, res) => {
  const { propertyId, roomTypeId } = req.params;

  if (!propertyId || !roomTypeId) {
    return res.status(400).send('Missing propertyId or roomTypeId');
  }

  try {
    const ical = await generateIcal(propertyId, roomTypeId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${roomTypeId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(ical);
  } catch (err) {
    res.status(500).send('Error generating iCal feed');
  }
});

// ── POST /import-ical — import external iCal ───────────────
router.post('/dashboard/channel-sync/import-ical', requireAuth, async (req, res) => {
  const propertyId = req.body.property_id || req.user.property_id;
  const { room_type_id, channel_key, ical_url, ical_text } = req.body;

  if (!room_type_id || !channel_key) {
    return res.status(400).json({ error: 'room_type_id and channel_key are required' });
  }

  if (!ical_url && !ical_text) {
    return res.status(400).json({ error: 'Provide either ical_url or ical_text' });
  }

  try {
    let text = ical_text;

    // If URL provided, fetch the iCal content
    if (ical_url && !text) {
      const response = await fetch(ical_url);
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch iCal from URL: HTTP ${response.status}` });
      }
      text = await response.text();
    }

    // Parse the iCal
    const events = parseIcal(text);

    // Save/update the feed URL in ical_feeds
    if (ical_url) {
      await supabase.from('ical_feeds').upsert({
        property_id: propertyId,
        room_type_id,
        channel_key,
        feed_url: ical_url,
        last_synced_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'property_id,room_type_id,channel_key' });
    }

    // Log the import
    await supabase.from('channel_sync_log').insert({
      property_id: propertyId,
      channel_key,
      action: 'import_ical',
      direction: 'pull',
      status: 'success',
      payload: {
        room_type_id,
        ical_url: ical_url || null,
        events_found: events.length,
        events_preview: events.slice(0, 5),
      },
    });

    res.json({
      success: true,
      events,
      count: events.length,
      feed_saved: !!ical_url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /log — sync history with pagination ────────────────
router.get('/dashboard/channel-sync/log', requireAuth, async (req, res) => {
  const propertyId = req.query.property_id || req.user.property_id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  // Optional filters
  const channelKey = req.query.channel_key || null;
  const direction = req.query.direction || null;
  const status = req.query.status || null;

  try {
    let query = supabase
      .from('channel_sync_log')
      .select('*', { count: 'exact' })
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (channelKey) query = query.eq('channel_key', channelKey);
    if (direction) query = query.eq('direction', direction);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /detect-conflicts — conflict detection ────────────
router.post('/dashboard/channel-sync/detect-conflicts', requireAuth, async (req, res) => {
  const propertyId = req.body.property_id || req.user.property_id;
  const { date_from, date_to } = req.body;

  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from and date_to are required' });
  }

  try {
    const result = await detectConflicts(propertyId, date_from, date_to);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
