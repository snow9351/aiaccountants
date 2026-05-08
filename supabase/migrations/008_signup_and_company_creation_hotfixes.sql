-- ============================================================
-- 008: Signup + Company Creation Hotfixes (hosted DB parity)
-- Fixes discovered from production logs:
-- - Signup 500 on auth trigger (search_path / enum assignment)
-- - Missing payment_terms table on partial DBs
-- - 403 on organizations insert (RLS)
-- ============================================================

-- Ensure core dependency table exists for org seeding trigger.
CREATE TABLE IF NOT EXISTS public.payment_terms (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_due INT NOT NULL DEFAULT 30,
  discount_percent NUMERIC(5,2),
  discount_days INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate signup trigger function with schema-qualified references and enum-safe casts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

  INSERT INTO public.organizations (name, business_type, entity_type, accounting_method)
  VALUES (
    v_full_name || '''s Company',
    'general',
    'llc',
    'accrual'
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

-- Ensure SECURITY DEFINER functions resolve to public schema consistently.
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.seed_new_org_data() SET search_path = public;
ALTER FUNCTION public.current_org_id() SET search_path = public;
ALTER FUNCTION public.accept_invitation(TEXT) SET search_path = public;
ALTER FUNCTION public.expire_old_invitations() SET search_path = public;

-- Ensure auth.users trigger points to the latest function definition.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: allow authenticated users to create organizations.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_insert_authenticated ON public.organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON public.organizations;
CREATE POLICY org_insert_authenticated
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: make sure users can insert/read their own memberships.
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_insert_self ON public.company_memberships;
CREATE POLICY cm_insert_self
  ON public.company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cm_select_self ON public.company_memberships;
CREATE POLICY cm_select_self
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
