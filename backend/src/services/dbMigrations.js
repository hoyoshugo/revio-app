/**
 * dbMigrations.js — Auto-migrations on startup
 * Uses SUPABASE_DB_URL (Postgres direct connection) if available.
 * Runs only when the env var is set; silently skips otherwise.
 *
 * Required Railway env var:
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
 *   (Get from: Supabase dashboard → Settings → Database → Connection string → URI)
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

const KNOWLEDGE_DATA = [
  // Mística Isla Palma
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'general', key: 'nombre', value: 'Mistica Isla Palma Hostel', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'general', key: 'descripcion', value: 'Hostel ecologico en la Isla Palma, Bolivar, Colombia. Isla privada rodeada de arrecifes de coral y playa.', sort_order: 2 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'general', key: 'ubicacion', value: 'Isla Palma, Bahia de Barbacoas, Bolivar, Colombia. Solo acceso por lancha.', sort_order: 3 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'general', key: 'whatsapp', value: '+573234392420', sort_order: 4 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'rooms', key: 'tipos', value: 'Dormitorios mixtos (dorms), habitaciones privadas con bano, cabanas sobre el mar', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'rooms', key: 'restriccion_ninos', value: 'No se permiten ninos menores de 7 anos', sort_order: 2 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'policies', key: 'check_in', value: 'Check-in desde las 3:00 PM', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'policies', key: 'check_out', value: 'Check-out hasta las 11:00 AM', sort_order: 2 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'policies', key: 'cancelacion', value: 'Cancelacion gratuita hasta 7 dias antes. Cancelaciones tardias sin reembolso.', sort_order: 3 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'activities', key: 'incluidas', value: 'Snorkeling en arrecife de coral, kayak, paddleboard, senderismo por la isla, fogatas nocturnas', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'transport', key: 'como_llegar', value: 'Via Cartagena: lancha privada desde muelle Bazurto o La Bodeguita. Tambien desde Tolu y Covenas.', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'transport', key: 'tiempo_viaje', value: '45-90 minutos en lancha segun punto de partida', sort_order: 2 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'faq', key: 'wifi', value: 'WiFi limitado. Isla con conectividad reducida por ubicacion remota.', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'contact', key: 'whatsapp', value: '+573234392420', sort_order: 1 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'contact', key: 'horario_atencion', value: '7:00 AM - 10:00 PM', sort_order: 2 },
  { property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb', category: 'restrictions', key: 'ninos', value: 'No se admiten menores de 7 anos', sort_order: 1 },
  // Mística Tayrona
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'general', key: 'nombre', value: 'Mistica Tayrona Hostel', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'general', key: 'descripcion', value: 'Hostel boutique en las inmediaciones del Parque Nacional Natural Tayrona, Santa Marta, Colombia.', sort_order: 2 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'general', key: 'ubicacion', value: 'Via al Tayrona, Santa Marta, Magdalena, Colombia.', sort_order: 3 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'general', key: 'whatsapp', value: '+573234392420', sort_order: 4 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'rooms', key: 'tipos', value: 'Dormitorios mixtos, habitaciones privadas, habitaciones con vista a la naturaleza', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'policies', key: 'check_in', value: 'Check-in desde las 3:00 PM', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'policies', key: 'check_out', value: 'Check-out hasta las 11:00 AM', sort_order: 2 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'activities', key: 'incluidas', value: 'Acceso al sendero hacia el Parque Tayrona, zona social, hamacas', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'transport', key: 'como_llegar', value: 'Desde Santa Marta: bus o taxi hacia el Parque Tayrona, aprox. 45 minutos.', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'transport', key: 'desde_aeropuerto', value: 'Aeropuerto Simon Bolivar (SMR) a 1 hora en taxi.', sort_order: 2 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'contact', key: 'whatsapp', value: '+573234392420', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'restrictions', key: 'ninos', value: 'No se admiten menores de 7 anos', sort_order: 1 },
  { property_id: '148f7836-6fcf-4d06-8570-bd65fcc2ccf0', category: 'restrictions', key: 'parque', value: 'El Parque Tayrona tiene restricciones de acceso y cupos diarios propios', sort_order: 2 },
];

export async function runPendingMigrations() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    // Silent skip — no DB URL configured
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

        // Insert knowledge base data after creating the table
        if (migration.name === 'migration_009_property_knowledge') {
          await seedKnowledgeBase(client);
        }
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

async function seedKnowledgeBase(client) {
  console.log('[Migrations] Seeding knowledge base...');
  let inserted = 0;
  for (const row of KNOWLEDGE_DATA) {
    try {
      await client.query(
        `INSERT INTO property_knowledge (property_id, category, key, value, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (property_id, category, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [row.property_id, row.category, row.key, row.value, row.sort_order]
      );
      inserted++;
    } catch (err) {
      console.error('[Migrations] Seed error:', err.message);
    }
  }
  console.log(`[Migrations] ✅ Knowledge base: ${inserted}/${KNOWLEDGE_DATA.length} rows seeded`);
}
