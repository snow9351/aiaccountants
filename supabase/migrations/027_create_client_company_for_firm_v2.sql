-- 027: Update firm flow to use company setup auto-actions (COA + periods + equity)

CREATE OR REPLACE FUNCTION public.create_client_company_for_firm(
  p_name TEXT,
  p_entity_type TEXT,
  p_accounting_method TEXT,
  p_tax_id TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT 'general',
  p_fiscal_year_start_month INT DEFAULT 1,
  p_timezone TEXT DEFAULT 'America/New_York'
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
  v_entity TEXT := COALESCE(NULLIF(trim(p_entity_type), ''), 'llc');
  v_method TEXT := COALESCE(NULLIF(trim(p_accounting_method), ''), 'cash');
  v_industry TEXT := COALESCE(NULLIF(trim(p_industry), ''), 'general');
  v_tz TEXT := COALESCE(NULLIF(trim(p_timezone), ''), 'America/New_York');
  v_tax_id TEXT := NULLIF(trim(p_tax_id), '');
  v_start_month INT := GREATEST(1, LEAST(12, COALESCE(p_fiscal_year_start_month, 1)));
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

  INSERT INTO public.organizations (
    name,
    business_type,
    entity_type,
    accounting_method,
    fiscal_year_start,
    timezone,
    tax_id,
    base_currency,
    managed_by_firm_id,
    created_by
  )
  VALUES (
    trim(p_name),
    v_industry,
    v_entity,
    v_method,
    v_start_month,
    v_tz,
    v_tax_id,
    'USD',
    v_firm,
    v_user
  )
  RETURNING id INTO v_org;

  -- Membership for the firm owner as the accountant on the client workspace.
  INSERT INTO public.company_memberships (org_id, user_id, firm_id, role, is_billing_owner)
  VALUES (v_org, v_user, v_firm, 'accountant', false)
  ON CONFLICT DO NOTHING;

  -- Same post-create actions as owner flow.
  PERFORM public.generate_default_coa(v_org, v_entity);
  INSERT INTO public.accounts (org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active)
  VALUES (v_org, '3050', 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'credit', true, true)
  ON CONFLICT DO NOTHING;
  PERFORM public.seed_fiscal_periods(v_org, v_start_month, 2);

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

GRANT EXECUTE ON FUNCTION public.create_client_company_for_firm(TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT) TO authenticated;

