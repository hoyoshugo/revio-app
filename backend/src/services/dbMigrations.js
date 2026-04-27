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
  },
  {
    name: 'migration_010_webhook_events',
    check: `SELECT to_regclass('public.webhook_events') IS NOT NULL AS exists`,
    sql: `
      -- E-AGENT-10 B-AGT-1 (2026-04-26): tabla de idempotencia para webhooks.
      -- Evita procesar el mismo evento Meta/Wompi/LobbyPMS dos veces (causa
      -- de reservas duplicadas en producción).
      CREATE TABLE IF NOT EXISTS webhook_events (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider     TEXT NOT NULL,
        external_id  TEXT NOT NULL,
        received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payload      JSONB,
        UNIQUE(provider, external_id)
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_id ON webhook_events(provider, external_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_received    ON webhook_events(received_at DESC);

      -- TTL: limpiar events más viejos que 30 días para no crecer ilimitado.
      -- Llamar diario via cron job server-side.
      CREATE OR REPLACE FUNCTION cleanup_old_webhook_events() RETURNS void AS $$
        DELETE FROM webhook_events WHERE received_at < NOW() - INTERVAL '30 days';
      $$ LANGUAGE sql;
    `
  },
  {
    name: 'migration_012_increment_tenant_usage',
    check: `
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'increment_tenant_usage'
      ) AS exists
    `,
    sql: `
      -- E-AGENT-13 M5 (2026-04-26): atomic increment para tenant_usage.
      -- Antes el upsert SELECT-then-UPDATE sin transaction tenía race
      -- condition que causaba undercount de tokens en concurrent calls.
      CREATE OR REPLACE FUNCTION increment_tenant_usage(
        p_tenant_id    UUID,
        p_date         DATE,
        p_messages     INT,
        p_input_tokens INT,
        p_output_tokens INT,
        p_cost_usd     NUMERIC
      ) RETURNS void AS $$
        INSERT INTO tenant_usage (
          tenant_id, date, messages_count, api_calls_claude,
          claude_input_tokens, claude_output_tokens, estimated_cost_usd
        )
        VALUES (
          p_tenant_id, p_date, p_messages, 1,
          p_input_tokens, p_output_tokens, p_cost_usd
        )
        ON CONFLICT (tenant_id, date) DO UPDATE SET
          messages_count       = tenant_usage.messages_count + EXCLUDED.messages_count,
          api_calls_claude     = tenant_usage.api_calls_claude + 1,
          claude_input_tokens  = tenant_usage.claude_input_tokens + EXCLUDED.claude_input_tokens,
          claude_output_tokens = tenant_usage.claude_output_tokens + EXCLUDED.claude_output_tokens,
          estimated_cost_usd   = tenant_usage.estimated_cost_usd + EXCLUDED.estimated_cost_usd;
      $$ LANGUAGE sql;

      -- Asegurar UNIQUE constraint para que ON CONFLICT funcione
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tenant_usage_tenant_date_key'
        ) THEN
          ALTER TABLE tenant_usage
          ADD CONSTRAINT tenant_usage_tenant_date_key UNIQUE (tenant_id, date);
        END IF;
      END $$;
    `
  },
  {
    name: 'migration_011_tenant_escalation_phones',
    check: `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'escalation_phones'
      ) AS exists
    `,
    sql: `
      -- E-AGENT-10 H-AGT-2 (2026-04-26): per-tenant escalation team numbers.
      -- Antes hardcoded a +573057673770 / +573006526427 (Mística internal).
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS escalation_phones JSONB DEFAULT '[]'::jsonb;
      COMMENT ON COLUMN tenants.escalation_phones IS 'Array de números E.164 que reciben escalations IA del tenant';
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
