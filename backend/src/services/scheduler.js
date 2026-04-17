import cron from 'node-cron';
import { processPendingCommunications, updateOccupancyCache } from './automations.js';
import { detectNoShows } from './noShows.js';
import { pollAllOtaMessages } from '../integrations/otaHub.js';
import { runHealthChecks } from './healthMonitor.js';
import { runAccessControlCheck } from './accessControl.js';
import { db } from '../models/supabase.js';

export function startScheduler() {
  console.log('[Scheduler] Iniciando tareas programadas...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await processPendingCommunications();
      if (result.processed > 0) {
        console.log(`[Scheduler] Comunicaciones: ${result.processed} enviadas, ${result.errors} errores`);
      }
    } catch (err) {
      console.error('[Scheduler] Error en comunicaciones:', err.message);
    }
  });

  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Scheduler] Actualizando cache de ocupacion...');
      await updateOccupancyCache();
    } catch (err) {
      console.error('[Scheduler] Error actualizando ocupacion:', err.message);
    }
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await detectNoShows();
      if (result.detected > 0) {
        console.log(`[Scheduler] No-shows detectados/procesados: ${result.detected}`);
      }
    } catch (err) {
      console.error('[Scheduler] Error procesando no-shows:', err.message);
    }
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      const properties = await db.getAllProperties();
      const newMessages = await pollAllOtaMessages(properties);
      if (newMessages > 0) {
        console.log(`[Scheduler] OTA Poll: ${newMessages} nuevos mensajes procesados`);
      }
    } catch (err) {
      console.error('[Scheduler] Error en poll OTA:', err.message);
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    try {
      await runHealthChecks();
    } catch (err) {
      console.error('[Scheduler] Error en health checks:', err.message);
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    try {
      const properties = await db.getAllProperties();
      const { default: googleBusiness } = await import('../integrations/googleBusiness.js');
      const { default: tripadvisor } = await import('../integrations/tripadvisor.js');
      const { processIncomingOtaMessage } = await import('../integrations/otaHub.js');
      const { supabase } = await import('../models/supabase.js');

      for (const prop of properties) {
        if (await googleBusiness.CONFIGURED(prop.id)) {
          const msgs = await googleBusiness.getUnreadMessages(prop.id);
          for (const msg of msgs) {
            const { data: ex } = await supabase.from('ota_messages').select('id').eq('platform_message_id', msg.platform_message_id).single();
            if (!ex) await processIncomingOtaMessage('google', msg, prop.slug, prop.id);
          }
        }
        if (tripadvisor.CONFIGURED(prop.slug)) {
          const msgs = await tripadvisor.getUnreadMessages(prop.slug);
          for (const msg of msgs) {
            const { data: ex } = await supabase.from('ota_messages').select('id').eq('platform_message_id', msg.platform_message_id).single();
            if (!ex) await processIncomingOtaMessage('tripadvisor', msg, prop.slug, prop.id);
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error en poll social:', err.message);
    }
  });

  cron.schedule('0 */6 * * *', async () => {
    try {
      const result = await runAccessControlCheck();
      if (result.suspended > 0 || result.reactivated > 0 || result.warned > 0) {
        console.log(`[Scheduler] AccessControl: ${result.suspended} suspendidos, ${result.reactivated} reactivados, ${result.warned} alertados`);
      }
    } catch (err) {
      console.error('[Scheduler] Error en access control:', err.message);
    }
  });

  console.log('[Scheduler] Tareas activas:');
  console.log('  - Comunicaciones: cada 5 min');
  console.log('  - Health Monitor: cada 5 min');
  console.log('  - Ocupacion: cada hora');
  console.log('  - No-shows: cada 15 min (13:00-22:00)');
  console.log('  - OTA Poll: cada 10 min');
  console.log('  - Social Poll (Google/TripAdvisor): cada 30 min');
  console.log('  - Access Control (pagos): cada 6 horas');
}
