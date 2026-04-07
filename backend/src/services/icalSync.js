// backend/src/services/icalSync.js
// Pipeline de sincronizacion OTA via iCal -> Supabase -> GanttCalendar
// Soporta Booking.com, Airbnb, Hostelworld y cualquier fuente iCal estandar

import { supabase } from '../models/supabase.js'

/**
 * Parsea un string iCal y retorna array de reservas normalizadas
 */
function parseICal(icalText, propertyId, channelName) {
    const events = icalText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []

    return events.map(event => {
        const uid     = event.match(/UID:([^\r\n]+)/)?.[1]?.trim()
        const dtstart = event.match(/DTSTART[;:]([^\r\n]+)/)?.[1]
        const dtend   = event.match(/DTEND[;:]([^\r\n]+)/)?.[1]
        const summary = event.match(/SUMMARY:([^\r\n]+)/)?.[1]?.trim() || ''

        const parseDate = (str) => {
            if (!str) return null
            const d = str.replace(/[^0-9]/g, '').slice(0, 8)
            return d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null
        }

        const isBlock = summary.includes('Not available') ||
                        summary.includes('CLOSED') ||
                        summary.includes('Blocked') ||
                        summary.includes('Airbnb (Not')

        let guestName = 'Huesped OTA'
        if (!isBlock) {
            if (channelName === 'booking') {
                guestName = summary.replace(/^CLOSED\s*-?\s*/i, '').trim() || 'Huesped Booking'
            } else if (channelName === 'airbnb') {
                guestName = summary.replace(/^Reserved\s*/i, '').trim() || 'Huesped Airbnb'
            } else {
                guestName = summary || 'Huesped OTA'
            }
        }

        return {
            channel:      channelName,
            channel_ref:  uid,
            guest_name:   isBlock ? 'Bloqueado' : guestName,
            check_in:     parseDate(dtstart),
            check_out:    parseDate(dtend),
            status:       isBlock ? 'blocked' : 'confirmed',
            source:       `ota_${channelName}`,
            property_id:  propertyId,
        }
    }).filter(r => r.check_in && r.check_out && r.channel_ref)
}

/**
 * Descarga un iCal y retorna las reservas parseadas
 */
async function fetchICal(url, propertyId, channelName) {
    if (!url || url === 'pendiente' || url.trim() === '') {
        console.log(JSON.stringify({
            level: 'warn', event: 'ical_url_not_configured',
            channel: channelName, property_id: propertyId,
        }))
        return []
    }

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Revio PMS Calendar Sync/1.0' },
            signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const text = await response.text()
        return parseICal(text, propertyId, channelName)
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', event: 'ical_fetch_failed',
            channel: channelName, property_id: propertyId, error: err.message,
        }))
        return []
    }
}

/**
 * Upsert idempotente por channel_ref + property_id
 */
async function upsertReservations(reservations, channelName, propertyId) {
    if (!reservations.length) return 0

    const { error } = await supabase
        .from('reservations')
        .upsert(reservations, { onConflict: 'channel_ref,property_id', ignoreDuplicates: false })
        .select('id')

    if (error) {
        console.error(JSON.stringify({
            level: 'error', event: 'ical_upsert_failed',
            channel: channelName, property_id: propertyId, error: error.message,
        }))
        return 0
    }

    console.log(JSON.stringify({
        level: 'info', event: 'ical_sync_ok',
        channel: channelName, property_id: propertyId, count: reservations.length,
    }))
    return reservations.length
}

/**
 * Sincroniza todas las fuentes iCal configuradas para una propiedad
 */
export async function syncPropertyICal(propertySlug, propertyId) {
    const slugUpper = propertySlug.toUpperCase().replace(/-/g, '_')
    const sources = [
        { channel: 'booking',     url: process.env[`BOOKING_ICAL_URL_${slugUpper}`]     || process.env.BOOKING_ICAL_URL },
        { channel: 'airbnb',      url: process.env[`AIRBNB_ICAL_URL_${slugUpper}`]      || process.env.AIRBNB_ICAL_URL },
        { channel: 'hostelworld', url: process.env[`HOSTELWORLD_ICAL_URL_${slugUpper}`] || process.env.HOSTELWORLD_ICAL_URL },
    ]

    const results = []
    for (const source of sources) {
        if (!source.url) continue
        const reservations = await fetchICal(source.url, propertyId, source.channel)
        const synced = await upsertReservations(reservations, source.channel, propertyId)
        results.push({ channel: source.channel, synced })
    }

    return results
}

/**
 * Sincroniza todas las propiedades activas
 */
export async function syncAllProperties() {
    const { data: properties, error } = await supabase
        .from('properties')
        .select('id, name, slug')
        .eq('is_active', true)

    if (error || !Array.isArray(properties)) {
        console.error(JSON.stringify({
            level: 'error', event: 'sync_all_failed', error: error?.message,
        }))
        return []
    }

    const allResults = []
    for (const property of properties) {
        const results = await syncPropertyICal(property.slug, property.id)
        allResults.push({ property: property.slug, results })
    }

    console.log(JSON.stringify({
        level: 'info', event: 'ical_sync_all_completed', properties: properties.length,
    }))
    return allResults
}
