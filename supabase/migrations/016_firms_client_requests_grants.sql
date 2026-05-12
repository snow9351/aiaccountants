-- ============================================================
-- 016: GRANT authenticated on firms + client_requests
--
-- Symptom: 403 on GET/POST /firms, /client_requests, /invitations
--          PostgREST error=42501 — role `authenticated` must have
--          table privileges; RLS alone is not enough.
--
-- Apply after 015 (or run both in order on hosted Supabase).
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.firms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_requests TO authenticated;

-- Idempotent reinforce (safe if 015 already ran)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invitations TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.users TO authenticated;

GRANT ALL ON TABLE public.firms TO service_role;
GRANT ALL ON TABLE public.client_requests TO service_role;
GRANT ALL ON TABLE public.invitations TO service_role;
GRANT ALL ON TABLE public.users TO service_role;
