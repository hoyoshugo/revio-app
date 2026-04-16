/**
 * Channel Sync Service — bidirectional channel manager sync engine
 *
 * Handles:
 *  · Push availability to channels (logged)
 *  · Pull reservations from channels (stub)
 *  · iCal generation & parsing
 *  · Rate sync (logged)
 *  · Conflict detection (overlapping reservations)
 */
import { supabase } from '../models/supabase.js';

// ── HELPERS ────────────────────────────────────────────────

function formatDate(d) {
  // YYYYMMDD for iCal
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function nowISO() {
  return new Date().toISOString();
}

async function logSync(propertyId, channelKey, action, direction, status, payload = null, errorMessage = null) {
  try {
    const { data, error } = await supabase.from('channel_sync_log').insert({
      property_id: propertyId,
      channel_key: channelKey,
      action,
      direction,
      status,
      payload: payload || {},
      error_message: errorMessage,
    }).select().single();
    if (error) console.error('[channelSync] logSync insert error:', error.message);
    return data;
  } catch (e) {
    console.error('[channelSync] logSync exception:', e.message);
    return null;
  }
}

// ── PUSH AVAILABILITY ──────────────────────────────────────

/**
 * Push availability for a room type to all connected channels.
 * In production this would call each channel's API; for now it logs the intent.
 */
export async function pushAvailability(propertyId, roomTypeId, dateFrom, dateTo) {
  try {
    // Gather current availability
    const { data: roomType, error: rtErr } = await supabase
      .from('room_types')
      .select('id, name, total_rooms, base_price')
      .eq('id', roomTypeId)
      .eq('property_id', propertyId)
      .single();

    if (rtErr || !roomType) {
      await logSync(propertyId, '*', 'push_availability', 'push', 'error', { roomTypeId, dateFrom, dateTo }, rtErr?.message || 'room_type not found');
      return { success: false, error: 'room_type not found' };
    }

    // Count occupied rooms per date
    const { data: reservations } = await supabase
      .from('reservations')
      .select('check_in, check_out')
      .eq('property_id', propertyId)
      .eq('room_type_id', roomTypeId)
      .neq('status', 'cancelled')
      .gte('check_out', dateFrom)
      .lte('check_in', dateTo);

    // Get connected OTA channels
    const { data: channels } = await supabase
      .from('property_channels')
      .select('channel_key')
      .eq('property_id', propertyId)
      .eq('channel_type', 'ota')
      .eq('can_sync_calendar', true);

    const payload = {
      roomTypeId,
      roomTypeName: roomType.name,
      dateFrom,
      dateTo,
      totalRooms: roomType.total_rooms || 1,
      reservationCount: Array.isArray(reservations) ? reservations.length : 0,
      targetChannels: Array.isArray(channels) ? channels.map(c => c.channel_key) : [],
    };

    // Log for each channel
    const channelList = Array.isArray(channels) ? channels : [];
    for (const ch of channelList) {
      await logSync(propertyId, ch.channel_key, 'push_availability', 'push', 'success', payload);
    }

    // Also log a summary entry
    if (channelList.length === 0) {
      await logSync(propertyId, '*', 'push_availability', 'push', 'success', { ...payload, note: 'no_connected_channels' });
    }

    return { success: true, channels: channelList.length, payload };
  } catch (e) {
    await logSync(propertyId, '*', 'push_availability', 'push', 'error', { roomTypeId, dateFrom, dateTo }, e.message);
    return { success: false, error: e.message };
  }
}

// ── PULL RESERVATIONS ──────────────────────────────────────

/**
 * Pull reservations from an external channel.
 * Stub — logs the pull attempt and returns empty array.
 * In production this would call the channel's API or fetch iCal.
 */
export async function pullReservations(propertyId, channelKey) {
  try {
    await logSync(propertyId, channelKey, 'pull_reservations', 'pull', 'success', {
      note: 'stub — no external API call yet',
      timestamp: nowISO(),
    });
    return [];
  } catch (e) {
    await logSync(propertyId, channelKey, 'pull_reservations', 'pull', 'error', null, e.message);
    return [];
  }
}

// ── ICAL GENERATION ────────────────────────────────────────

/**
 * Generate a VCALENDAR string from reservations for a given room type.
 */
export async function generateIcal(propertyId, roomTypeId) {
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, check_in, check_out, guest_name, status')
    .eq('property_id', propertyId)
    .eq('room_type_id', roomTypeId)
    .neq('status', 'cancelled')
    .order('check_in');

  const { data: roomType } = await supabase
    .from('room_types')
    .select('name')
    .eq('id', roomTypeId)
    .maybeSingle();

  const rtName = roomType?.name || 'Room';
  const rows = Array.isArray(reservations) ? reservations : [];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Revio//Channel Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${rtName} — Revio`,
  ];

  for (const r of rows) {
    const dtStart = formatDate(new Date(r.check_in));
    const dtEnd = formatDate(new Date(r.check_out));
    const uid = `${r.id}@revio.co`;
    const summary = r.guest_name ? `Reserved — ${r.guest_name}` : 'Reserved';

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `UID:${uid}`,
      `SUMMARY:${summary}`,
      `STATUS:${r.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ── ICAL PARSING ───────────────────────────────────────────

/**
 * Parse a VCALENDAR text string into an array of events.
 * Returns: [{ start, end, summary, uid }]
 */
export function parseIcal(icalText) {
  if (!icalText || typeof icalText !== 'string') return [];

  const events = [];
  const blocks = icalText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const event = { start: null, end: null, summary: '', uid: '' };

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (line.startsWith('DTSTART')) {
        const val = line.split(':').pop();
        event.start = parseIcalDate(val);
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':').pop();
        event.end = parseIcalDate(val);
      } else if (line.startsWith('SUMMARY')) {
        event.summary = line.replace(/^SUMMARY[;:]/, '').trim();
      } else if (line.startsWith('UID')) {
        event.uid = line.replace(/^UID[;:]/, '').trim();
      }
    }

    if (event.start) {
      events.push(event);
    }
  }

  return events;
}

function parseIcalDate(val) {
  if (!val) return null;
  // Handle YYYYMMDD or YYYYMMDDTHHmmssZ
  const clean = val.replace(/[^0-9T]/g, '');
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return null;
}

// ── SYNC RATES ─────────────────────────────────────────────

/**
 * Push rates to channels — logs the rate push intent.
 * Does NOT touch ratePlans.js or pricingEngine.js.
 */
export async function syncRates(propertyId, roomTypeId, rates) {
  try {
    // rates expected: [{ channelKey, dateFrom, dateTo, rate }]
    const rateArray = Array.isArray(rates) ? rates : [];

    for (const r of rateArray) {
      // Upsert to channel_rate_overrides
      await supabase.from('channel_rate_overrides').upsert({
        property_id: propertyId,
        room_type_id: roomTypeId,
        channel_key: r.channelKey || r.channel_key,
        date_from: r.dateFrom || r.date_from,
        date_to: r.dateTo || r.date_to,
        rate: r.rate,
      }, { onConflict: 'property_id,room_type_id,channel_key,date_from' });

      await logSync(propertyId, r.channelKey || r.channel_key, 'sync_rates', 'push', 'success', {
        roomTypeId,
        dateFrom: r.dateFrom || r.date_from,
        dateTo: r.dateTo || r.date_to,
        rate: r.rate,
      });
    }

    return { success: true, count: rateArray.length };
  } catch (e) {
    await logSync(propertyId, '*', 'sync_rates', 'push', 'error', { roomTypeId }, e.message);
    return { success: false, error: e.message };
  }
}

// ── CONFLICT DETECTION ─────────────────────────────────────

/**
 * Detect overlapping reservations for a property within a date range.
 * Returns conflicts grouped by room_type_id.
 */
export async function detectConflicts(propertyId, dateFrom, dateTo) {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, room_type_id, room_id, check_in, check_out, guest_name, status, source')
      .eq('property_id', propertyId)
      .neq('status', 'cancelled')
      .gte('check_out', dateFrom)
      .lte('check_in', dateTo)
      .order('check_in');

    if (error) throw error;

    const rows = Array.isArray(reservations) ? reservations : [];
    const conflicts = [];

    // Compare every pair for overlaps within the same room
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];

        // Same room (either by room_id or room_type_id if no room assigned)
        const sameRoom = a.room_id && b.room_id
          ? a.room_id === b.room_id
          : a.room_type_id === b.room_type_id;

        if (!sameRoom) continue;

        // Check date overlap: a.check_in < b.check_out && b.check_in < a.check_out
        if (a.check_in < b.check_out && b.check_in < a.check_out) {
          conflicts.push({
            reservation_a: { id: a.id, guest: a.guest_name, check_in: a.check_in, check_out: a.check_out, source: a.source },
            reservation_b: { id: b.id, guest: b.guest_name, check_in: b.check_in, check_out: b.check_out, source: b.source },
            room_type_id: a.room_type_id,
            room_id: a.room_id || b.room_id || null,
            overlap_start: a.check_in > b.check_in ? a.check_in : b.check_in,
            overlap_end: a.check_out < b.check_out ? a.check_out : b.check_out,
          });
        }
      }
    }

    return { success: true, conflicts, count: conflicts.length };
  } catch (e) {
    return { success: false, error: e.message, conflicts: [], count: 0 };
  }
}
