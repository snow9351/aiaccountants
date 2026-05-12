-- 018: Team list — see teammates in the same org (and your own rows), without RLS recursion
--
-- A SELECT policy on company_memberships must NOT subquery company_memberships directly:
-- Postgres reports "infinite recursion detected in policy for relation company_memberships".
--
-- Fix: SECURITY DEFINER helper reads org_ids for auth.uid() with row_security disabled
-- inside the function only; the policy then uses that set.

DROP POLICY IF EXISTS cm_select_self ON public.company_memberships;
DROP POLICY IF EXISTS cm_select_org_teammates ON public.company_memberships;
DROP POLICY IF EXISTS cm_select_self_and_teammates ON public.company_memberships;

CREATE OR REPLACE FUNCTION public.auth_org_ids_for_current_user()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT cm.org_id
  FROM public.company_memberships cm
  WHERE cm.user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_org_ids_for_current_user() IS
  'Org IDs the current user belongs to; used by company_memberships RLS to avoid recursive policy subqueries.';

GRANT EXECUTE ON FUNCTION public.auth_org_ids_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_org_ids_for_current_user() TO service_role;

CREATE POLICY cm_select_self_and_teammates
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (SELECT public.auth_org_ids_for_current_user())
  );
