// backend/src/services/icalSync.js
// Pipeline de sincronización OTA via iCal → Supabase → GanttCalendar
// Soporta Booking.com, Airbnb, Hostelworld y cualquier fuente iCal estándar.
//
// ARQUITECTURA MULTITENANT:
// Las URLs iCal se leen desde la tabla `settings` por property_id usando la
// key `ota_ical_urls` con shape:
//   { booking_url, airbnb_url, hostelworld_url, vrbo_url, expedia_url }
// Cero credenciales en .env. Cero redeploy para agregar/quitar OTAs.

import { supabase } from '../models/supabase.js';
import { getSetting } from './connectionService.js';

/**
 * Parsea un texto iCal estándar (RFC 5545) y devuelve reservas normalizadas.
 */
function parseICal(icalText, propertyId, channelName) {
  const events = icalText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  return events.map(event => {
    const uid     = event.match(/UID:([^\r\n]+)/)?.[1]?.trim();
    const dtstart = event.match(/DTSTART[;:]([^\r\n]+)/)?.[1];
    const dtend   = event.match(/DTEND[;:]([^\r\n]+)/)?.[1];
    const summary = event.match(/SUMMARY:([^\r\n]+)/)?.[1]?.trim() || '';
    const description = event.match(/DESCRIPTION:([^\r\n]+)/)?.[1]?.trim() || '';

    const parseDate = (str) => {
      if (!str) return null;
      const d = str.replace(/[^0-9]/g, '').slice(0, 8);
      return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null;
    };

    const isBlock = /not available|closed|blocked|airbnb \(not/i.test(summary);

    let guestName = 'Huésped OTA';
    if (!isBlock) {
      if (channelName === 'booking') {
        guestName = summary.replace(/^closed\s*-?\s*/i, '').trim() || 'Huésped Booking';
      } else if (channelName === 'airbnb') {
        guestName = summary.replace(/^reserved\s*/i, '').trim() || 'Huésped Airbnb';
      } else {
        guestName = summary || `Huésped ${channelName}`;
      }
    }

    return {
      property_id:    propertyId,
      check_in:       parseDate(dtstart),
      check_out:      parseDate(dtend),
      status:         isBlock ? 'blocked' : 'confirmed',
      source:         `ota_${channelName}`,
      channel_ref:    uid,
      internal_notes: isBlock
        ? `[OTA Block ${channelName}]`
        : `[${channelName.toUpperCase()}] ${guestName}${description ? '\n' + description : ''}`,
    };
  }).filter(r => r.check_in && r.check_out && r.channel_ref);
}

/**
 * Descarga un iCal y devuelve las reservas parseadas.
 */
async function fetchICal(url, propertyId, channelName) {
  if (!url || url === 'pendiente' || url.trim() === '') {
    return { reservations: [], error: 'url_not_configured' };
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Revio PMS Calendar Sync/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { reservations: [], error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return { reservations: [], error: 'not_an_ical_file' };
    }

    return { reservations: parseICal(text, propertyId, channelName), error: null };
  } catch (err) {
    return { reservations: [], error: err.message };
  }
}

/**
 * Upsert manual: SELECT por (property_id, channel_ref), UPDATE si existe, INSERT si no.
 * Evita necesitar UNIQUE constraint en la tabla `reservations`.
 */
async function upsertReservations(reservations, channelName, propertyId) {
  if (!reservations.length) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  for (const r of reservations) {
    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('property_id', propertyId)
      .eq('channel_ref', r.channel_ref)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('reservations')
        .update({
          check_in: r.check_in,
          check_out: r.check_out,
          status: r.status,
          internal_notes: r.internal_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) errors++; else synced++;
    } else {
      const { error } = await supabase.from('reservations').insert(r);
      if (error) errors++; else synced++;
    }
  }

  console.log(JSON.stringify({
    level: 'info', event: 'ical_sync_ok',
    channel: channelName, property_id: propertyId, synced, errors,
  }));
  return { synced, errors };
}

/**
 * Sincroniza una propiedad leyendo sus URLs iCal de la tabla settings.
 */
export async function syncPropertyICal(propertySlug, propertyId) {
  // Lee del setting `ota_ical_urls` (shape JSON)
  const icalUrls = await getSetting(propertyId, 'ota_ical_urls') || {};

  const sources = [
    { channel: 'booking',     url: icalUrls.booking_url },
    { channel: 'airbnb',      url: icalUrls.airbnb_url },
    { channel: 'hostelworld', url: icalUrls.hostelworld_url },
    { channel: 'vrbo',        url: icalUrls.vrbo_url },
    { channel: 'expedia',     url: icalUrls.expedia_url },
  ].filter(s => s.url && s.url.trim() !== '');

  if (sources.length === 0) {
    return [];
  }

  const results = [];
  for (const source of sources) {
    const { reservations, error } = await fetchICal(source.url, propertyId, source.channel);
    if (error) {
      console.error(JSON.stringify({
        level: 'error', event: 'ical_fetch_failed',
        channel: source.channel, property_id: propertyId, error,
      }));
      results.push({ channel: source.channel, synced: 0, error });
      continue;
    }
    const { synced, errors } = await upsertReservations(reservations, source.channel, propertyId);
    results.push({ channel: source.channel, synced, errors });
  }

  return results;
}

/**
 * Sincroniza todas las propiedades activas.
 */
export async function syncAllProperties() {
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, name, slug')
    .eq('is_active', true);

  if (error || !Array.isArray(properties)) {
    console.error(JSON.stringify({
      level: 'error', event: 'sync_all_failed', error: error?.message,
    }));
    return [];
  }

  const allResults = [];
  for (const property of properties) {
    const results = await syncPropertyICal(property.slug, property.id);
    allResults.push({ property: property.slug, results });
  }

  console.log(JSON.stringify({
    level: 'info', event: 'ical_sync_all_completed',
    properties: properties.length,
  }));
  return allResults;
}

/**
 * Test rápido de una URL iCal sin escribir nada en BD.
 * Usado por el endpoint /api/connections/:propertyId/test.
 */
export async function testICalUrl(url, channelName = 'test') {
  const { reservations, error } = await fetchICal(url, 'test-property', channelName);
  if (error) return { success: false, error, count: 0 };
  return { success: true, count: reservations.length, sample: reservations.slice(0, 2) };
}
