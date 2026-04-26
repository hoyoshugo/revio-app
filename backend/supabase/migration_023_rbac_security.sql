-- migration_023_rbac_security.sql
-- E-AGENT-1: Seguridad + RBAC.
--
-- 1. Marca password_hash como hashed con bcrypt (column nueva: password_hash_version)
--    para detectar passwords plaintext legacy y rehashearlos al primer login.
-- 2. Crea tabla `tenant_members` para multi-tenant membership con role.
-- 3. Crea tabla `rbac_audit_log` para auditar invitaciones, role changes, deletes.
-- 4. Migra membresias existentes de `users.property_id` -> `tenant_members.role`.
-- 5. RLS sobre tenant_members (un user solo ve sus propias filas).
-- 6. Backfill: cada user existente queda como 'admin' del tenant de su property.
--
-- IDEMPOTENTE: usa IF NOT EXISTS / ON CONFLICT en todas las operaciones.
-- Ejecutar via Supabase SQL Editor o psql.

-- ============================================================
-- PARTE 1: password hashing version tracking
-- ============================================================

-- 0 = plaintext legacy, 1 = bcrypt v1 (10 rounds)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash_version SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Marcar todos los registros actuales como version 0 (plaintext) para que el
-- middleware sepa que tiene que rehashearlos al primer login exitoso.
UPDATE public.users SET password_hash_version = 0 WHERE password_hash_version IS NULL;

-- ============================================================
-- PARTE 2: tenant_members
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_role') THEN
    CREATE TYPE public.tenant_role AS ENUM (
      'owner',         -- crea el tenant; full control + billing
      'admin',         -- todo excepto borrar el tenant
      'manager',       -- crud users staff, no billing
      'operator',      -- ops diarias (escalations, knowledge, monitor)
      'viewer'         -- solo lectura
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_email TEXT,
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  invite_accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_invite_token ON public.tenant_members(invite_token) WHERE invite_token IS NOT NULL;

-- ============================================================
-- PARTE 3: rbac_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rbac_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                    -- 'invite' | 'accept_invite' | 'role_change' | 'deactivate' | 'delete' | 'reset_password' | 'change_password'
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_tenant ON public.rbac_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON public.rbac_audit_log(target_user_id, created_at DESC);

-- ============================================================
-- PARTE 4: backfill - cada users.property_id -> tenant_members
-- ============================================================

-- Un user con property_id => crear tenant_member como 'admin' del tenant de esa property.
INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active, created_at)
SELECT DISTINCT
  p.tenant_id,
  u.id AS user_id,
  CASE
    WHEN u.role = 'super_admin' THEN 'admin'::public.tenant_role
    WHEN u.role IN ('admin', 'manager', 'owner') THEN u.role::public.tenant_role
    WHEN u.role = 'staff' OR u.role = 'receptionist' THEN 'operator'::public.tenant_role
    WHEN u.role = 'marketing' THEN 'operator'::public.tenant_role
    WHEN u.role = 'readonly' THEN 'viewer'::public.tenant_role
    ELSE 'viewer'::public.tenant_role
  END AS role,
  COALESCE(u.is_active, true) AS is_active,
  COALESCE(u.created_at, now()) AS created_at
FROM public.users u
JOIN public.properties p ON p.id = u.property_id
WHERE p.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ============================================================
-- PARTE 5: RLS sobre tenant_members
-- ============================================================

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_own_rows" ON public.tenant_members;
CREATE POLICY "members_read_own_rows" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_full_access" ON public.tenant_members;
CREATE POLICY "service_role_full_access" ON public.tenant_members
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- PARTE 6: RLS sobre rbac_audit_log
-- ============================================================

ALTER TABLE public.rbac_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_read_own_tenant" ON public.rbac_audit_log;
CREATE POLICY "audit_read_own_tenant" ON public.rbac_audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "audit_service_role_full" ON public.rbac_audit_log;
CREATE POLICY "audit_service_role_full" ON public.rbac_audit_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- PARTE 7: trigger updated_at en tenant_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_members_updated ON public.tenant_members;
CREATE TRIGGER trg_tenant_members_updated
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DONE
-- ============================================================
-- Verificar:
--   SELECT count(*) FROM public.tenant_members;
--   SELECT password_hash_version, count(*) FROM public.users GROUP BY 1;
