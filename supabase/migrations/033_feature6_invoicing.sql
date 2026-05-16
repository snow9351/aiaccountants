-- Feature 6: Invoicing (AR) — line items, discounts, payments, audit, Stripe fields

DO $$ BEGIN
  ALTER TYPE public.invoice_status_enum ADD VALUE IF NOT EXISTS 'voided';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none'
    CHECK (discount_type IN ('none', 'percent', 'flat')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- ── Recompute totals from line items + invoice-level discount ──
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_subtotal NUMERIC(15,2);
  v_line_tax NUMERIC(15,2);
  v_discount NUMERIC(15,2);
  v_total NUMERIC(15,2);
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(li.quantity * li.unit_price), 0),
    COALESCE(SUM(li.quantity * li.unit_price * li.tax_rate / 100), 0)
  INTO v_subtotal, v_line_tax
  FROM public.invoice_line_items li
  WHERE li.invoice_id = p_invoice_id;

  v_discount := CASE v_inv.discount_type
    WHEN 'percent' THEN ROUND(v_subtotal * v_inv.discount_value / 100, 2)
    WHEN 'flat' THEN LEAST(v_inv.discount_value, v_subtotal)
    ELSE 0
  END;

  v_total := GREATEST(v_subtotal - v_discount, 0) + v_line_tax;

  UPDATE public.invoices
  SET subtotal = v_subtotal, tax_amount = v_line_tax, total = v_total
  WHERE id = p_invoice_id;
END;
$$;

-- ── Invoice audit: proper action enum + status transition descriptions ──
CREATE OR REPLACE FUNCTION public.audit_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_action public.audit_action_type;
  v_desc TEXT;
BEGIN
  v_org_id := COALESCE(NEW.org_id, OLD.org_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_desc := 'Created invoice ' || NEW.invoice_number;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_desc := 'Deleted invoice ' || OLD.invoice_number;
  ELSE
    IF NEW.status IN ('voided', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'void';
      v_desc := 'Voided invoice ' || NEW.invoice_number;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'update';
      v_desc := 'Invoice ' || NEW.invoice_number || ': ' || OLD.status || ' → ' || NEW.status;
    ELSE
      v_action := 'update';
      v_desc := 'Updated invoice ' || COALESCE(NEW.invoice_number, OLD.invoice_number);
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    org_id, actor_id, actor_type, actor_name,
    action, target_table, target_id, target_description,
    old_value, new_value
  ) VALUES (
    v_org_id,
    auth.uid(),
    'user',
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    v_action,
    'invoices',
    COALESCE(NEW.id, OLD.id),
    v_desc,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_invoices();

-- ── Payment → amount_paid + status (partial / paid) ──
CREATE OR REPLACE FUNCTION public.refresh_invoice_payment_state(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_paid NUMERIC(15,2);
  v_new_status public.invoice_status_enum;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_inv.status IN ('voided', 'cancelled') THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.invoice_payments WHERE invoice_id = p_invoice_id;

  IF v_paid >= v_inv.total AND v_inv.total > 0 THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    RETURN;
  END IF;

  UPDATE public.invoices
  SET amount_paid = LEAST(v_paid, total), status = v_new_status
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_invoice_payment_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_invoice_payment_state(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invoice_payments_refresh_state ON public.invoice_payments;
CREATE TRIGGER invoice_payments_refresh_state
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_payment_refresh();

-- ── Create draft invoice with line items ──
CREATE OR REPLACE FUNCTION public.create_invoice_with_lines(
  p_org_id UUID,
  p_customer_id UUID,
  p_invoice_number TEXT,
  p_issue_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_value NUMERIC DEFAULT 0,
  p_lines JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_invoice_id UUID;
  v_due DATE;
  v_line JSONB;
  v_n INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = p_org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_due := COALESCE(p_due_date, p_issue_date + 30);

  INSERT INTO public.invoices (
    org_id, invoice_number, customer_id, status,
    issue_date, due_date, notes,
    discount_type, discount_value, currency,
    subtotal, tax_amount, total, amount_paid,
    is_recurring, recurring_interval
  ) VALUES (
    p_org_id, trim(p_invoice_number), p_customer_id, 'draft',
    p_issue_date, v_due, NULLIF(trim(p_notes), ''),
    COALESCE(NULLIF(trim(p_discount_type), ''), 'none'),
    COALESCE(p_discount_value, 0), 'USD',
    0, 0, 0, 0,
    false, NULL
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::JSONB))
  LOOP
    v_n := v_n + 1;
    INSERT INTO public.invoice_line_items (
      invoice_id, description, quantity, unit_price, amount, tax_rate, account_id, line_number
    ) VALUES (
      v_invoice_id,
      COALESCE(v_line->>'description', 'Line item'),
      COALESCE((v_line->>'quantity')::NUMERIC, 1),
      COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'quantity')::NUMERIC, 1) * COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'tax_rate')::NUMERIC, 0),
      NULLIF(v_line->>'account_id', '')::UUID,
      v_n
    );
  END LOOP;

  PERFORM public.recompute_invoice_totals(v_invoice_id);
  RETURN v_invoice_id;
END;
$$;

-- ── Status transitions with validation ──
CREATE OR REPLACE FUNCTION public.transition_invoice_status(
  p_invoice_id UUID,
  p_new_status public.invoice_status_enum
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_user UUID := auth.uid();
  v_ok BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = v_inv.org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_inv.status IN ('voided', 'cancelled') THEN
    RAISE EXCEPTION 'Invoice is voided';
  END IF;

  v_ok := CASE
    WHEN v_inv.status = 'draft' AND p_new_status IN ('sent', 'voided', 'cancelled') THEN true
    WHEN v_inv.status IN ('sent', 'viewed') AND p_new_status IN ('partial', 'paid', 'overdue', 'voided', 'cancelled') THEN true
    WHEN v_inv.status = 'partial' AND p_new_status IN ('partial', 'paid', 'overdue', 'voided', 'cancelled') THEN true
    WHEN v_inv.status = 'overdue' AND p_new_status IN ('partial', 'paid', 'voided', 'cancelled') THEN true
    WHEN v_inv.status = 'paid' AND p_new_status IN ('voided', 'cancelled') THEN true
    ELSE false
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid status transition: % → %', v_inv.status, p_new_status;
  END IF;

  UPDATE public.invoices
  SET
    status = p_new_status,
    sent_at = CASE WHEN p_new_status = 'sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

-- ── Record manual or Stripe payment ──
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'check',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_inv public.invoices%ROWTYPE;
  v_pay NUMERIC(15,2);
  v_payment_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = v_inv.org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_inv.status IN ('voided', 'cancelled', 'draft') THEN
    RAISE EXCEPTION 'Cannot record payment on invoice in status %', v_inv.status;
  END IF;

  v_pay := COALESCE(p_amount, v_inv.total - v_inv.amount_paid);
  IF v_pay <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, payment_date, amount, payment_method, reference, notes, stripe_payment_intent_id
  ) VALUES (
    p_invoice_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    v_pay,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'check'),
    NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_stripe_payment_intent_id), '')
  )
  RETURNING id INTO v_payment_id;

  PERFORM public.refresh_invoice_payment_state(p_invoice_id);

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  RETURN v_payment_id;
END;
$$;

-- Membership RLS for line items / payments (match invoices 013)
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_inv_lines" ON public.invoice_line_items;
DROP POLICY IF EXISTS "org_all_inv_pmts" ON public.invoice_payments;

CREATE POLICY "invoice_lines_org_memberships" ON public.invoice_line_items
FOR ALL USING (
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

CREATE POLICY "invoice_payments_org_memberships" ON public.invoice_payments
FOR ALL USING (
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_invoice_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_lines(UUID, UUID, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_invoice_status(UUID, public.invoice_status_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, DATE, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Stripe webhook (service role): idempotent payment apply
CREATE OR REPLACE FUNCTION public.apply_stripe_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_stripe_payment_intent_id TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  IF p_stripe_payment_intent_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.invoice_payments ip
    WHERE ip.stripe_payment_intent_id = p_stripe_payment_intent_id
  ) THEN
    SELECT id INTO v_payment_id FROM public.invoice_payments
    WHERE stripe_payment_intent_id = p_stripe_payment_intent_id LIMIT 1;
    RETURN v_payment_id;
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, payment_date, amount, payment_method, reference, stripe_payment_intent_id
  ) VALUES (
    p_invoice_id, CURRENT_DATE, p_amount, 'stripe', COALESCE(p_reference, p_stripe_payment_intent_id), p_stripe_payment_intent_id
  )
  RETURNING id INTO v_payment_id;

  PERFORM public.refresh_invoice_payment_state(p_invoice_id);
  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_stripe_invoice_payment(UUID, NUMERIC, TEXT, TEXT) TO service_role;
