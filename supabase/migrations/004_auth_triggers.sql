-- ============================================================
-- 004: Auth Triggers & User Onboarding
-- Auto-create organization, membership, and user profile on signup
-- ============================================================

-- ── Create user profile + default org on signup ─────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Create a default organization for the user
  INSERT INTO organizations (name, business_type, entity_type, accounting_method)
  VALUES (
    v_full_name || '''s Company',
    'general',
    'llc',
    'accrual'
  )
  RETURNING id INTO v_org_id;

  -- Create user profile in the users table
  INSERT INTO users (id, org_id, email, full_name, role)
  VALUES (NEW.id, v_org_id, NEW.email, v_full_name, 'admin');

  -- Create company membership (owner role)
  INSERT INTO company_memberships (org_id, user_id, role, is_billing_owner)
  VALUES (v_org_id, NEW.id, 'owner', true);

  -- Generate default chart of accounts
  PERFORM generate_default_coa(v_org_id, 'llc');

  -- Set trial subscription status on the org
  UPDATE organizations SET
    plan = 'starter',
    subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE id = v_org_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Update current_org_id() to use company_memberships ──────
-- This makes the RLS helper work with the multi-company model
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
BEGIN
  -- Use the first org the user belongs to (typically their default org)
  -- In practice, the app should pass org_id via RPC or filter
  RETURN (
    SELECT org_id
    FROM company_memberships
    WHERE user_id = auth.uid()
    ORDER BY is_billing_owner DESC, joined_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Handle invitation acceptance ────────────────────────────
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find valid invitation
  SELECT * INTO v_invite
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Create membership
  INSERT INTO company_memberships (org_id, user_id, firm_id, role, invited_by)
  VALUES (v_invite.org_id, v_user_id, v_invite.firm_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE invitations SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'org_id', v_invite.org_id,
    'role', v_invite.role,
    'accepted', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto-expire old invitations ─────────────────────────────
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Grant execute on RPC functions ──────────────────────────
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_default_coa(UUID, TEXT) TO authenticated;
