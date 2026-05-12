-- ============================================================
-- 017: Fix invitations RLS — authenticated role cannot read auth.users
--
-- Symptom: POST /invitations?select=* → 403 (42501) even as org owner.
-- Cause: Policies used (SELECT email FROM auth.users WHERE id = auth.uid())
--        inside RLS. That subquery runs as the invoker (`authenticated`),
--        which has NO SELECT on auth.users — evaluation fails / denies.
--
-- INSERT itself can pass WITH CHECK, but PostgREST then runs RETURNING,
-- which applies SELECT policies — same broken expression → 403.
--
-- Fix: SECURITY DEFINER helper that reads auth.users as table owner.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email FROM auth.users AS u WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_auth_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_auth_email() TO authenticated;

DROP POLICY IF EXISTS invitations_select_invitee_or_member ON public.invitations;
DROP POLICY IF EXISTS invitations_insert_by_managers ON public.invitations;
DROP POLICY IF EXISTS invitations_update_by_managers ON public.invitations;
DROP POLICY IF EXISTS invitations_org ON public.invitations;
DROP POLICY IF EXISTS "invitations_org" ON public.invitations;

CREATE POLICY invitations_select_member_or_invitee ON public.invitations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = invitations.org_id
      AND cm.user_id = auth.uid()
  )
  OR lower(trim(invitations.email)) = lower(trim(public.current_auth_email()))
);

CREATE POLICY invitations_insert_by_managers ON public.invitations
FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = invitations.org_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'accountant')
  )
);

CREATE POLICY invitations_update_by_managers ON public.invitations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = invitations.org_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'accountant')
  )
  OR lower(trim(invitations.email)) = lower(trim(public.current_auth_email()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = invitations.org_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'accountant')
  )
  OR lower(trim(invitations.email)) = lower(trim(public.current_auth_email()))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invitations TO authenticated;
