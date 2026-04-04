/**
 * Revio — Integration Tests
 * Run: node backend/src/tests/integration-tests.js
 * Or:  npm run test:integration (from backend/)
 */

const BASE = process.env.BASE_URL || 'https://revio-app-production.up.railway.app';
const LOCAL = 'http://localhost:3001';

// Use local if explicitly requested
const API = process.env.USE_LOCAL === 'true' ? LOCAL : BASE;

const LOBBY_TOKEN_ISLA = process.env.LOBBY_TOKEN_ISLA_PALMA ||
  'DIhD1TKF0PXyzKmblOgJuNGYMstASOv4Taej4O3w61AWnK9h8l8XK2LkRVDe';
const LOBBY_TOKEN_TAYRONA = process.env.LOBBY_TOKEN_TAYRONA ||
  'm25t8qVZ6EJTO45WFx3tb75lbPV0OwE5Y3yVqF4OypeVPSu0iL1bKc5zJQlL';
const WA_TOKEN = process.env.WHATSAPP_TOKEN ||
  'EAAcK6VFh7XYBRJzyUw4gEtZAjdymQ77LRQZBFdvakvG8AOpgO1V6sEZCqmRuf9fpNlxYSIYPvM0b0nVsGaRnHdymNWXpuwwL8RL0WXzNEgO1YbV0770wVuQAzeYryQZCQRWZCt4K7hQKZAMPHa084iO5akQAk7hA4TSJXH37EKZCuhGHgF5oniIDuBmzgZDZD';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ||
  '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';

let cachedClientToken = null;

async function getClientToken() {
  if (cachedClientToken) return cachedClientToken;
  const r = await fetch(`${API}/api/dashboard/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@misticahostels.com', password: 'Mystica2026!' })
  });
  const d = await r.json();
  cachedClientToken = d.token;
  return cachedClientToken;
}

const TESTS = [
  {
    name: '1. Health Check',
    category: 'Backend',
    test: async () => {
      const r = await fetch(`${API}/health`);
      const d = await r.json();
      if (d.status !== 'ok') throw new Error(`status: ${d.status}`);
      return `uptime ${d.uptime}s`;
    }
  },
  {
    name: '2. SuperAdmin Login',
    category: 'Auth',
    test: async () => {
      const r = await fetch(`${API}/api/sa/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@misticatech.co', password: 'MisticaTech2026!' })
      });
      const d = await r.json();
      if (!d.token) throw new Error(d.error || 'no token');
      return `role: ${d.user?.role}`;
    }
  },
  {
    name: '3. Client Login (Mística)',
    category: 'Auth',
    test: async () => {
      const token = await getClientToken();
      if (!token) throw new Error('no token returned');
      return `token: ${token.substring(0, 20)}...`;
    }
  },
  {
    name: '4. Dashboard Metrics',
    category: 'Backend',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/dashboard/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await r.json();
      if (!Array.isArray(d.metrics)) throw new Error('metrics not array');
      return `${d.metrics.length} propiedades`;
    }
  },
  {
    name: '5. Meta Webhook Verify',
    category: 'Webhooks',
    test: async () => {
      const challenge = 'revio_test_' + Date.now();
      const r = await fetch(`${API}/api/social/webhook/meta?hub.mode=subscribe&hub.verify_token=mystica_webhook_2026&hub.challenge=${challenge}`);
      const text = await r.text();
      if (text !== challenge) throw new Error(`got: ${text}`);
      return 'challenge verified';
    }
  },
  {
    name: '6. Chat Agent (Isla Palma ES)',
    category: 'Agent',
    test: async () => {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hola, ¿tienen disponibilidad?',
          property_slug: 'isla-palma',
          session_id: `test-${Date.now()}`
        })
      });
      const d = await r.json();
      if (!d.reply) throw new Error('no reply');
      const isAI = !d.reply.includes('problema técnico');
      return isAI ? `AI: "${d.reply.substring(0, 40)}..."` : `⚠️ Fallback (sin créditos Anthropic)`;
    }
  },
  {
    name: '7. Chat Agent (Tayrona)',
    category: 'Agent',
    test: async () => {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '¿Cuánto cuesta una cama en dorm?',
          property_slug: 'mistica-tayrona',
          session_id: `test-tay-${Date.now()}`
        })
      });
      const d = await r.json();
      if (!d.reply) throw new Error('no reply');
      return d.reply.substring(0, 50) + '...';
    }
  },
  {
    name: '8. Chat Agent (English)',
    category: 'Agent',
    test: async () => {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hi, do you have availability for May?',
          property_slug: 'isla-palma',
          session_id: `test-en-${Date.now()}`
        })
      });
      const d = await r.json();
      if (!d.reply) throw new Error('no reply');
      return d.reply.substring(0, 50) + '...';
    }
  },
  {
    name: '9. Wompi Merchant (Isla Palma)',
    category: 'Payments',
    test: async () => {
      const r = await fetch('https://production.wompi.co/v1/merchants/pub_prod_S0hgyIU483yCttiT0PaSbFgnGCx275is');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return `${d.data?.name} — activo: ${d.data?.active}`;
    }
  },
  {
    name: '10. Wompi Merchant (Tayrona)',
    category: 'Payments',
    test: async () => {
      const r = await fetch('https://production.wompi.co/v1/merchants/pub_prod_Y3GeuGHuQk22aI3x0x6aKcVi8j2haBcA');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return `${d.data?.name} — activo: ${d.data?.active}`;
    }
  },
  {
    name: '11. WhatsApp Token Válido',
    category: 'WhatsApp',
    test: async () => {
      const r = await fetch(`https://graph.facebook.com/v22.0/debug_token?input_token=${WA_TOKEN}&access_token=${WA_TOKEN}`);
      const d = await r.json();
      if (!d.data?.is_valid) throw new Error('token inválido');
      const exp = d.data.expires_at === 0 ? 'nunca' : new Date(d.data.expires_at * 1000).toLocaleDateString();
      return `válido hasta: ${exp}`;
    }
  },
  {
    name: '12. WhatsApp Phone Number',
    category: 'WhatsApp',
    test: async () => {
      const r = await fetch(`https://graph.facebook.com/v22.0/101206379439613?fields=display_phone_number,status,quality_rating&access_token=${WA_TOKEN}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      return `${d.display_phone_number} — status: ${d.status}`;
    }
  },
  {
    name: '13. LobbyPMS Isla Palma',
    category: 'PMS',
    test: async () => {
      const r = await fetch('https://api.lobbypms.com/api/v2/available-rooms', {
        headers: { 'Authorization': `Bearer ${LOBBY_TOKEN_ISLA}` }
      });
      const text = await r.text();
      if (r.status === 403 || text.includes('not set as a valid ip')) {
        throw new Error('IP 200.189.27.14 no está en whitelist');
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${JSON.parse(text).length || '?'} habitaciones`;
    }
  },
  {
    name: '14. LobbyPMS Tayrona',
    category: 'PMS',
    test: async () => {
      const r = await fetch('https://api.lobbypms.com/api/v2/available-rooms', {
        headers: { 'Authorization': `Bearer ${LOBBY_TOKEN_TAYRONA}` }
      });
      const text = await r.text();
      if (r.status === 403 || text.includes('not set as a valid ip')) {
        throw new Error('IP 200.189.27.14 no está en whitelist');
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${JSON.parse(text).length || '?'} habitaciones`;
    }
  },
  {
    name: '15. Anthropic API',
    category: 'AI',
    test: async () => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say: OK' }]
        })
      });
      const d = await r.json();
      if (d.error?.type === 'invalid_request_error' && d.error.message.includes('credit')) {
        throw new Error('Sin créditos — recargar en console.anthropic.com/settings/billing');
      }
      if (d.error) throw new Error(d.error.message);
      return d.content?.[0]?.text || 'responded';
    }
  }
];

async function runTests() {
  console.log('\n🧪 REVIO INTEGRATION TESTS');
  console.log(`📍 Base URL: ${API}`);
  console.log(`⏰ ${new Date().toLocaleString('es-CO')}\n`);
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;
  const results = [];

  const categories = [...new Set(TESTS.map(t => t.category))];

  for (const category of categories) {
    const categoryTests = TESTS.filter(t => t.category === category);
    console.log(`\n  ${category.toUpperCase()}`);

    for (const t of categoryTests) {
      try {
        const detail = await t.test();
        console.log(`  ✅ ${t.name}`);
        if (detail) console.log(`     └─ ${detail}`);
        passed++;
        results.push({ name: t.name, status: 'pass', detail });
      } catch (err) {
        console.log(`  ❌ ${t.name}`);
        console.log(`     └─ ${err.message}`);
        failed++;
        results.push({ name: t.name, status: 'fail', error: err.message });
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTADO: ${passed}/${TESTS.length} pruebas pasando`);

  if (failed > 0) {
    console.log('\n⚠️  FALLOS (requieren acción):');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
    });
  }

  console.log('\n📋 ACCIONES MANUALES PENDIENTES:');
  const failures = results.filter(r => r.status === 'fail');
  if (failures.find(f => f.name.includes('Anthropic'))) {
    console.log('   🔴 1. Anthropic créditos → console.anthropic.com/settings/billing ($20 USD)');
  }
  if (failures.find(f => f.name.includes('LobbyPMS'))) {
    console.log('   🔴 2. LobbyPMS IP whitelist → agregar 200.189.27.14 en dashboard LobbyPMS');
  }
  if (results.find(r => r.name.includes('WhatsApp Phone') && r.error?.includes('DISCONNECTED'))) {
    console.log('   🔴 3. WhatsApp → Meta Business Manager → reconectar número +57 323 4392420');
  }
  if (!failures.find(f => f.name.includes('Supabase'))) {
    console.log('   🔴 4. Supabase service_role key → settings/api → copiar → actualizar Railway');
  }
  console.log('');

  return { passed, failed, total: TESTS.length };
}

runTests().catch(console.error);
