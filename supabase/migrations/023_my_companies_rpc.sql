-- 023: RPC to list companies for current user
-- Reason: PostgREST embedded selects and RLS edge-cases can cause the company switcher
-- to show an empty list even when memberships exist. This RPC returns the same data
-- in one call, with row_security disabled to avoid policy recursion.

CREATE OR REPLACE FUNCTION public.my_companies()
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
  role public.user_role
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
    cm.role
  FROM public.company_memberships cm
  JOIN public.organizations o ON o.id = cm.org_id
  WHERE cm.user_id = auth.uid()
  ORDER BY cm.is_billing_owner DESC, cm.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.my_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_companies() TO service_role;

