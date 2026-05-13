-- 026: Company / Organization Setup (Feature 3)
-- - Adds fiscal periods table + seeding
-- - Adds create_company RPC that writes required org fields and runs post-create actions atomically
-- - Ensures an Opening Balance Equity account exists

-- ─────────────────────────────────────────────────────────────
-- Periods table (fiscal periods)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, fiscal_year, period_number)
);

ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS periods_select ON public.periods;
CREATE POLICY periods_select ON public.periods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.org_id = periods.org_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS periods_insert ON public.periods;
CREATE POLICY periods_insert ON public.periods
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS periods_update ON public.periods;
CREATE POLICY periods_update ON public.periods
  FOR UPDATE
  TO authenticated
  USING (false);

GRANT SELECT ON TABLE public.periods TO anon, authenticated;
GRANT ALL ON TABLE public.periods TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Seed fiscal periods
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_fiscal_periods(
  p_org_id UUID,
  p_fiscal_year_start_month INT DEFAULT 1,
  p_years_ahead INT DEFAULT 2
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_month INT := GREATEST(1, LEAST(12, COALESCE(p_fiscal_year_start_month, 1)));
  v_year INT;
  v_fy_start DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_period INT;
BEGIN
  -- Seed current FY and a small horizon forward.
  -- FY "year" is the calendar year of its start date.
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  FOR v_year IN v_year..(v_year + GREATEST(0, COALESCE(p_years_ahead, 0))) LOOP
    v_fy_start := make_date(v_year, v_start_month, 1);

    FOR v_period IN 1..12 LOOP
      v_period_start := (v_fy_start + ((v_period - 1) || ' months')::interval)::date;
      v_period_end := ((v_period_start + interval '1 month') - interval '1 day')::date;

      INSERT INTO public.periods (org_id, fiscal_year, period_number, period_start, period_end)
      VALUES (p_org_id, v_year, v_period, v_period_start, v_period_end)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_fiscal_periods(UUID, INT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Company creation RPC (atomic: org + membership + COA + equity + periods)
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

  -- Default Chart of Accounts based on entity type.
  PERFORM public.generate_default_coa(v_org, v_entity);

  -- Opening Balance Equity account (system).
  INSERT INTO public.accounts (org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active)
  VALUES (v_org, '3050', 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'credit', true, true)
  ON CONFLICT DO NOTHING;

  -- Fiscal periods
  PERFORM public.seed_fiscal_periods(v_org, v_start_month, 2);

  RETURN v_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company(TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT) TO authenticated;

