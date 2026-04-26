/**
 * Control de Acceso por Pago — Verifica cada 24h si los tenants tienen el pago al día.
 * Si vence: desactiva el agente y notifica al cliente.
 * Si se registra pago: reactiva en < 5 minutos (el scheduler corre cada 5min).
 *
 * E-AGENT-1 (2026-04-26): notificaciones tenant-aware. Cero referencias literales
 * a "Mística" en strings hacia el cliente. La marca del producto es "Alzio";
 * el cliente puede ser cualquier hotel.
 */
import { supabase } from '../models/supabase.js';
import { sendWhatsAppMessage } from '../integrations/whatsapp.js';
import nodemailer from 'nodemailer';

const PRODUCT_NAME = 'Alzio';
const BILLING_URL = process.env.BILLING_URL || 'https://app.alzio.co/billing';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'soporte@alzio.co';
const FROM_DEFAULT = process.env.EMAIL_FROM || `Alzio <noreply@alzio.co>`;

// ============================================================
// Enviar notificación (WhatsApp + Email)
// ============================================================
async function notifyTenant(tenant, subject, waMsg, emailMsg) {
  // WhatsApp
  if (tenant.contact_phone) {
    try { await sendWhatsAppMessage(tenant.contact_phone, waMsg); } catch { /* continuar */ }
  }

  // Email
  if (tenant.contact_email && process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.gmail.com' || process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: FROM_DEFAULT,
        to: tenant.contact_email,
        subject,
        text: emailMsg
      });
    } catch { /* continuar */ }
  }
}

// ============================================================
// Verificar pagos y actualizar estados
// ============================================================
export async function runAccessControlCheck() {
  const now = new Date();
  const results = { suspended: 0, reactivated: 0, warned: 0 };

  try {
    // 1. Obtener todos los tenants activos/trial/overdue
    const { data: tenants } = await supabase
      .from('tenants')
      .select('*, tenant_plans(grace_period_days, price_monthly, name)')
      .in('status', ['active', 'trial', 'overdue']);

    if (!tenants?.length) return results;

    for (const tenant of tenants) {
      // Trial expirado
      if (tenant.status === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < now) {
        await supabase.from('tenants').update({ status: 'overdue' }).eq('id', tenant.id);
        await notifyTenant(
          tenant,
          `Tu período de prueba de ${PRODUCT_NAME} ha terminado`,
          `Hola ${tenant.contact_name || tenant.business_name} 👋\n\nTu período de prueba de *${PRODUCT_NAME}* ha terminado.\n\nPara continuar usando el servicio, activa tu suscripción en: ${BILLING_URL}\n\nEquipo ${PRODUCT_NAME}`,
          `Tu período de prueba ha finalizado. Activa tu suscripción para continuar.`
        );
        results.warned++;
        continue;
      }

      // Sin fecha de próximo pago → no verificar
      if (!tenant.next_payment_at) continue;

      const nextPayment = new Date(tenant.next_payment_at);
      const graceDays = tenant.tenant_plans?.grace_period_days || 3;
      const graceEnd = new Date(nextPayment.getTime() + graceDays * 24 * 60 * 60 * 1000);

      if (tenant.status === 'active' && nextPayment < now && graceEnd > now) {
        // En período de gracia — alertar
        const daysLeft = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
        if (daysLeft <= graceDays) {
          await notifyTenant(
            tenant,
            `⚠️ Pago vencido — ${daysLeft} día(s) para suspensión`,
            `⚠️ *${PRODUCT_NAME} — Pago pendiente*\n\nHola ${tenant.contact_name || tenant.business_name}, tu pago venció hace ${graceDays - daysLeft} día(s).\n\nTienes *${daysLeft} día(s)* antes de que el servicio sea suspendido.\n\nPaga ahora: ${BILLING_URL}\n\nEquipo ${PRODUCT_NAME}`,
            `Pago vencido. Tienes ${daysLeft} día(s) antes de la suspensión.`
          );

          // Registrar como overdue
          await supabase.from('tenants').update({ status: 'overdue' }).eq('id', tenant.id);
          results.warned++;
        }
      }

      if (graceEnd < now && ['active', 'overdue'].includes(tenant.status)) {
        // Período de gracia expirado → suspender
        await supabase.from('tenants').update({ status: 'suspended' }).eq('id', tenant.id);
        await notifyTenant(
          tenant,
          `🔴 ${PRODUCT_NAME} — Servicio suspendido`,
          `🔴 *${PRODUCT_NAME} — Servicio suspendido*\n\nHola ${tenant.contact_name || tenant.business_name},\n\nDado que no se registró el pago, hemos suspendido temporalmente el acceso a ${PRODUCT_NAME}.\n\nPara reactivar: ${BILLING_URL}\n\nEquipo ${PRODUCT_NAME}`,
          `Tu servicio de ${PRODUCT_NAME} ha sido suspendido por falta de pago.`
        );

        // Registrar error en system_errors
        await supabase.from('system_errors').insert({
          tenant_id: tenant.id,
          severity: 'warning',
          service: 'billing',
          error_type: 'payment_overdue',
          message: `Tenant ${tenant.business_name} suspendido por falta de pago`,
          status: 'open'
        });

        results.suspended++;
      }
    }

    // 2. Verificar tenants suspendidos que ya pagaron → reactivar
    const { data: suspended } = await supabase
      .from('tenants')
      .select('*')
      .eq('status', 'suspended');

    for (const tenant of suspended || []) {
      // Verificar si hay un pago reciente en tenant_payments
      const { data: recentPayment } = await supabase
        .from('tenant_payments')
        .select('id, paid_at, period_end')
        .eq('tenant_id', tenant.id)
        .eq('status', 'paid')
        .gte('paid_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('paid_at', { ascending: false })
        .limit(1)
        .single();

      if (recentPayment) {
        const newNextPayment = new Date(recentPayment.period_end || Date.now() + 30 * 24 * 60 * 60 * 1000);
        await supabase.from('tenants').update({
          status: 'active',
          next_payment_at: newNextPayment.toISOString()
        }).eq('id', tenant.id);

        await notifyTenant(
          tenant,
          `✅ ${PRODUCT_NAME} — Servicio reactivado`,
          `✅ *${PRODUCT_NAME} — ¡Servicio reactivado!*\n\nHola ${tenant.contact_name || tenant.business_name},\n\n¡Tu servicio ha sido reactivado exitosamente! 🎉\n\nTu próximo pago es el ${newNextPayment.toLocaleDateString('es-CO')}.\n\nEquipo ${PRODUCT_NAME}`,
          `Tu servicio de ${PRODUCT_NAME} ha sido reactivado.`
        );

        results.reactivated++;
      }
    }

    if (results.suspended > 0 || results.reactivated > 0 || results.warned > 0) {
      console.log(`[AccessControl] Suspendidos: ${results.suspended}, Reactivados: ${results.reactivated}, Alertados: ${results.warned}`);
    }
  } catch (err) {
    console.error('[AccessControl] Error:', err.message);
    await supabase.from('system_errors').insert({
      severity: 'error', service: 'billing',
      error_type: 'access_control_check_failed',
      message: err.message, status: 'open'
    }).catch(() => {});
  }

  return results;
}

// ============================================================
// Middleware: verificar que el tenant está activo antes de procesar chat
// ============================================================
export async function checkTenantActive(propertyId) {
  try {
    const { data: property } = await supabase
      .from('properties')
      .select('tenant_id, tenants(status)')
      .eq('id', propertyId)
      .single();

    if (!property?.tenant_id) return true; // sin tenant = modo legacy, permitir
    const status = property.tenants?.status;
    return status === 'active' || status === 'trial';
  } catch {
    return true; // en caso de error, no bloquear
  }
}

export default { runAccessControlCheck, checkTenantActive };
