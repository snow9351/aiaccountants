-- Fix 403 "permission denied for table bills"
-- Cause: no GRANT to `authenticated`, and RLS used current_org_id() instead of company_memberships.

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_bills" ON public.bills;
DROP POLICY IF EXISTS "org_all_bill_lines" ON public.bill_line_items;
DROP POLICY IF EXISTS "org_all_bill_pmts" ON public.bill_payments;

CREATE POLICY bills_org_memberships ON public.bills
FOR ALL
USING (
  org_id IN (
    SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY bill_lines_org_memberships ON public.bill_line_items
FOR ALL
USING (
  bill_id IN (
    SELECT b.id FROM public.bills b
    INNER JOIN public.company_memberships cm ON cm.org_id = b.org_id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  bill_id IN (
    SELECT b.id FROM public.bills b
    INNER JOIN public.company_memberships cm ON cm.org_id = b.org_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY bill_payments_org_memberships ON public.bill_payments
FOR ALL
USING (
  bill_id IN (
    SELECT b.id FROM public.bills b
    INNER JOIN public.company_memberships cm ON cm.org_id = b.org_id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  bill_id IN (
    SELECT b.id FROM public.bills b
    INNER JOIN public.company_memberships cm ON cm.org_id = b.org_id AND cm.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bill_payments TO authenticated;

GRANT ALL ON TABLE public.bills TO service_role;
GRANT ALL ON TABLE public.bill_line_items TO service_role;
GRANT ALL ON TABLE public.bill_payments TO service_role;
