-- ============================================================
-- 014: Two-sided invites, firm/client companies, onboarding branches
-- ============================================================

-- Firm optional EIN (stored like org tax_id)
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS ein TEXT;

-- Client bookkeeping entities managed by a firm (nullable = standalone company)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS managed_by_firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_managed_by_firm ON public.organizations(managed_by_firm_id);

-- users.org_id can be unset until a workspace is claimed (invite / accountant-only signup)
ALTER TABLE public.users ALTER COLUMN org_id DROP NOT NULL;

-- ------------------------------------------------------------------
-- Peer visibility: teammates in the same organization can see profile rows
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL AND org_id IN (
      SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_memberships cm_self
      INNER JOIN public.company_memberships cm_peer
        ON cm_self.org_id = cm_peer.org_id
      WHERE cm_self.user_id = auth.uid()
        AND cm_peer.user_id = users.id
    )
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------
-- Invitations: replace broad policy with membership-aware rules
-- ------------------------------------------------------------------
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_org ON public.invitations;

CREATE POLICY invitations_select_invitee_or_member ON public.invitations FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = invitations.org_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY invitations_insert_by_managers ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = invitations.org_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'accountant')
    )
  );

CREATE POLICY invitations_update_by_managers ON public.invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = invitations.org_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'accountant')
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ------------------------------------------------------------------
-- Signup / onboarding (business vs accountant vs invite-only)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
  v_onboarding TEXT;
  v_skip_workspace TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_onboarding := COALESCE(NEW.raw_user_meta_data->>'onboarding', 'business');
  v_skip_workspace := COALESCE(NEW.raw_user_meta_data->>'skip_default_workspace', 'false');

  IF v_skip_workspace = 'true' THEN
    INSERT INTO public.users (id, org_id, email, full_name, role)
    VALUES (NEW.id, NULL, NEW.email, v_full_name, 'admin');
    RETURN NEW;
  END IF;

  IF v_onboarding = 'accountant' THEN
    INSERT INTO public.firms (name, owner_id, ein)
    VALUES (
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'firm_name'), ''), v_full_name || '''s Firm'),
      NEW.id,
      NULLIF(trim(NEW.raw_user_meta_data->>'firm_ein'), '')
    );

    INSERT INTO public.users (id, org_id, email, full_name, role)
    VALUES (NEW.id, NULL, NEW.email, v_full_name, 'admin');
    RETURN NEW;
  END IF;

  INSERT INTO public.organizations (name, business_type, entity_type, accounting_method, created_by)
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

ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- ------------------------------------------------------------------
-- Accept invitation: attach accountant's firm when owner invited them (firm_id was null)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_resolved_firm_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  v_resolved_firm_id := v_invite.firm_id;
  IF v_resolved_firm_id IS NULL THEN
    SELECT f.id INTO v_resolved_firm_id
    FROM public.firms f
    WHERE f.owner_id = v_user_id
    ORDER BY f.created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.company_memberships (org_id, user_id, firm_id, role, invited_by, is_billing_owner)
  VALUES (
    v_invite.org_id,
    v_user_id,
    v_resolved_firm_id,
    v_invite.role,
    v_invite.invited_by,
    CASE WHEN v_invite.role = 'owner' THEN true ELSE false END
  )
  ON CONFLICT (org_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    firm_id = COALESCE(EXCLUDED.firm_id, public.company_memberships.firm_id),
    invited_by = COALESCE(public.company_memberships.invited_by, EXCLUDED.invited_by),
    is_billing_owner = CASE
      WHEN EXCLUDED.role = 'owner' THEN true
      ELSE public.company_memberships.is_billing_owner
    END;

  UPDATE public.invitations SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invite.id;

  UPDATE public.users u SET org_id = v_invite.org_id
  WHERE u.id = v_user_id AND u.org_id IS NULL;

  RETURN jsonb_build_object(
    'org_id', v_invite.org_id,
    'role', v_invite.role,
    'accepted', true
  );
END;
$$;

ALTER FUNCTION public.accept_invitation(TEXT) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- ------------------------------------------------------------------
-- Accountant: create a client company ledger under a firm you own
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_client_company_for_firm(
  p_name TEXT,
  p_entity_type TEXT,
  p_accounting_method TEXT,
  p_tax_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_firm UUID;
  v_org UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.id INTO v_firm
  FROM public.firms f
  WHERE f.owner_id = v_user
  ORDER BY f.created_at ASC
  LIMIT 1;

  IF v_firm IS NULL THEN
    RAISE EXCEPTION 'No firm found for this user';
  END IF;

  INSERT INTO public.organizations (name, business_type, entity_type, accounting_method, tax_id, managed_by_firm_id)
  VALUES (
    trim(p_name),
    'general',
    COALESCE(NULLIF(trim(p_entity_type), ''), 'llc'),
    COALESCE(NULLIF(trim(p_accounting_method), ''), 'accrual'),
    NULLIF(trim(p_tax_id), ''),
    v_firm
  )
  RETURNING id INTO v_org;

  INSERT INTO public.company_memberships (org_id, user_id, firm_id, role, is_billing_owner)
  VALUES (v_org, v_user, v_firm, 'accountant', false);

  PERFORM public.generate_default_coa(v_org, COALESCE(NULLIF(trim(p_entity_type), ''), 'llc'));

  UPDATE public.organizations SET
    plan = 'starter'::public.plan_name,
    subscription_status = 'trialing'::public.subscription_status,
    trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE id = v_org;

  UPDATE public.users SET org_id = COALESCE(org_id, v_org)
  WHERE id = v_user AND org_id IS NULL;

  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_company_for_firm(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Preview invite on landing page (no auth required)
CREATE OR REPLACE FUNCTION public.peek_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSONB;
BEGIN
  SELECT jsonb_build_object(
    'company_name', o.name,
    'role', i.role,
    'expires_at', i.expires_at
  )
  INTO r
  FROM public.invitations i
  LEFT JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > NOW()
  LIMIT 1;

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_invitation(TEXT) TO anon, authenticated;
