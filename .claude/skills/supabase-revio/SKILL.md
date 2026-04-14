---
name: supabase-revio
description: >
  Activar cuando se trabaja con la base de datos de Revio en Supabase:
  schema de tablas, queries, migraciones SQL, RLS policies, o cuando
  se necesita agregar/modificar tablas. Incluye el esquema completo
  actualizado con todas las migraciones hasta 009.
triggers:
  - "supabase"
  - "base de datos"
  - "tabla"
  - "migración"
  - "sql"
  - "query"
  - "schema"
version: 1.0.0
project: revio
---

# Supabase — Esquema Revio

## Credenciales
```env
SUPABASE_URL=https://apghalkivuvyhbmethxk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=✅ ACTUALIZADO (2026-04-04) — activo en Railway y producción
```

Dashboard SQL: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/editor
Settings API: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/settings/api

## Tablas principales

### tenants
```sql
id UUID PK
business_name TEXT
slug TEXT UNIQUE          -- "mistica-hostels"
contact_email TEXT UNIQUE
contact_phone TEXT
status TEXT               -- 'trial','active','suspended','cancelled'
plan_id UUID → tenant_plans
trial_ends_at TIMESTAMPTZ
billing_cycle TEXT        -- 'monthly','annual'
next_billing_date DATE
activated_at TIMESTAMPTZ
suspended_at TIMESTAMPTZ
wompi_subscription_id TEXT
wompi_customer_id TEXT
created_at TIMESTAMPTZ
```

### tenant_plans
```sql
id UUID PK
name TEXT                 -- 'Básico','Pro','Enterprise'
price_monthly BIGINT      -- en COP: 299000, 599000, 1199000
extra_property_price BIGINT  -- 149000, 249000, 399000
max_properties INT
max_users INT
features JSONB
is_active BOOLEAN
```

### properties
```sql
id UUID PK
tenant_id UUID → tenants
name TEXT                 -- "Mística Isla Palma"
slug TEXT UNIQUE          -- "mistica-isla-palma"
address TEXT
city TEXT
country TEXT DEFAULT 'CO'
timezone TEXT DEFAULT 'America/Bogota'
pms_type TEXT             -- 'lobbypms','cloudbeds','mews','custom'
pms_token TEXT            -- encriptado AES-256
pms_hotel_id TEXT
ai_provider TEXT          -- 'anthropic','openai','gemini','groq'
ai_model TEXT             -- 'claude-sonnet-4-6'
ai_api_key TEXT           -- encriptado AES-256
ai_system_prompt TEXT
ai_language TEXT DEFAULT 'es'
ai_tone TEXT DEFAULT 'friendly'
sales_intensity TEXT      -- 'soft','moderate','intense'
is_active BOOLEAN
created_at TIMESTAMPTZ
```

### users
```sql
id UUID PK
tenant_id UUID → tenants
property_id UUID → properties
email TEXT UNIQUE
password TEXT             -- plaintext (diseño actual)
name TEXT
role TEXT                 -- 'admin','manager','staff'
is_active BOOLEAN
created_at TIMESTAMPTZ
```

### conversations
```sql
id UUID PK
property_id UUID → properties
session_id TEXT
channel TEXT              -- 'widget','whatsapp','instagram','facebook'
guest_name TEXT
guest_phone TEXT
guest_email TEXT
status TEXT               -- 'active','escalated','closed'
language TEXT DEFAULT 'es'
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### messages
```sql
id UUID PK
conversation_id UUID → conversations
role TEXT                 -- 'user','assistant'
content TEXT
tokens_used INT
created_at TIMESTAMPTZ
```

### property_knowledge (migration_009)
```sql
id UUID PK
property_id UUID → properties
category TEXT             -- 'general','rooms','policies','activities','transport','faq','menu','contact','restrictions'
key TEXT                  -- 'nombre','descripcion','check_in', etc.
value TEXT
is_active BOOLEAN DEFAULT TRUE
sort_order INT DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(property_id, category, key)
```

### tenant_discounts (migration_008)
```sql
id UUID PK
tenant_id UUID → tenants
type TEXT                 -- 'percent_permanent','percent_temporary','trial_extension','plan_upgrade'
value NUMERIC
expires_at TIMESTAMPTZ
upgraded_plan_id UUID → tenant_plans
note TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

### landing_config (migration_008)
```sql
id UUID PK
key TEXT UNIQUE
value JSONB
updated_at TIMESTAMPTZ
```

### promo_codes (migration_008)
```sql
id UUID PK
code TEXT UNIQUE
discount_pct INT          -- 1-100
max_uses INT
used_count INT
expires_at TIMESTAMPTZ
is_active BOOLEAN
```

### tenant_usage
```sql
id UUID PK
tenant_id UUID
property_id UUID
date DATE
conversations_count INT
messages_count INT
tokens_used INT
estimated_cost_usd NUMERIC
```

### bookings
```sql
id UUID PK
property_id UUID
conversation_id UUID
pms_booking_id TEXT       -- ID en LobbyPMS
guest_name TEXT
guest_email TEXT
guest_phone TEXT
room_type TEXT
check_in DATE
check_out DATE
guests_count INT
total_amount BIGINT       -- en COP
currency TEXT DEFAULT 'COP'
payment_status TEXT       -- 'pending','paid','failed','refunded'
wompi_payment_id TEXT
status TEXT               -- 'pending','confirmed','cancelled'
created_at TIMESTAMPTZ
```

## Migraciones pendientes

```bash
# Ejecutar en: https://supabase.com/dashboard/project/apghalkivuvyhbmethxk/editor
# Archivo: backend/supabase/run_migrations_and_knowledge.sql
# Incluye: migration_008, migration_009 + knowledge base Mística
```

## Queries frecuentes

### Obtener conversaciones de hoy
```js
const { data } = await supabase
  .from('conversations')
  .select('*, messages(count)')
  .eq('property_id', propertyId)
  .gte('created_at', new Date().toISOString().split('T')[0]);
```

### Upsert knowledge base
```js
await supabase.from('property_knowledge').upsert({
  property_id: '67fbce21-1b88-449f-93e2-1226cda2a7fb',
  category: 'general',
  key: 'nombre',
  value: 'Mística Isla Palma Hostel'
}, { onConflict: 'property_id,category,key' });
```

### Guardar siempre validando con Array.isArray
```js
const { data, error } = await supabase.from('table').select('*');
if (error) throw error;
const items = Array.isArray(data) ? data : [];  // SIEMPRE
```

## IDs reales de Mística

```
Isla Palma property_id: 67fbce21-1b88-449f-93e2-1226cda2a7fb
Tayrona property_id:    148f7836-6fcf-4d06-8570-bd65fcc2ccf0
```
