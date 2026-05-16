-- Record bill payments when marking bills paid (drives 1099 YTD via bill_payments trigger)

CREATE OR REPLACE FUNCTION public.record_bill_payment(
  p_bill_id UUID,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_reference TEXT DEFAULT NULL
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
  v_payment_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id;
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

  v_pay := COALESCE(p_amount, v_bill.total - v_bill.amount_paid);
  IF v_pay <= 0 THEN
    IF v_bill.status <> 'paid' THEN
      UPDATE public.bills SET status = 'paid' WHERE id = p_bill_id;
    END IF;
    RETURN NULL;
  END IF;

  INSERT INTO public.bill_payments (bill_id, payment_date, amount, payment_method, reference)
  VALUES (
    p_bill_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    v_pay,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'bank_transfer'),
    NULLIF(trim(p_reference), '')
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.bills
  SET
    amount_paid = LEAST(v_bill.amount_paid + v_pay, v_bill.total),
    status = 'paid'
  WHERE id = p_bill_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bill_payment(UUID, DATE, NUMERIC, TEXT, TEXT) TO authenticated;

-- Backfill bill_payments for bills previously marked paid without payment rows
INSERT INTO public.bill_payments (bill_id, payment_date, amount, payment_method, reference)
SELECT
  b.id,
  COALESCE(b.updated_at::DATE, b.bill_date),
  GREATEST(b.total - b.amount_paid, 0),
  'bank_transfer',
  'backfill-paid-bill'
FROM public.bills b
WHERE b.status = 'paid'
  AND GREATEST(b.total - b.amount_paid, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.bill_payments bp WHERE bp.bill_id = b.id);

UPDATE public.bills b
SET amount_paid = b.total
WHERE b.status = 'paid' AND b.amount_paid < b.total;

-- Refresh 1099 YTD for vendors affected by backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT b.vendor_id, EXTRACT(YEAR FROM bp.payment_date)::INT AS yr
    FROM public.bill_payments bp
    INNER JOIN public.bills b ON b.id = bp.bill_id
    WHERE bp.reference = 'backfill-paid-bill'
  LOOP
    PERFORM public.refresh_vendor_1099_ytd(r.vendor_id, r.yr);
  END LOOP;
END $$;
