/**
 * PricingEngine — Dynamic rate calculation service
 *
 * Applies pricing modifiers in order:
 *   base rate → season → day-of-week → occupancy → channel markup →
 *   advance booking → length-of-stay → manual overrides
 *
 * All amounts in COP.
 */

import { supabase } from '../models/supabase.js';

// ── Cache (Map with 5-min TTL per property) ─────────────────────
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function clearPricingCache(propertyId) {
  for (const k of cache.keys()) {
    if (k.startsWith(propertyId)) cache.delete(k);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function toDate(d) {
  return typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
}

function daysBetween(a, b) {
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ── Data loaders (with per-property cache) ──────────────────────

async function loadSeasons(propertyId) {
  const key = `${propertyId}:seasons`;
  const cached = getCached(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('property_id', propertyId);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  setCache(key, rows);
  return rows;
}

async function loadDowRules(propertyId) {
  const key = `${propertyId}:dow`;
  const cached = getCached(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('day_of_week_rules')
    .select('*')
    .eq('property_id', propertyId);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  setCache(key, rows);
  return rows;
}

async function loadOccupancyRules(propertyId) {
  const key = `${propertyId}:occ`;
  const cached = getCached(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('occupancy_rules')
    .select('*')
    .eq('property_id', propertyId)
    .order('min_pct');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  setCache(key, rows);
  return rows;
}

async function loadLosDiscounts(propertyId) {
  const key = `${propertyId}:los`;
  const cached = getCached(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('los_discounts')
    .select('*')
    .eq('property_id', propertyId)
    .order('min_nights', { ascending: false });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  setCache(key, rows);
  return rows;
}

async function loadPriceOverrides(propertyId, roomTypeId, dateFrom, dateTo) {
  const { data, error } = await supabase
    .from('price_overrides')
    .select('*')
    .eq('property_id', propertyId)
    .eq('room_type_id', roomTypeId)
    .lte('date_from', dateTo)
    .gte('date_to', dateFrom);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadChannelMarkups(propertyId) {
  const key = `${propertyId}:channel`;
  const cached = getCached(key);
  if (cached) return cached;

  // Channel markups stored in rate_plans with type='ota' — extract markup_percent per channel
  const { data, error } = await supabase
    .from('rate_plans')
    .select('channels, markup_percent')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .in('type', ['ota', 'standard']);
  if (error) throw error;

  const markups = {};
  for (const plan of Array.isArray(data) ? data : []) {
    const pct = Number(plan.markup_percent) || 0;
    if (pct === 0) continue;
    const channels = Array.isArray(plan.channels) ? plan.channels : [];
    for (const ch of channels) {
      if (ch !== 'all' && ch !== 'direct') {
        markups[ch] = Math.max(markups[ch] || 0, pct);
      }
    }
  }
  setCache(key, markups);
  return markups;
}

// ── Occupancy calculator ────────────────────────────────────────

async function getOccupancyPercent(propertyId, date) {
  const ds = dateStr(date);

  // Total rooms
  const { count: totalRooms } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('is_active', true);

  if (!totalRooms || totalRooms === 0) return 0;

  // Occupied rooms (reservations overlapping date)
  const { count: occupied } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .in('status', ['confirmed', 'checked_in'])
    .lte('check_in', ds)
    .gt('check_out', ds);

  return Math.round(((occupied || 0) / totalRooms) * 100);
}

// ── Default occupancy tiers (fallback when no DB rules) ─────────

const DEFAULT_OCC_TIERS = [
  { min_pct: 90, max_pct: 100, multiplier: 1.40 },
  { min_pct: 75, max_pct: 89,  multiplier: 1.25 },
  { min_pct: 50, max_pct: 74,  multiplier: 1.15 },
  { min_pct: 0,  max_pct: 49,  multiplier: 1.00 },
];

// ── Base rate resolver ──────────────────────────────────────────

async function getBaseRate(propertyId, roomTypeId) {
  // 1) Try rate_plans standard
  const { data: plans } = await supabase
    .from('rate_plans')
    .select('base_rate')
    .eq('property_id', propertyId)
    .eq('type', 'standard')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (plans?.base_rate) return Number(plans.base_rate);

  // 2) Fallback to room_type base_price
  if (roomTypeId) {
    const { data: rt } = await supabase
      .from('room_types')
      .select('base_price')
      .eq('id', roomTypeId)
      .single();
    if (rt?.base_price) return Number(rt.base_price);
  }

  return 0;
}

// ── MAIN: calculateDynamicRate ──────────────────────────────────

/**
 * @param {Object} params
 * @param {string} params.propertyId   - UUID
 * @param {string} params.roomTypeId   - UUID (optional)
 * @param {string} params.checkIn      - YYYY-MM-DD
 * @param {string} params.checkOut     - YYYY-MM-DD
 * @param {string} [params.channel='direct']
 * @param {number} [params.numGuests=1]
 * @returns {Promise<Object>} { nights, perNight: [...], total, currency, breakdown }
 */
export async function calculateDynamicRate({
  propertyId,
  roomTypeId,
  checkIn,
  checkOut,
  channel = 'direct',
  numGuests = 1,
}) {
  const ciDate = toDate(checkIn);
  const coDate = toDate(checkOut);
  const nights = daysBetween(ciDate, coDate);
  const today = new Date();
  const daysInAdvance = daysBetween(today, ciDate);

  // Load all data in parallel
  const [
    baseRate,
    seasons,
    dowRules,
    occRulesDb,
    losDiscounts,
    channelMarkups,
    overrides,
  ] = await Promise.all([
    getBaseRate(propertyId, roomTypeId),
    loadSeasons(propertyId),
    loadDowRules(propertyId),
    loadOccupancyRules(propertyId),
    loadLosDiscounts(propertyId),
    loadChannelMarkups(propertyId),
    roomTypeId
      ? loadPriceOverrides(propertyId, roomTypeId, dateStr(ciDate), dateStr(coDate))
      : Promise.resolve([]),
  ]);

  const occRules = occRulesDb.length > 0 ? occRulesDb : DEFAULT_OCC_TIERS;

  // Build override map (date → price)
  const overrideMap = {};
  for (const ov of overrides) {
    const from = toDate(ov.date_from);
    const to = toDate(ov.date_to);
    const d = new Date(from);
    while (d <= to) {
      overrideMap[dateStr(d)] = Number(ov.price);
      d.setDate(d.getDate() + 1);
    }
  }

  // Build DOW map
  const dowMap = {};
  for (const r of dowRules) {
    dowMap[r.day_of_week] = Number(r.multiplier) || 1.0;
  }

  // ── Per-night calculation ─────────────────────────────────────
  const perNight = [];
  let runningTotal = 0;

  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(ciDate);
    nightDate.setDate(nightDate.getDate() + i);
    const ds = dateStr(nightDate);
    const dow = nightDate.getDay(); // 0=Sun ... 6=Sat

    const breakdown = {
      date: ds,
      base: baseRate,
      seasonMultiplier: 1.0,
      seasonName: null,
      dowMultiplier: 1.0,
      occupancyMultiplier: 1.0,
      occupancyPct: null,
      channelMarkupPct: 0,
      advanceAdjustPct: 0,
      losDiscountPct: 0,
      manualOverride: null,
      finalRate: 0,
    };

    let rate = baseRate;

    // 1) Manual override takes priority for this date
    if (overrideMap[ds] !== undefined) {
      breakdown.manualOverride = overrideMap[ds];
      breakdown.finalRate = overrideMap[ds];
      perNight.push(breakdown);
      runningTotal += breakdown.finalRate;
      continue;
    }

    // 2) Season multiplier
    for (const s of seasons) {
      const sStart = toDate(s.start_date);
      const sEnd = toDate(s.end_date);
      if (nightDate >= sStart && nightDate <= sEnd) {
        breakdown.seasonMultiplier = Number(s.multiplier) || 1.0;
        breakdown.seasonName = s.name;
        break; // first match wins
      }
    }
    rate *= breakdown.seasonMultiplier;

    // 3) Day-of-week multiplier
    breakdown.dowMultiplier = dowMap[dow] || 1.0;
    rate *= breakdown.dowMultiplier;

    // 4) Occupancy adjustment
    const occPct = await getOccupancyPercent(propertyId, nightDate);
    breakdown.occupancyPct = occPct;
    for (const tier of occRules) {
      const minP = Number(tier.min_pct);
      const maxP = Number(tier.max_pct);
      if (occPct >= minP && occPct <= maxP) {
        breakdown.occupancyMultiplier = Number(tier.multiplier) || 1.0;
        break;
      }
    }
    rate *= breakdown.occupancyMultiplier;

    // 5) Channel markup
    if (channel !== 'direct' && channelMarkups[channel]) {
      breakdown.channelMarkupPct = channelMarkups[channel];
      rate *= 1 + breakdown.channelMarkupPct / 100;
    }

    // 6) Advance booking adjustment
    if (daysInAdvance > 30) {
      breakdown.advanceAdjustPct = -10;
    } else if (daysInAdvance < 3) {
      breakdown.advanceAdjustPct = 20;
    }
    if (breakdown.advanceAdjustPct !== 0) {
      rate *= 1 + breakdown.advanceAdjustPct / 100;
    }

    // 7) Length-of-stay discount (applied to each night)
    for (const ld of losDiscounts) {
      if (nights >= Number(ld.min_nights)) {
        breakdown.losDiscountPct = Number(ld.discount_pct);
        break; // sorted desc, first match = best
      }
    }
    // Default LOS if no DB rules
    if (breakdown.losDiscountPct === 0 && losDiscounts.length === 0) {
      if (nights >= 7) breakdown.losDiscountPct = 15;
      else if (nights >= 3) breakdown.losDiscountPct = 5;
    }
    if (breakdown.losDiscountPct > 0) {
      rate *= 1 - breakdown.losDiscountPct / 100;
    }

    breakdown.finalRate = Math.round(rate);
    perNight.push(breakdown);
    runningTotal += breakdown.finalRate;
  }

  // ── Aggregate breakdown ───────────────────────────────────────
  const avgSeason = perNight.reduce((s, n) => s + n.seasonMultiplier, 0) / nights;
  const avgDow = perNight.reduce((s, n) => s + n.dowMultiplier, 0) / nights;
  const avgOcc = perNight.reduce((s, n) => s + n.occupancyMultiplier, 0) / nights;

  return {
    nights,
    perNight,
    total: runningTotal,
    currency: 'COP',
    channel,
    breakdown: {
      baseRate,
      avgSeasonMultiplier: Math.round(avgSeason * 100) / 100,
      avgDowMultiplier: Math.round(avgDow * 100) / 100,
      avgOccupancyMultiplier: Math.round(avgOcc * 100) / 100,
      channelMarkupPct: perNight[0]?.channelMarkupPct || 0,
      advanceAdjustPct: perNight[0]?.advanceAdjustPct || 0,
      losDiscountPct: perNight[0]?.losDiscountPct || 0,
      daysInAdvance,
      numGuests,
    },
  };
}

export default { calculateDynamicRate, clearPricingCache };
