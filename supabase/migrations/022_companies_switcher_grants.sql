-- 022: Ensure authenticated can read companies list via PostgREST
-- Symptom: company switcher shows no companies for invited/accountant users
-- because the client queries `company_memberships` with an embedded `organizations(*)`.

GRANT SELECT ON TABLE public.company_memberships TO authenticated;
GRANT SELECT ON TABLE public.organizations TO authenticated;

-- Service role should already have broad permissions, but make it explicit.
GRANT ALL ON TABLE public.company_memberships TO service_role;
GRANT ALL ON TABLE public.organizations TO service_role;

