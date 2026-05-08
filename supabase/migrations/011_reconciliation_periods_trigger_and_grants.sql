-- ============================================================
-- 011: INSERT bank_transactions → reconciliation_periods access
--
-- Symptom: POST /rest/v1/bank_transactions → 403 /
--   permission denied for table reconciliation_periods
--
-- Cause: BEFORE INSERT trigger `trg_check_period_lock` calls `check_period_lock`,
-- which SELECTs from `reconciliation_periods`. That runs as the invoker
-- (`authenticated`). The role lacked table GRANTs, and/or RLS on
-- `reconciliation_periods` (org_id = current_org_id only) did not match
-- multi-org inserts — either way the subquery fails.
--
-- Fix:
-- 1) Make `check_period_lock` SECURITY DEFINER + search_path so the lock
--    check is authoritative and does not depend on caller table grants.
-- 2) GRANT + membership RLS on `reconciliation_periods` for the Reconciliation UI.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.reconciliation_periods rp
    WHERE rp.org_id = NEW.org_id
      AND rp.bank_account_id = NEW.bank_account_id
      AND rp.status = 'locked'
      AND NEW.date::date BETWEEN rp.period_start AND rp.period_end
  )
  INTO v_locked;
  IF v_locked THEN
    RAISE EXCEPTION 'Cannot modify transactions in a locked reconciliation period';
  END IF;
  RETURN NEW;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reconciliation_periods TO authenticated;
GRANT ALL ON TABLE public.reconciliation_periods TO service_role;

DROP POLICY IF EXISTS "reconciliation_org" ON public.reconciliation_periods;
CREATE POLICY "reconciliation_org"
  ON public.reconciliation_periods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = reconciliation_periods.org_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = reconciliation_periods.org_id
        AND cm.user_id = auth.uid()
    )
  );
