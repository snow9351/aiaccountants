-- 030: Feature 4 — Chart of Accounts foundation
-- - Canonical COA sub-types (CHECK), legacy sub_type backfill
-- - Optional account numbers + company toggle require_account_numbers
-- - Membership-based RLS on accounts (multi-company)
-- - merge_accounts RPC (repoint FKs, deactivate source)
-- - generate_default_coa by entity type + fs_section / is_reconcilable
-- - Dedupe Opening Balance Equity seed (handled inside generate_default_coa)

-- ─────────────────────────────────────────────────────────────
-- Organizations: optional account numbers (company-level)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS require_account_numbers BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.require_account_numbers IS
  'When false, accounts.account_number may be null; UI hides numbers.';

-- ─────────────────────────────────────────────────────────────
-- Accounts: nullable account_number + partial unique index
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.accounts
  ALTER COLUMN account_number DROP NOT NULL;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_org_id_account_number_key;

DROP INDEX IF EXISTS accounts_org_id_account_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_org_id_account_number_unique
  ON public.accounts (org_id, account_number)
  WHERE account_number IS NOT NULL AND btrim(account_number) <> '';

-- ─────────────────────────────────────────────────────────────
-- Backfill legacy sub_type text → Feature 4 canonical codes
-- ─────────────────────────────────────────────────────────────
UPDATE public.accounts a
SET sub_type = CASE lower(trim(COALESCE(a.sub_type, '')))
  WHEN 'opening_balance_equity' THEN 'opening_balance_equity'
  WHEN 'retained_earnings' THEN 'retained_earnings'
  WHEN 'distributions' THEN 'distributions'
  WHEN 'owners_equity' THEN 'owner_equity'
  WHEN 'paid_in_capital' THEN
    CASE
      WHEN lower(COALESCE(a.name, '')) LIKE '%additional%' THEN 'additional_paid_in_capital'
      WHEN lower(COALESCE(a.name, '')) LIKE '%stock%' OR a.account_number IN ('3000', '3100') THEN 'capital_stock'
      ELSE 'owner_equity'
    END
  WHEN 'current_asset' THEN
    CASE
      WHEN a.account_number = '1100' OR lower(COALESCE(a.name, '')) LIKE '%receivable%' THEN 'accounts_receivable'
      WHEN a.account_number = '1000' OR lower(COALESCE(a.name, '')) LIKE '%cash%' OR lower(COALESCE(a.name, '')) LIKE '%bank%' THEN 'bank'
      ELSE 'other_current_asset'
    END
  WHEN 'fixed_asset' THEN 'fixed_asset'
  WHEN 'current_liability' THEN
    CASE
      WHEN a.account_number = '2000' OR lower(COALESCE(a.name, '')) LIKE '%payable%' THEN 'accounts_payable'
      WHEN lower(COALESCE(a.name, '')) LIKE '%credit%card%' THEN 'credit_card'
      ELSE 'other_current_liability'
    END
  WHEN 'long_term_liability' THEN 'long_term_liability'
  WHEN 'operating_revenue' THEN 'sales'
  WHEN 'other_revenue' THEN 'other_income'
  WHEN 'cogs' THEN 'cogs'
  WHEN 'operating_expense' THEN
    CASE
      WHEN lower(COALESCE(a.name, '')) LIKE '%payroll%' OR a.account_number IN ('6000', '6100') THEN 'payroll'
      WHEN lower(COALESCE(a.name, '')) LIKE '%rent%' OR a.account_number = '6200' THEN 'rent'
      WHEN lower(COALESCE(a.name, '')) LIKE '%utilit%' OR a.account_number = '6300' THEN 'utilities'
      ELSE 'other_expense'
    END
  WHEN 'other_expense' THEN 'other_expense'
  ELSE NULL
END
WHERE sub_type IS NULL
   OR lower(trim(COALESCE(sub_type, ''))) IN (
        'opening_balance_equity', 'retained_earnings', 'distributions', 'owners_equity', 'paid_in_capital',
        'current_asset', 'fixed_asset', 'current_liability', 'long_term_liability',
        'operating_revenue', 'other_revenue', 'cogs', 'operating_expense', 'other_expense'
      );

-- Remaining / unknown → safe default by account type
UPDATE public.accounts a
SET sub_type = CASE a.type::text
  WHEN 'asset' THEN 'other_current_asset'
  WHEN 'liability' THEN 'other_current_liability'
  WHEN 'equity' THEN 'owner_equity'
  WHEN 'revenue' THEN 'uncategorized_income'
  WHEN 'expense' THEN 'uncategorized_expense'
  ELSE 'other_expense'
END
WHERE a.sub_type IS NULL
   OR trim(COALESCE(a.sub_type, '')) = ''
   OR lower(trim(a.sub_type)) NOT IN (
        'bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset',
        'accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability',
        'owner_equity', 'retained_earnings', 'opening_balance_equity', 'capital_stock', 'additional_paid_in_capital', 'distributions',
        'sales', 'other_income', 'uncategorized_income',
        'cogs', 'payroll', 'rent', 'utilities', 'other_expense', 'uncategorized_expense'
      );

ALTER TABLE public.accounts
  ALTER COLUMN sub_type SET NOT NULL;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_sub_type_allowed;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_sub_type_allowed CHECK (
    sub_type IN (
      'bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset',
      'accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability',
      'owner_equity', 'retained_earnings', 'opening_balance_equity', 'capital_stock', 'additional_paid_in_capital', 'distributions',
      'sales', 'other_income', 'uncategorized_income',
      'cogs', 'payroll', 'rent', 'utilities', 'other_expense', 'uncategorized_expense'
    )
  );

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_type_subtype_matrix;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_type_subtype_matrix CHECK (
    (type = 'asset' AND sub_type IN ('bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset'))
    OR (type = 'liability' AND sub_type IN ('accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability'))
    OR (type = 'equity' AND sub_type IN ('owner_equity', 'retained_earnings', 'opening_balance_equity', 'capital_stock', 'additional_paid_in_capital', 'distributions'))
    OR (type = 'revenue' AND sub_type IN ('sales', 'other_income', 'uncategorized_income'))
    OR (type = 'expense' AND sub_type IN ('cogs', 'payroll', 'rent', 'utilities', 'other_expense', 'uncategorized_expense'))
  );

COMMENT ON COLUMN public.accounts.sub_type IS
  'Feature 4 COA sub-type; must align with type (see accounts_type_subtype_matrix).';

-- ─────────────────────────────────────────────────────────────
-- merge_accounts: move references from A → B, deactivate A
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_accounts(
  p_org_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_to_name TEXT;
  v_to_num TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and target account must differ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = p_org_id AND cm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_from_account_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Source account not found in organization';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_to_account_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Target account not found in organization';
  END IF;

  SELECT name, COALESCE(account_number, '') INTO v_to_name, v_to_num
  FROM public.accounts WHERE id = p_to_account_id;

  UPDATE public.journal_entry_lines SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.invoice_line_items SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.bill_line_items SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.expenses SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.bank_accounts SET gl_account_id = p_to_account_id WHERE gl_account_id = p_from_account_id;
  UPDATE public.bank_transactions SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.bank_transactions SET suggested_account_id = p_to_account_id WHERE suggested_account_id = p_from_account_id;
  UPDATE public.budget_lines SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.forecast_lines SET account_id = p_to_account_id WHERE account_id = p_from_account_id;
  UPDATE public.categorization_rules
  SET target_account_id = p_to_account_id, target_account_name = v_to_name
  WHERE target_account_id = p_from_account_id AND org_id = p_org_id;
  UPDATE public.accruals
  SET account_id = p_to_account_id, account_name = v_to_name
  WHERE account_id = p_from_account_id AND org_id = p_org_id;
  UPDATE public.gl_account_tax_mappings SET account_id = p_to_account_id WHERE account_id = p_from_account_id AND org_id = p_org_id;
  UPDATE public.ai_categorization_signals SET suggested_account_id = p_to_account_id WHERE suggested_account_id = p_from_account_id AND org_id = p_org_id;
  UPDATE public.ai_categorization_signals SET confirmed_account_id = p_to_account_id WHERE confirmed_account_id = p_from_account_id AND org_id = p_org_id;

  UPDATE public.accounts SET parent_id = p_to_account_id WHERE parent_id = p_from_account_id AND org_id = p_org_id;

  UPDATE public.accounts
  SET is_active = false, name = name || ' (merged)', updated_at = NOW()
  WHERE id = p_from_account_id AND org_id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_accounts(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_accounts(UUID, UUID, UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Accounts RLS: any org membership (matches company switcher)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS org_all_accounts ON public.accounts;
DROP POLICY IF EXISTS "org_all_accounts" ON public.accounts;

CREATE POLICY accounts_org_member_select
  ON public.accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = accounts.org_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY accounts_org_member_insert
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = accounts.org_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY accounts_org_member_update
  ON public.accounts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = accounts.org_id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = accounts.org_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY accounts_org_member_delete
  ON public.accounts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = accounts.org_id AND cm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- my_companies: expose require_account_numbers
-- (DROP required: OUT/RETURNS TABLE shape cannot change via CREATE OR REPLACE.)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.my_companies();

CREATE FUNCTION public.my_companies()
RETURNS TABLE (
  id UUID,
  name TEXT,
  entity_type TEXT,
  accounting_method TEXT,
  fiscal_year_start INT,
  timezone TEXT,
  tax_id TEXT,
  plan public.plan_name,
  subscription_status public.subscription_status,
  trial_ends_at TIMESTAMPTZ,
  logo_url TEXT,
  role public.user_role,
  require_account_numbers BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    o.id,
    o.name,
    o.entity_type,
    o.accounting_method,
    o.fiscal_year_start,
    o.timezone,
    o.tax_id,
    o.plan,
    o.subscription_status,
    o.trial_ends_at,
    o.logo_url,
    cm.role,
    o.require_account_numbers
  FROM public.company_memberships cm
  JOIN public.organizations o ON o.id = cm.org_id
  WHERE cm.user_id = auth.uid()
  ORDER BY cm.is_billing_owner DESC, cm.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.my_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_companies() TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Default COA (entity-aware) + Opening Balance Equity
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_default_coa(p_org_id UUID, p_entity_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity TEXT := lower(trim(COALESCE(p_entity_type, 'llc')));
BEGIN
  -- Core operating accounts (shared)
  INSERT INTO public.accounts (
    org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active, fs_section, is_reconcilable
  ) VALUES
    (p_org_id, '1000', 'Cash & Cash Equivalents', 'asset', 'bank', 'debit', true, true, 'current_assets', true),
    (p_org_id, '1100', 'Accounts Receivable', 'asset', 'accounts_receivable', 'debit', true, true, 'current_assets', true),
    (p_org_id, '1200', 'Inventory', 'asset', 'other_current_asset', 'debit', true, true, 'current_assets', false),
    (p_org_id, '1300', 'Prepaid Expenses', 'asset', 'other_current_asset', 'debit', true, true, 'current_assets', false),
    (p_org_id, '1500', 'Fixed Assets', 'asset', 'fixed_asset', 'debit', true, true, 'fixed_assets', false),
    (p_org_id, '1510', 'Accumulated Depreciation', 'asset', 'fixed_asset', 'credit', true, true, 'fixed_assets', false),
    (p_org_id, '2000', 'Accounts Payable', 'liability', 'accounts_payable', 'credit', true, true, 'current_liabilities', true),
    (p_org_id, '2050', 'Credit Cards Payable', 'liability', 'credit_card', 'credit', true, true, 'current_liabilities', true),
    (p_org_id, '2100', 'Accrued Liabilities', 'liability', 'other_current_liability', 'credit', true, true, 'current_liabilities', false),
    (p_org_id, '2200', 'Sales Tax Payable', 'liability', 'other_current_liability', 'credit', true, true, 'current_liabilities', false),
    (p_org_id, '2300', 'Payroll Liabilities', 'liability', 'other_current_liability', 'credit', true, true, 'current_liabilities', false),
    (p_org_id, '2900', 'Long-Term Debt', 'liability', 'long_term_liability', 'credit', true, true, 'long_term_liabilities', false),
    (p_org_id, '4000', 'Sales Revenue', 'revenue', 'sales', 'credit', true, true, 'revenue', false),
    (p_org_id, '4100', 'Service Revenue', 'revenue', 'sales', 'credit', true, true, 'revenue', false),
    (p_org_id, '4200', 'Product Revenue', 'revenue', 'sales', 'credit', true, true, 'revenue', false),
    (p_org_id, '4900', 'Other Income', 'revenue', 'other_income', 'credit', true, true, 'other_income', false),
    (p_org_id, '4950', 'Uncategorized Income', 'revenue', 'uncategorized_income', 'credit', true, true, 'revenue', false),
    (p_org_id, '5000', 'Cost of Goods Sold', 'expense', 'cogs', 'debit', true, true, 'cogs', false),
    (p_org_id, '6000', 'Payroll & Wages', 'expense', 'payroll', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6100', 'Payroll Taxes', 'expense', 'payroll', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6200', 'Rent & Lease', 'expense', 'rent', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6300', 'Utilities', 'expense', 'utilities', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6400', 'Software & Subscriptions', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6500', 'Marketing & Advertising', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6600', 'Travel & Entertainment', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6700', 'Professional Services', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6800', 'Insurance', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '6900', 'Depreciation', 'expense', 'other_expense', 'debit', true, true, 'operating_expenses', false),
    (p_org_id, '7000', 'Interest Expense', 'expense', 'other_expense', 'debit', true, true, 'other_expenses', false),
    (p_org_id, '7100', 'Other Expenses', 'expense', 'other_expense', 'debit', true, true, 'other_expenses', false),
    (p_org_id, '7150', 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'debit', true, true, 'operating_expenses', false)
  ON CONFLICT (org_id, account_number) WHERE account_number IS NOT NULL AND btrim(account_number) <> '' DO NOTHING;

  -- Equity by entity structure
  IF v_entity IN ('sole_prop', 'llc', 'partnership', 'nonprofit') THEN
    INSERT INTO public.accounts (
      org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active, fs_section, is_reconcilable
    ) VALUES
      (p_org_id, '3000',
        CASE WHEN v_entity = 'nonprofit' THEN 'Net Assets — Unrestricted' ELSE 'Owner''s Equity' END,
        'equity', 'owner_equity', 'credit', true, true, 'equity', false),
      (p_org_id, '3100',
        CASE WHEN v_entity = 'nonprofit' THEN 'Net Assets — Restricted' ELSE 'Owner''s Draw' END,
        'equity', 'owner_equity', 'debit', true, true, 'equity', false),
      (p_org_id, '3900', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, true, 'equity', false),
      (p_org_id, '3050', 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'credit', true, true, 'equity', false)
    ON CONFLICT (org_id, account_number) WHERE account_number IS NOT NULL AND btrim(account_number) <> '' DO NOTHING;
  ELSE
    -- S-Corp / C-Corp (and default corporate)
    INSERT INTO public.accounts (
      org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active, fs_section, is_reconcilable
    ) VALUES
      (p_org_id, '3000', 'Common Stock', 'equity', 'capital_stock', 'credit', true, true, 'equity', false),
      (p_org_id, '3100', 'Additional Paid-In Capital', 'equity', 'additional_paid_in_capital', 'credit', true, true, 'equity', false),
      (p_org_id, '3900', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, true, 'equity', false),
      (p_org_id, '3950', 'Distributions / Dividends', 'equity', 'distributions', 'debit', true, true, 'equity', false),
      (p_org_id, '3050', 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'credit', true, true, 'equity', false)
    ON CONFLICT (org_id, account_number) WHERE account_number IS NOT NULL AND btrim(account_number) <> '' DO NOTHING;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Company creation RPCs: remove duplicate OBE insert (COA includes 3050)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_company(
  p_legal_name TEXT,
  p_tax_id TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT 'llc',
  p_accounting_method TEXT DEFAULT 'cash',
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

  INSERT INTO public.organizations (
    name,
    business_type,
    entity_type,
    accounting_method,
    fiscal_year_start,
    timezone,
    tax_id,
    base_currency,
    created_by
  )
  VALUES (
    trim(p_legal_name),
    v_industry,
    v_entity,
    v_method,
    v_start_month,
    v_tz,
    v_tax_id,
    'USD',
    v_user
  )
  RETURNING id INTO v_org;

  INSERT INTO public.company_memberships (org_id, user_id, role, is_billing_owner)
  VALUES (v_org, v_user, 'owner', true)
  ON CONFLICT DO NOTHING;

  PERFORM public.generate_default_coa(v_org, v_entity);
  PERFORM public.seed_fiscal_periods(v_org, v_start_month, 2);

  RETURN v_org;
END;
$$;

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

  INSERT INTO public.company_memberships (org_id, user_id, firm_id, role, is_billing_owner)
  VALUES (v_org, v_user, v_firm, 'accountant', false)
  ON CONFLICT DO NOTHING;

  PERFORM public.generate_default_coa(v_org, v_entity);
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

ALTER FUNCTION public.generate_default_coa(uuid, text) SET search_path = public;
ALTER FUNCTION public.merge_accounts(uuid, uuid, uuid) SET search_path = public;
