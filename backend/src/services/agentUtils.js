import { supabase } from '../models/supabase.js';

// ═══════════════════
// CICLO LUNAR (para tour bioluminiscencia)
// ═══════════════════
export function getMoonPhase(date = new Date()) {
  const knownNewMoon = new Date('2024-01-11');
  const lunarCycle = 29.53058867;
  const diff = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;

  if (phase < 1   || phase > 28) return { phase: 'nueva',             suitable_bioluminescence: true,  emoji: '🌑' };
  if (phase < 7.4)               return { phase: 'creciente',         suitable_bioluminescence: phase < 3, emoji: '🌒' };
  if (phase < 8.4)               return { phase: 'cuarto_creciente',  suitable_bioluminescence: false, emoji: '🌓' };
  if (phase < 14.8)              return { phase: 'gibosa_creciente',  suitable_bioluminescence: false, emoji: '🌔' };
  if (phase < 15.8)              return { phase: 'llena',             suitable_bioluminescence: false, emoji: '🌕' };
  if (phase < 22.1)              return { phase: 'gibosa_menguante',  suitable_bioluminescence: false, emoji: '🌖' };
  if (phase < 23.1)              return { phase: 'cuarto_menguante',  suitable_bioluminescence: false, emoji: '🌗' };
  return { phase: 'menguante', suitable_bioluminescence: phase > 25, emoji: '🌘' };
}

export function getBioluminescenceDates(startDate = new Date(), days = 30) {
  const suitable = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const moon = getMoonPhase(d);
    if (moon.suitable_bioluminescence) {
      suitable.push({ date: d.toISOString().split('T')[0], phase: moon.phase, emoji: moon.emoji });
    }
  }
  return suitable;
}

// ═══════════════════
// FESTIVOS COLOMBIA (con regla del lunes siguiente)
// ═══════════════════
export function getColombiaHolidays(year = new Date().getFullYear()) {
  const fixed = [
    { date: `${year}-01-01`, name: 'Año Nuevo' },
    { date: `${year}-05-01`, name: 'Día del Trabajo' },
    { date: `${year}-07-20`, name: 'Día de la Independencia' },
    { date: `${year}-08-07`, name: 'Batalla de Boyacá' },
    { date: `${year}-12-08`, name: 'Inmaculada Concepción' },
    { date: `${year}-12-25`, name: 'Navidad' },
  ];

  function nextMonday(month, day) {
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();
    if (dow === 1) return d.toISOString().split('T')[0];
    const daysUntil = dow === 0 ? 1 : 8 - dow;
    d.setDate(d.getDate() + daysUntil);
    return d.toISOString().split('T')[0];
  }

  const movable = [
    { date: nextMonday(1, 6),  name: 'Reyes Magos' },
    { date: nextMonday(3, 19), name: 'San José' },
    { date: nextMonday(6, 29), name: 'San Pedro y San Pablo' },
    { date: nextMonday(8, 15), name: 'Asunción de la Virgen' },
    { date: nextMonday(10, 12),name: 'Día de la Raza' },
    { date: nextMonday(11, 1), name: 'Todos los Santos' },
    { date: nextMonday(11, 11),name: 'Independencia de Cartagena' },
  ];

  return [...fixed, ...movable].sort((a, b) => a.date.localeCompare(b.date));
}

export function isLongWeekend(date = new Date()) {
  const holidays = getColombiaHolidays(date.getFullYear());
  const dateStr = date.toISOString().split('T')[0];

  for (let i = -3; i <= 3; i++) {
    const d = new Date(date);
    d.setDate(date.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const hit = holidays.find(h => h.date === ds);
    if (hit) return { isLongWeekend: true, daysAway: i, holiday: hit };
  }
  return { isLongWeekend: false };
}

// ═══════════════════
// CONTACTOS (CRM básico)
// ═══════════════════
export async function saveContact(tenantId, contactData) {
  const { name, email, phone, source, language } = contactData;
  if (!phone && !email) return null;

  const contact = {
    tenant_id: tenantId,
    name: name || null,
    email: email || null,
    phone: phone || null,
    source: source || 'unknown',
    language: language || 'es',
    last_contact_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('contacts')
      .upsert(contact, {
        onConflict: phone ? 'tenant_id,phone' : 'tenant_id,email',
        ignoreDuplicates: false,
      })
      .select()
      .single();
    if (error) console.error('saveContact error:', error.message);
    return data;
  } catch (e) {
    console.error('saveContact exception:', e.message);
    return null;
  }
}

// ═══════════════════
// SOLICITAR APROBACIÓN (descuentos, upgrades, facturas, etc.)
// ═══════════════════
export async function requestApproval(tenantId, propertyId, type, details) {
  const { data: cfg } = await supabase
    .from('property_knowledge')
    .select('value')
    .eq('property_id', propertyId)
    .eq('category', 'notifications')
    .eq('key', 'approval_phone')
    .single();

  const notifyPhone = cfg?.value || process.env.DEFAULT_NOTIFY_PHONE;

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      type,
      description: details.description,
      guest_name: details.guestName,
      guest_contact: details.guestContact,
      amount_cop: details.amountCop,
      details,
      notify_phone: notifyPhone,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (!error && notifyPhone) {
    const message =
      '🔔 *Solicitud de aprobación Revio*\n\n' +
      `Tipo: ${type}\n` +
      `Huésped: ${details.guestName || 'Desconocido'}\n` +
      `Descripción: ${details.description}\n` +
      (details.amountCop ? `Monto: $${Number(details.amountCop).toLocaleString()} COP\n` : '') +
      '\nResponde APROBAR o RECHAZAR';
    await sendWhatsAppMessage(notifyPhone, message);
  }
  return data;
}

// ═══════════════════
// REPORTE DE RESERVA POR WHATSAPP
// ═══════════════════
export async function sendReservationReport(propertyId, reservation) {
  const { data: cfg } = await supabase
    .from('property_knowledge')
    .select('value')
    .eq('property_id', propertyId)
    .eq('category', 'notifications')
    .eq('key', 'report_phone')
    .single();

  const reportPhone = cfg?.value;
  if (!reportPhone) return;

  const report =
    '📋 *Nueva Reserva — Revio*\n\n' +
    `🔢 N° Reserva: ${reservation.id || 'Pendiente'}\n` +
    `👤 Huésped: ${reservation.guestName}\n` +
    `👥 Personas: ${reservation.guests}\n` +
    `📅 Llegada: ${reservation.checkIn}\n` +
    `📅 Salida: ${reservation.checkOut}\n` +
    `🏠 Habitación: ${reservation.roomType}\n` +
    `💳 Pago: ${reservation.paymentStatus}\n` +
    `🚤 Transporte: ${reservation.transport || 'Sin confirmar'}\n` +
    `✅ Confirmada: ${reservation.confirmed ? 'Sí' : 'No'}`;

  await sendWhatsAppMessage(reportPhone, report);
}

// ═══════════════════
// ENVIAR WHATSAPP via Meta Graph
// ═══════════════════
export async function sendWhatsAppMessage(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || token === 'pendiente' || !phoneId) return null;

  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    return await r.json();
  } catch (e) {
    console.error('sendWhatsApp error:', e.message);
    return null;
  }
}

// ═══════════════════
// DETECTAR IDIOMA
// ═══════════════════
export function detectLanguage(text) {
  if (!text) return 'es';
  const patterns = {
    en: /\b(hello|hi|want|need|room|reservation|price|how much|availability|thank|good morning)\b/i,
    fr: /\b(bonjour|salut|chambre|réservation|prix|combien|merci|bonsoir)\b/i,
    de: /\b(hallo|guten|möchte|zimmer|reservierung|preis|wieviel|danke)\b/i,
    pt: /\b(olá|oi|quero|preciso|quarto|reserva|preço|quanto|obrigado)\b/i,
    es: /\b(hola|quiero|necesito|habitación|reserva|precio|cuánto|gracias|buenos días)\b/i,
  };
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return lang;
  }
  return 'es';
}

// ═══════════════════
// HORARIOS CARIBBEAN TREASURES
// ═══════════════════
export async function getCaribbeanSchedules(origin, destination, date) {
  const apiUrl = process.env.CARIBBEAN_TREASURES_API_URL;
  const apiKey = process.env.CARIBBEAN_TREASURES_API_KEY;

  if (!apiUrl) return getParametrizedSchedules(origin, destination);

  try {
    const r = await fetch(
      `${apiUrl}/api/schedules?origin=${origin}&destination=${destination}&date=${date}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    return await r.json();
  } catch {
    return getParametrizedSchedules(origin, destination);
  }
}

function getParametrizedSchedules(origin, destination) {
  return [{
    message: 'Consultar horarios actualizados directamente con Caribbean Treasures: https://www.caribbeantreasures.co',
    contact: 'Caribbean Treasures',
  }];
}
