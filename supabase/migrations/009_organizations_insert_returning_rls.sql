-- ============================================================
-- 009: Fix 403 on POST /organizations (INSERT ... RETURNING)
--
-- Cause: org_select only allows rows linked via company_memberships
-- (or current_org_id()). The app inserts the org first, then inserts
-- membership in a *second* HTTP call. PostgREST evaluates SELECT RLS on
-- the inserted row for RETURNING — no membership row exists yet → denied
-- (PostgreSQL error 42501 / "violates row-level security policy").
--
-- Fix: Track creator on organizations and allow SELECT when created_by =
-- auth.uid(). BEFORE INSERT defaults created_by from auth.uid().
-- Signup trigger (SECURITY DEFINER) sets created_by explicitly.
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.organizations_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_set_created_by ON public.organizations;
CREATE TRIGGER trg_organizations_set_created_by
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.organizations_set_created_by();

-- Best-effort backfill for existing rows (multi-owner: pick earliest joined owner)
UPDATE public.organizations o
SET created_by = sub.user_id
FROM (
  SELECT DISTINCT ON (cm.org_id)
    cm.org_id,
    cm.user_id
  FROM public.company_memberships cm
  WHERE cm.role = 'owner'
  ORDER BY cm.org_id, cm.joined_at ASC
) sub
WHERE o.id = sub.org_id
  AND o.created_by IS NULL;

DROP POLICY IF EXISTS "org_select" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = organizations.id
        AND cm.user_id = auth.uid()
    )
    OR id = public.current_org_id()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS org_insert_authenticated ON public.organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON public.organizations;
CREATE POLICY org_insert_authenticated
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by IS NOT NULL
    AND created_by = auth.uid()
  );

-- Keep signup-created orgs consistent (trigger bypasses RLS; explicit column avoids NULL creator)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.organizations (
    name,
    business_type,
    entity_type,
    accounting_method,
    created_by
  )
  VALUES (
    v_full_name || '''s Company',
    'general',
    'llc',
    'accrual',
    NEW.id
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.users (id, org_id, email, full_name, role)
  VALUES (NEW.id, v_org_id, NEW.email, v_full_name, 'admin');

  INSERT INTO public.company_memberships (org_id, user_id, role, is_billing_owner)
  VALUES (v_org_id, NEW.id, 'owner', true);

  PERFORM public.generate_default_coa(v_org_id, 'llc');

  UPDATE public.organizations
  SET
    plan = 'starter'::public.plan_name,
    subscription_status = 'trialing'::public.subscription_status,
    trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE id = v_org_id;

  RETURN NEW;
END;
$$;
