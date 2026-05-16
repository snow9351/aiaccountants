-- Fix "permission denied for table invoices" (authenticated + service_role / Edge Functions)

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_invoices" ON public.invoices;
DROP POLICY IF EXISTS "org_all_inv_lines" ON public.invoice_line_items;
DROP POLICY IF EXISTS "org_all_inv_pmts" ON public.invoice_payments;

DROP POLICY IF EXISTS "invoices_org_memberships" ON public.invoices;
DROP POLICY IF EXISTS "invoice_lines_org_memberships" ON public.invoice_line_items;
DROP POLICY IF EXISTS "invoice_payments_org_memberships" ON public.invoice_payments;

CREATE POLICY invoices_org_memberships ON public.invoices
FOR ALL
USING (
  org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
);

CREATE POLICY invoice_lines_org_memberships ON public.invoice_line_items
FOR ALL
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    INNER JOIN public.company_memberships cm ON cm.org_id = i.org_id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    INNER JOIN public.company_memberships cm ON cm.org_id = i.org_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY invoice_payments_org_memberships ON public.invoice_payments
FOR ALL
USING (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    INNER JOIN public.company_memberships cm ON cm.org_id = i.org_id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  invoice_id IN (
    SELECT i.id FROM public.invoices i
    INNER JOIN public.company_memberships cm ON cm.org_id = i.org_id AND cm.user_id = auth.uid()
  )
);

-- authenticated (browser client)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_payments TO authenticated;

-- service_role (Edge Functions bypass RLS but still need table privileges)
GRANT ALL ON TABLE public.invoices TO service_role;
GRANT ALL ON TABLE public.invoice_line_items TO service_role;
GRANT ALL ON TABLE public.invoice_payments TO service_role;
GRANT ALL ON TABLE public.customers TO service_role;
GRANT ALL ON TABLE public.contacts TO service_role;
GRANT ALL ON TABLE public.company_memberships TO service_role;
GRANT ALL ON TABLE public.audit_log TO service_role;

GRANT EXECUTE ON FUNCTION public.recompute_invoice_totals(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines(UUID, UUID, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_invoice_status(UUID, public.invoice_status_enum) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_invoice_payment(UUID, NUMERIC, TEXT, TEXT) TO service_role;
