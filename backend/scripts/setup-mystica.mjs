import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const TENANT_ID = '51555450-b8fa-4dba-91cc-122de9d854e6';

// ── Check existing user ─────────────────────────────────────
const { data: existingUser } = await sb.from('users').select('id, email, property_id').eq('email', 'admin@misticahostels.com').single();
console.log('Existing user:', existingUser?.id, existingUser?.email);

// ── Check existing properties ───────────────────────────────
const { data: existingProps } = await sb.from('properties').select('id, slug, name').eq('tenant_id', TENANT_ID);
console.log('Existing properties:', JSON.stringify(existingProps));

// ── Create Isla Palma if missing ────────────────────────────
let prop1 = existingProps?.find(p => p.slug === 'isla-palma');
if (!prop1) {
  const { data, error } = await sb.from('properties').insert({
    name: 'Mystica Isla Palma',
    slug: 'isla-palma',
    location: 'Isla Palma, Archipielago San Bernardo, Cartagena, Colombia',
    brand_name: 'Mystica Island',
    booking_url: 'https://booking.misticaisland.com',
    how_to_get_url: 'https://www.misticaisland.com/how-to-get',
    activities_url: 'https://www.misticaisland.com/activities',
    menu_url: 'https://www.misticaisland.com/services',
    faq_url: 'https://www.misticaisland.com/faq',
    whatsapp_number: '+573234392420',
    lobby_token_env_key: 'LOBBY_TOKEN_ISLA_PALMA',
    wompi_public_key_env_key: 'WOMPI_PUBLIC_KEY_ISLA',
    wompi_private_key_env_key: 'WOMPI_PRIVATE_KEY_ISLA',
    languages: ['es', 'en', 'fr', 'de'],
    includes: ['desayuno', 'wifi gratis'],
    restrictions: 'Ninos menores de 7 anos solo en Cabana del Arbol o Las Aldea',
    tenant_id: TENANT_ID,
    is_active: true,
    plan: 'pro',
    default_language: 'es'
  }).select().single();
  if (error) console.log('Isla Palma error:', error.message);
  else { prop1 = data; console.log('Isla Palma created:', prop1.id); }
} else {
  console.log('Isla Palma already exists:', prop1.id);
}

// ── Create Tayrona if missing ───────────────────────────────
let prop2 = existingProps?.find(p => p.slug === 'tayrona');
if (!prop2) {
  const { data, error } = await sb.from('properties').insert({
    name: 'Mystica Tayrona',
    slug: 'tayrona',
    location: 'Bahia Cinto, Parque Nacional Natural Tayrona, Colombia',
    brand_name: 'Mystica Tayrona',
    booking_url: 'https://booking.misticatayrona.com',
    how_to_get_url: 'https://www.mhostels.co/how-to-get',
    activities_url: 'https://www.mhostels.co/activities',
    menu_url: 'https://www.mhostels.co/services',
    faq_url: 'https://www.mhostels.co/faq',
    whatsapp_number: '+573234392420',
    lobby_token_env_key: 'LOBBY_TOKEN_TAYRONA',
    wompi_public_key_env_key: 'WOMPI_PUBLIC_KEY_TAYRONA',
    wompi_private_key_env_key: 'WOMPI_PRIVATE_KEY_TAYRONA',
    languages: ['es', 'en', 'fr', 'de'],
    includes: ['desayuno', 'wifi gratis'],
    tenant_id: TENANT_ID,
    is_active: true,
    plan: 'pro',
    default_language: 'es'
  }).select().single();
  if (error) console.log('Tayrona error:', error.message);
  else { prop2 = data; console.log('Tayrona created:', prop2.id); }
} else {
  console.log('Tayrona already exists:', prop2.id);
}

// ── Update user to link to Isla Palma ───────────────────────
if (existingUser && prop1?.id) {
  const { error } = await sb.from('users').update({ property_id: prop1.id }).eq('id', existingUser.id);
  if (error) console.log('User update error:', error.message);
  else console.log('User linked to Isla Palma');
}

// ── Save settings ───────────────────────────────────────────
for (const [pid, propSettings] of [
  [prop1?.id, [
    { key: 'lobbypms_token', value: 'DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe' },
    { key: 'wompi_config', value: { public_key: 'pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is', private_key: 'prv_prod_aXLdFHwIIktnmKNHdjBXVsaDJzEbs2p9' } },
    { key: 'ai_provider', value: { provider: 'claude', api_keys: {} } },
    { key: 'agent', value: { agent_name: 'Revio AI', personality: 'warm', languages: ['es','en','fr','de'], max_discount_pct: 10, occupancy_threshold_pct: 60 } }
  ]],
  [prop2?.id, [
    { key: 'lobbypms_token', value: 'm25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL' },
    { key: 'wompi_config', value: { public_key: 'pub_prod_Y3GeuGHuQk22aI3x0x6aKcVi8j2haBcA', private_key: 'prv_prod_JgHPuMpLPIgNHmtdpp5BpRYQv3S4EAsP' } },
    { key: 'ai_provider', value: { provider: 'claude', api_keys: {} } },
    { key: 'agent', value: { agent_name: 'Revio AI', personality: 'warm', languages: ['es','en','fr','de'], max_discount_pct: 10, occupancy_threshold_pct: 60 } }
  ]]
]) {
  if (!pid) continue;
  for (const s of propSettings) {
    const { error } = await sb.from('settings').upsert(
      { property_id: pid, key: s.key, value: s.value },
      { onConflict: 'property_id,key' }
    );
    if (error) console.log('Setting error', pid, s.key, ':', error.message);
    else console.log('Saved setting', s.key, 'for', pid.substring(0, 8));
  }
}

console.log('\n=== FINAL STATE ===');
console.log('Tenant ID:', TENANT_ID);
console.log('Isla Palma ID:', prop1?.id);
console.log('Tayrona ID:', prop2?.id);
console.log('User:', existingUser?.id);
console.log('Login: admin@misticahostels.com / Mystica2026!');
