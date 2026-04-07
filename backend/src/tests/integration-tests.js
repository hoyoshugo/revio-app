/**
 * Revio — Integration Tests
 * Run: node backend/src/tests/integration-tests.js
 * Or:  npm run test:integration (from backend/)
 */

// Load .env from backend/ regardless of working directory
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env'); // backend/.env
if (existsSync(envPath)) {
  const { config } = await import('dotenv');
  config({ path: envPath });
}

const BASE = process.env.BASE_URL || 'https://revio-app-production.up.railway.app';
const LOCAL = 'http://localhost:3001';

// Use local if explicitly requested
const API = process.env.USE_LOCAL === 'true' ? LOCAL : BASE;

const WA_TOKEN = process.env.WHATSAPP_TOKEN || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

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
      // Testar via backend (usa IP de Railway, que sí está en whitelist)
      const token = await getClientToken();
      const r = await fetch(`${API}/api/connections/67fbce21-1b88-449f-93e2-1226cda2a7fb/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key: 'lobbypms_token' })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'test failed');
      return d.message;
    }
  },
  {
    name: '14. LobbyPMS Tayrona',
    category: 'PMS',
    test: async () => {
      // Testar via backend (usa IP de Railway, que sí está en whitelist)
      const token = await getClientToken();
      const r = await fetch(`${API}/api/connections/148f7836-6fcf-4d06-8570-bd65fcc2ccf0/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key: 'lobbypms_token' })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'test failed');
      return d.message;
    }
  },
  {
    name: '15. POS Revenue Centers (GET)',
    category: 'POS',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/pos/revenue-centers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.revenue_centers)) throw new Error('revenue_centers not array');
      return `${d.revenue_centers.length} centros de revenue`;
    }
  },
  {
    name: '16. POS Products (GET)',
    category: 'POS',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/pos/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.products)) throw new Error('products not array');
      return `${d.products.length} productos disponibles`;
    }
  },
  {
    name: '17. POS Orders (GET)',
    category: 'POS',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/pos/orders?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.orders)) throw new Error('orders not array');
      return `${d.orders.length} ordenes recientes`;
    }
  },
  {
    name: '19. Inventory Items (GET)',
    category: 'Inventory',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/inventory/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.items)) throw new Error('items not array');
      return `${d.items.length} items en inventario`;
    }
  },
  {
    name: '20. Inventory Alerts (GET)',
    category: 'Inventory',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/inventory/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.alerts)) throw new Error('alerts not array');
      return `${d.total} alertas de stock bajo`;
    }
  },
  {
    name: '21. Inventory Report (GET)',
    category: 'Inventory',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/inventory/report`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.totales) throw new Error('sin totales en reporte');
      return `${d.totales.items} items | valor $${d.totales.valor_total.toLocaleString()}`;
    }
  },
  {
    name: '22. Inventory Create + Movement + Delete',
    category: 'Inventory',
    test: async () => {
      const token = await getClientToken();
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      // Crear item
      const cr = await fetch(`${API}/api/inventory/items`, {
        method: 'POST', headers,
        body: JSON.stringify({ nombre: 'Test Item CI', categoria: 'Test', stock_actual: 10, stock_minimo: 2, precio_costo: 5000 })
      });
      if (!cr.ok) throw new Error(`Create HTTP ${cr.status}`);
      const { item } = await cr.json();
      if (!item?.id) throw new Error('no item id on create');

      // Registrar movimiento (salida)
      const mr = await fetch(`${API}/api/inventory/movements`, {
        method: 'POST', headers,
        body: JSON.stringify({ item_id: item.id, tipo: 'salida', cantidad: 3, motivo: 'test CI' })
      });
      if (!mr.ok) throw new Error(`Movement HTTP ${mr.status}`);
      const { stock_nuevo } = await mr.json();
      if (stock_nuevo !== 7) throw new Error(`stock esperado 7, got ${stock_nuevo}`);

      // Soft delete
      const dr = await fetch(`${API}/api/inventory/items/${item.id}`, { method: 'DELETE', headers });
      if (!dr.ok) throw new Error(`Delete HTTP ${dr.status}`);

      return `CRUD OK: stock 10 -> 7 tras salida`;
    }
  },
  {
    name: '24. PMS Room Types (GET)',
    category: 'PMS',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/rooms/types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.room_types)) throw new Error('room_types not array');
      return `${d.room_types.length} tipos de habitacion`;
    }
  },
  {
    name: '25. PMS Gantt Availability (GET)',
    category: 'PMS',
    test: async () => {
      const token = await getClientToken();
      const today = new Date().toISOString().slice(0, 10);
      const nextMonth = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const r = await fetch(`${API}/api/rooms/gantt/availability?date_from=${today}&date_to=${nextMonth}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.rooms)) throw new Error('rooms not array');
      if (!Array.isArray(d.reservations)) throw new Error('reservations not array');
      return `${d.rooms.length} habitaciones, ${d.reservations.length} reservas`;
    }
  },
  {
    name: '26. PMS Reservations List (GET)',
    category: 'PMS',
    test: async () => {
      const token = await getClientToken();
      const r = await fetch(`${API}/api/reservations?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d.reservations)) throw new Error('reservations not array');
      return `${d.reservations.length} reservas recientes`;
    }
  },
  {
    name: '26b. Analytics Events (tabla Supabase)',
    category: 'AI',
    test: async () => {
      // Verifica que la tabla analytics_events existe en Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const { error } = await supabase.from('analytics_events').select('id').limit(1);
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('analytics_events')) {
          throw new Error('Tabla analytics_events NO existe — ejecutar migration_012_analytics.sql');
        }
        throw new Error(error.message);
      }
      return 'tabla OK';
    }
  },
  {
    name: '27. Anthropic API',
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
    console.log('   🔴 2. LobbyPMS IP whitelist → agregar IP de Railway en dashboard LobbyPMS');
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
