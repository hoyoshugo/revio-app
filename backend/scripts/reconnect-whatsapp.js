#!/usr/bin/env node
/**
 * reconnect-whatsapp.js — Verificar y diagnosticar estado de WhatsApp Business API.
 *
 * Uso:
 *   node backend/scripts/reconnect-whatsapp.js [--fix]
 *
 * Sin --fix: solo diagnóstico (lectura).
 * Con --fix: intenta registrar el número vía API (requiere WHATSAPP_PIN).
 *
 * Pasos manuales si --fix no funciona:
 *   1. Ir a https://business.facebook.com/latest/whatsapp_manager/phone_numbers
 *   2. Buscar +57 323 4392420 → Reconnect → OTP por SMS
 *   3. Si pide 2FA PIN → usar WHATSAPP_PIN del .env
 */

import 'dotenv/config';

const GRAPH = 'https://graph.facebook.com/v22.0';
const TOKEN = process.env.WHATSAPP_TOKEN || process.env.FACEBOOK_PAGE_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WABA_ID = process.env.WHATSAPP_WABA_ID || process.env.META_BUSINESS_ID;
const PIN = process.env.WHATSAPP_PIN;

async function gql(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${GRAPH}${path}`, opts);
  return { status: r.status, data: await r.json() };
}

async function diagnose() {
  console.log('═══ WhatsApp Business API — Diagnóstico ═══\n');

  // 1. Validar token
  console.log('1. Validando token...');
  const tokenCheck = await gql(`/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`);
  if (tokenCheck.data?.data?.is_valid) {
    const td = tokenCheck.data.data;
    console.log(`   ✅ Token válido — App ID: ${td.app_id}, Expira: ${td.expires_at ? new Date(td.expires_at * 1000).toISOString() : 'nunca'}`);
    console.log(`   Scopes: ${td.scopes?.join(', ')}`);
  } else {
    console.log(`   ❌ Token INVÁLIDO: ${tokenCheck.data?.error?.message || JSON.stringify(tokenCheck.data)}`);
    console.log('   → Regenerar en Graph API Explorer con permisos whatsapp_business_management + whatsapp_business_messaging');
    return;
  }

  // 2. Estado del número
  console.log('\n2. Estado del número de WhatsApp...');
  const phoneCheck = await gql(`/${PHONE_ID}?fields=display_phone_number,code_verification_status,name_status,quality_rating,messaging_limit_tier,is_official_business_account,verified_name`);
  if (phoneCheck.status === 200) {
    const p = phoneCheck.data;
    console.log(`   ✅ Número: ${p.display_phone_number}`);
    console.log(`   Verificación: ${p.code_verification_status}`);
    console.log(`   Nombre: ${p.verified_name || '(sin verificar)'} — Status: ${p.name_status}`);
    console.log(`   Calidad: ${p.quality_rating} — Tier: ${p.messaging_limit_tier}`);
    console.log(`   Cuenta oficial: ${p.is_official_business_account}`);

    if (p.code_verification_status === 'EXPIRED' || p.code_verification_status === 'NOT_VERIFIED') {
      console.log('\n   ⚠️  Número DESCONECTADO — necesita re-verificación');
      console.log('   → Meta Business Manager → Phone Numbers → Reconnect → OTP por SMS');
    }
  } else {
    console.log(`   ❌ Error consultando número: ${JSON.stringify(phoneCheck.data?.error || phoneCheck.data)}`);
  }

  // 3. WABA
  console.log('\n3. WhatsApp Business Account...');
  const wabaCheck = await gql(`/${WABA_ID}?fields=name,currency,timezone_id,message_template_namespace,account_review_status`);
  if (wabaCheck.status === 200) {
    const w = wabaCheck.data;
    console.log(`   ✅ WABA: ${w.name} — Review: ${w.account_review_status}`);
    console.log(`   Moneda: ${w.currency} — Timezone: ${w.timezone_id}`);
  } else {
    console.log(`   ⚠️  No se pudo consultar WABA: ${wabaCheck.data?.error?.message}`);
  }

  // 4. Webhook status
  console.log('\n4. App subscriptions (webhooks)...');
  const appId = tokenCheck.data?.data?.app_id;
  if (appId) {
    const subs = await gql(`/${appId}/subscriptions`);
    if (subs.data?.data?.length) {
      for (const sub of subs.data.data) {
        console.log(`   📡 ${sub.object}: ${sub.active ? '✅ activo' : '❌ inactivo'} — fields: ${sub.fields?.map(f => f.name).join(', ')}`);
      }
    } else {
      console.log('   ⚠️  No hay subscriptions activas');
    }
  }

  // 5. Test de envío (a sí mismo)
  console.log('\n5. Test de envío de mensaje...');
  const testPhone = process.env.ALERT_WHATSAPP?.replace(/\D/g, '') || '573234392420';
  const sendTest = await gql(`/${PHONE_ID}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    to: testPhone,
    type: 'text',
    text: { body: '🔧 Test de reconexión Revio — ' + new Date().toISOString() },
  });
  if (sendTest.data?.messages?.[0]?.id) {
    console.log(`   ✅ Mensaje enviado — ID: ${sendTest.data.messages[0].id}`);
  } else {
    console.log(`   ❌ Error enviando: ${JSON.stringify(sendTest.data?.error || sendTest.data)}`);
  }

  console.log('\n═══ Diagnóstico completo ═══');
}

async function fix() {
  if (!PIN) {
    console.log('❌ WHATSAPP_PIN no está en .env — necesario para re-registro vía API');
    console.log('   Alternativa manual: Meta Business Manager → Phone Numbers → Reconnect');
    return;
  }

  console.log('Intentando re-registrar número con PIN...');
  const register = await gql(`/${PHONE_ID}/register`, 'POST', {
    messaging_product: 'whatsapp',
    pin: PIN,
  });

  if (register.data?.success) {
    console.log('✅ Número re-registrado exitosamente');
  } else {
    console.log(`❌ Error: ${JSON.stringify(register.data?.error || register.data)}`);
    console.log('   → Intentar manualmente en Meta Business Manager');
  }
}

// ── Main ──
const doFix = process.argv.includes('--fix');
console.log(`Modo: ${doFix ? 'DIAGNÓSTICO + FIX' : 'SOLO DIAGNÓSTICO'}\n`);

diagnose().then(async () => {
  if (doFix) {
    console.log('\n── Intentando fix automático ──\n');
    await fix();
    // Re-diagnosticar después del fix
    console.log('\n── Re-diagnóstico post-fix ──\n');
    await diagnose();
  }
}).catch(e => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});
