/**
 * dbMigrations.js — Auto-migrations on startup.
 *
 * Solo contiene migraciones de ESQUEMA (DDL). NUNCA datos de clientes.
 * Los datos de cada tenant se gestionan desde la BD directamente.
 *
 * Requires: SUPABASE_DB_URL env var (Postgres direct connection)
 *   Get from: Supabase → Settings → Database → Connection string → URI
 */

const MIGRATIONS = [
  {
    name: 'migration_009_property_knowledge',
    check: `SELECT to_regclass('public.property_knowledge') IS NOT NULL AS exists`,
    sql: `
      CREATE TABLE IF NOT EXISTS property_knowledge (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        category    TEXT NOT NULL,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        is_active   BOOLEAN DEFAULT TRUE,
        sort_order  INT DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(property_id, category, key)
      );
      CREATE INDEX IF NOT EXISTS idx_property_knowledge_property ON property_knowledge(property_id);
      CREATE INDEX IF NOT EXISTS idx_property_knowledge_category ON property_knowledge(property_id, category);
      CREATE INDEX IF NOT EXISTS idx_property_knowledge_active   ON property_knowledge(property_id, is_active);
      CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
      RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON property_knowledge;
      CREATE TRIGGER trg_knowledge_updated_at BEFORE UPDATE ON property_knowledge FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();
    `
  }
];

export async function runPendingMigrations() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    // Silent skip — no DB URL configured, no auto-migrations
    return;
  }

  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    console.warn('[Migrations] pg package not available, skipping auto-migrations');
    return;
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('[Migrations] Connected to database');

    for (const migration of MIGRATIONS) {
      try {
        const { rows } = await client.query(migration.check);
        const alreadyExists = rows[0]?.exists;

        if (alreadyExists) {
          console.log(`[Migrations] ✅ ${migration.name} — ya aplicada`);
          continue;
        }

        console.log(`[Migrations] 🔄 Applying ${migration.name}...`);
        await client.query(migration.sql);
        console.log(`[Migrations] ✅ ${migration.name} — aplicada`);
      } catch (err) {
        console.error(`[Migrations] ❌ ${migration.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Migrations] DB connection error:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}
