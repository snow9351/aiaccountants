-- 012: Fix 403 on POST /customers
-- Root cause: customers policy used current_org_id(), which can differ from active org
-- when the user belongs to multiple organizations.
-- Fix: scope access via company_memberships (org_id IN memberships for auth.uid()).

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_customers" ON public.customers;

CREATE POLICY "customers_org_memberships"
ON public.customers
FOR ALL
USING (
  org_id IN (
    SELECT cm.org_id
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT cm.org_id
    FROM public.company_memberships cm
    WHERE cm.user_id = auth.uid()
  )
);

-- Ensure PostgREST role has table privileges (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;

