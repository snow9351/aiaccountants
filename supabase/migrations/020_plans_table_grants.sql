-- 020: Allow PostgREST (anon + authenticated) to read public pricing plans
--
-- Symptom: GET /rest/v1/plans → 403 permission denied for table plans
--          Pricing page shows no plan cards.
-- RLS policy "plans_public_read" allows rows, but without table GRANT the API role cannot read.

GRANT SELECT ON TABLE public.plans TO anon, authenticated;
GRANT ALL ON TABLE public.plans TO service_role;
