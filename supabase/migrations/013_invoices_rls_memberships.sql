-- 013: Fix 403 on POST /invoices
-- Root cause: invoices policy used current_org_id(), which can differ from active org
-- when the user belongs to multiple organizations.
-- Fix: scope access via company_memberships (org_id IN memberships for auth.uid()).

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_invoices" ON public.invoices;

CREATE POLICY "invoices_org_memberships"
ON public.invoices
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;

