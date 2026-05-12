-- ============================================================
-- 015: GRANT authenticated access to public.users + invitations
--
-- Symptom: GET /rest/v1/users → 403 / "permission denied for table users"
-- Cause: RLS alone does not grant table privileges; PostgREST uses role
--        `authenticated`, which must have SELECT (and writers INSERT/UPDATE).
-- ============================================================

GRANT SELECT, UPDATE ON TABLE public.users TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.invitations TO authenticated;

-- Keep service_role full access (Supabase default pattern)
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.invitations TO service_role;
