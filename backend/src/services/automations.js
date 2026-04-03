import { db } from '../models/supabase.js';
import { sendNotification, templates } from '../integrations/whatsapp.js';
import lobby from '../integrations/lobbyPMS.js';

// ============================================================
// Procesar y enviar comunicaciones pendientes
// ============================================================
export async function processPendingCommunications() {
  let processed = 0;
  let errors = 0;

  try {
    const pending = await db.getPendingCommunications();
    console.log(`[Automations] Procesando ${pending.length} comunicaciones pendientes`);

    for (const comm of pending) {
      try {
        const booking = comm.bookings;
        const property = comm.properties;
        if (!booking || !property) continue;

        // Enriquecer datos del booking con info de la propiedad
        const enrichedBooking = {
          ...booking,
          property_name: property.name,
          property_slug: property.slug,
          how_to_get_url: property.how_to_get_url,
          maps_url: property.maps_url,
          whatsapp_number: property.whatsapp_number,
          booking_url: property.booking_url
        };

        const lang = 'es'; // TODO: leer del huésped via conversation
        let template;

        switch (comm.sequence_step) {
          case 'reminder_7d':
            template = templates.reminder7days(enrichedBooking, lang);
            break;
          case 'reminder_3d':
            template = templates.reminder3days(enrichedBooking, lang);
            break;
          case 'reminder_1d':
            template = templates.reminder1day(enrichedBooking, lang);
            break;
          case 'welcome_day':
            template = templates.welcomeDay(enrichedBooking, lang);
            break;
          case 'review_request':
            template = templates.reviewRequest(enrichedBooking, lang);
            break;
          case 'loyalty_offer':
            template = templates.loyaltyOffer(enrichedBooking, lang);
            break;
          default:
            console.warn(`[Automations] Paso desconocido: ${comm.sequence_step}`);
            continue;
        }

        const result = await sendNotification(enrichedBooking, template);
        await db.markCommunicationSent(comm.id, {
          success: !!(result.whatsapp?.success || result.email?.success),
          message_id: result.whatsapp?.message_id || result.email?.message_id,
          response: result,
          error: result.whatsapp?.error || result.email?.error
        });

        processed++;
      } catch (err) {
        errors++;
        console.error(`[Automations] Error en comunicación ${comm.id}:`, err.message);
        await db.markCommunicationSent(comm.id, { success: false, error: err.message });
      }
    }
  } catch (err) {
    console.error('[Automations] Error obteniendo comunicaciones:', err.message);
  }

  return { processed, errors };
}

// ============================================================
// Actualizar caché de ocupación para todas las propiedades
// ============================================================
export async function updateOccupancyCache() {
  const properties = await db.getAllProperties();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 30);

  for (const property of properties) {
    try {
      const occupancyData = await lobby.getDailyOccupancy(property.slug, {
        date: today.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0]
      });

      const entries = Array.isArray(occupancyData) ? occupancyData : [occupancyData];

      for (const entry of entries) {
        if (!entry?.date) continue;
        const { supabase } = await import('../models/supabase.js');
        await supabase.from('occupancy_cache').upsert({
          property_id: property.id,
          date: entry.date,
          occupancy_percentage: entry.occupancy_percentage || 0,
          available_rooms: entry.available_rooms || 0,
          total_rooms: entry.total_rooms || 0,
          fetched_at: new Date().toISOString()
        }, { onConflict: 'property_id,date' });
      }
    } catch (err) {
      console.warn(`[Automations] Error actualizando ocupación para ${property.slug}:`, err.message);
    }
  }
}

export default { processPendingCommunications, updateOccupancyCache };
