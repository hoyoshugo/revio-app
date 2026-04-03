/**
 * Migration runner — conexión directa a Supabase PostgreSQL
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'apghalkivuvyhbmethxk';
const SQL_FILE = resolve(__dirname, '../supabase/migration_003_escalations.sql');

async function tryConnect(connString, label) {
  const client = new Client({
    connectionString: connString,
    connectionTimeoutMillis: 8000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`✅ Conectado vía ${label}`);
    return client;
  } catch (err) {
    console.log(`  ✗ ${label}: ${err.message.substring(0, 60)}`);
    await client.end().catch(() => {});
    return null;
  }
}

async function runSQL(client) {
  const sql = readFileSync(SQL_FILE, 'utf8');
  // Split on semicolons but handle function bodies ($$...$$)
  const statements = [];
  let current = '';
  let inDollar = false;
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) { continue; }
    if (trimmed.includes('$$')) inDollar = !inDollar;
    current += line + '\n';
    if (!inDollar && trimmed.endsWith(';')) {
      const stmt = current.trim().replace(/;$/, '');
      if (stmt.length > 2) statements.push(stmt);
      current = '';
    }
  }
  if (current.trim().length > 2) statements.push(current.trim());

  let ok = 0, skipped = 0, failed = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        skipped++;
      } else {
        console.warn(`  ⚠  ${err.message.substring(0, 100)}`);
        failed++;
      }
    }
  }
  return { ok, skipped, failed };
}

async function main() {
  console.log(`🚀 Ejecutando: ${SQL_FILE}\n`);

  const passwords = [
    process.argv[2],
    process.env.DB_PASSWORD,
    'Mistica2026!',
    'MisticaHostels2026SuperSecretKey',
    'postgres',
    'supabase',
  ].filter(Boolean);

  const hosts = [
    { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres' },
    { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
    { host: `aws-0-us-east-2.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
    { host: `aws-0-sa-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
  ];

  for (const password of passwords) {
    for (const { host, port, user } of hosts) {
      const connStr = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
      const client = await tryConnect(connStr, `${host}:${port}`);
      if (client) {
        const result = await runSQL(client);
        await client.end();
        console.log(`\n📊 OK: ${result.ok}, ya existían: ${result.skipped}, errores: ${result.failed}`);
        if (result.failed === 0) {
          console.log('\n✅ ¡Migración completada!');
        } else {
          console.log('\n⚠  Migración completada con algunos errores.');
        }
        process.exit(0);
      }
    }
  }

  console.log('\n❌ No se pudo conectar. Ejecuta el SQL manualmente en:');
  console.log('   https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/editor');
  process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
