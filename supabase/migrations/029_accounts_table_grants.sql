-- 029: Allow PostgREST roles to access accounts (RLS already enforces org isolation)
-- Symptom: GET /rest/v1/accounts → 403 permission denied for table accounts

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounts TO authenticated;
GRANT SELECT ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO service_role;

