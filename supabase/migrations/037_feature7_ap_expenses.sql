-- Feature 7: Expense & Bill Entry (AP) — line items, partial payments, receipts, expense COA

DO $$ BEGIN
  ALTER TYPE public.bill_status_enum ADD VALUE IF NOT EXISTS 'partial';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- ── Bill totals from line items ──
CREATE OR REPLACE FUNCTION public.recompute_bill_totals(p_bill_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC(15,2);
  v_line_tax NUMERIC(15,2);
BEGIN
  SELECT
    COALESCE(SUM(li.quantity * li.unit_price), 0),
    COALESCE(SUM(li.quantity * li.unit_price * li.tax_rate / 100), 0)
  INTO v_subtotal, v_line_tax
  FROM public.bill_line_items li
  WHERE li.bill_id = p_bill_id;

  UPDATE public.bills
  SET subtotal = v_subtotal, tax_amount = v_line_tax, total = v_subtotal + v_line_tax
  WHERE id = p_bill_id;
END;
$$;

-- ── Payment sum → amount_paid + status (unpaid / partial / paid) ──
CREATE OR REPLACE FUNCTION public.refresh_bill_payment_state(p_bill_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_paid NUMERIC(15,2);
  v_new_status public.bill_status_enum;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_bill.status = 'cancelled' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.bill_payments WHERE bill_id = p_bill_id;

  IF v_bill.total > 0 AND v_paid >= v_bill.total THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_bill.due_date < CURRENT_DATE AND v_bill.status NOT IN ('draft', 'cancelled') THEN
    v_new_status := 'overdue';
  ELSIF v_bill.status IN ('draft', 'approved', 'received') THEN
    v_new_status := v_bill.status;
  ELSE
    v_new_status := 'received';
  END IF;

  UPDATE public.bills
  SET
    amount_paid = LEAST(v_paid, GREATEST(v_bill.total, 0)),
    status = v_new_status
  WHERE id = p_bill_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_bill_payment_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_bill_payment_state(COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS bill_payments_refresh_state ON public.bill_payments;
CREATE TRIGGER bill_payments_refresh_state
  AFTER INSERT OR UPDATE OR DELETE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_bill_payment_refresh();

-- ── Create vendor bill with line items (A/P liability) ──
CREATE OR REPLACE FUNCTION public.create_bill_with_lines(
  p_org_id UUID,
  p_vendor_id UUID,
  p_bill_number TEXT DEFAULT NULL,
  p_bill_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_receipt_url TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_bill_id UUID;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;

  v_due := COALESCE(p_due_date, p_bill_date + 30);

  INSERT INTO public.bills (
    org_id, vendor_id, bill_number, status,
    bill_date, due_date, description, receipt_url,
    subtotal, tax_amount, total, amount_paid, is_duplicate
  ) VALUES (
    p_org_id, p_vendor_id, NULLIF(trim(p_bill_number), ''), 'received',
    p_bill_date, v_due, NULLIF(trim(p_description), ''), NULLIF(trim(p_receipt_url), ''),
    0, 0, 0, 0, false
  )
  RETURNING id INTO v_bill_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::JSONB))
  LOOP
    v_n := v_n + 1;
    INSERT INTO public.bill_line_items (
      bill_id, description, quantity, unit_price, amount, tax_rate, account_id, line_number
    ) VALUES (
      v_bill_id,
      COALESCE(v_line->>'description', 'Line item'),
      COALESCE((v_line->>'quantity')::NUMERIC, 1),
      COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'quantity')::NUMERIC, 1) * COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'tax_rate')::NUMERIC, 0),
      NULLIF(v_line->>'account_id', '')::UUID,
      v_n
    );
  END LOOP;

  PERFORM public.recompute_bill_totals(v_bill_id);
  RETURN v_bill_id;
END;
$$;

-- ── Record bill payment (partial or full); status via trigger ──
CREATE OR REPLACE FUNCTION public.record_bill_payment(
  p_bill_id UUID,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_bill public.bills%ROWTYPE;
  v_pay NUMERIC(15,2);
  v_balance NUMERIC(15,2);
  v_payment_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot pay a cancelled bill';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = v_bill.org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_balance := GREATEST(v_bill.total - v_bill.amount_paid, 0);
  v_pay := COALESCE(p_amount, v_balance);

  IF v_pay <= 0 THEN
    RETURN NULL;
  END IF;

  IF v_pay > v_balance + 0.01 THEN
    RAISE EXCEPTION 'Payment exceeds balance due';
  END IF;

  INSERT INTO public.bill_payments (bill_id, payment_date, amount, payment_method, reference, notes)
  VALUES (
    p_bill_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    v_pay,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'bank_transfer'),
    NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

-- ── Direct expense (paid immediately → P&L, no A/P) ──
CREATE OR REPLACE FUNCTION public.create_expense_entry(
  p_org_id UUID,
  p_vendor_id UUID DEFAULT NULL,
  p_vendor_name TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_description TEXT DEFAULT '',
  p_amount NUMERIC DEFAULT 0,
  p_account_id UUID DEFAULT NULL,
  p_payment_date DATE DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_expense_id UUID;
  v_vendor_name TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = p_org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Expense account is required';
  END IF;

  v_vendor_name := NULLIF(trim(p_vendor_name), '');
  IF p_vendor_id IS NOT NULL THEN
    SELECT COALESCE(v.display_name, v.name) INTO v_vendor_name
    FROM public.vendors v
    WHERE v.id = p_vendor_id AND v.org_id = p_org_id;
  END IF;

  INSERT INTO public.expenses (
    org_id, date, vendor_id, vendor_name, description, amount, account_id,
    category, status, payment_date, payment_method, payment_reference,
    receipt_url, created_by
  ) VALUES (
    p_org_id,
    COALESCE(p_date, CURRENT_DATE),
    p_vendor_id,
    v_vendor_name,
    COALESCE(NULLIF(trim(p_description), ''), 'Expense'),
    p_amount,
    p_account_id,
    (SELECT a.name FROM public.accounts a WHERE a.id = p_account_id),
    'approved',
    COALESCE(p_payment_date, p_date, CURRENT_DATE),
    NULLIF(trim(p_payment_method), ''),
    NULLIF(trim(p_payment_reference), ''),
    NULLIF(trim(p_receipt_url), ''),
    v_user
  )
  RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_bill_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bill_with_lines(UUID, UUID, TEXT, DATE, DATE, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_bill_payment(UUID, DATE, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_entry(UUID, UUID, TEXT, DATE, TEXT, NUMERIC, UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;

-- ── Expenses + receipts: membership RLS + grants (like bills 034) ──
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_all_expenses" ON public.expenses;
DROP POLICY IF EXISTS "org_all_receipts" ON public.receipts;

CREATE POLICY expenses_org_memberships ON public.expenses
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

CREATE POLICY receipts_org_memberships ON public.receipts
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipts TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;
GRANT ALL ON TABLE public.receipts TO service_role;

-- ── Receipts storage bucket ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS receipts_storage_select ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_insert ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_update ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_delete ON storage.objects;

CREATE POLICY receipts_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.org_id::TEXT FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY receipts_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.org_id::TEXT FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY receipts_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.org_id::TEXT FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY receipts_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT cm.org_id::TEXT FROM public.company_memberships cm WHERE cm.user_id = auth.uid()
  )
);
