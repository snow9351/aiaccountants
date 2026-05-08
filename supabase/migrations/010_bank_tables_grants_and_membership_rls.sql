-- ============================================================
-- 010: bank_transactions / bank_accounts — GRANT + membership RLS
--
-- Symptom: GET /rest/v1/bank_transactions → 403
--   permission denied for table bank_transactions
--   hint: GRANT SELECT ON public.bank_transactions TO authenticated
--
-- Cause A: PostgREST uses role `authenticated`; without table GRANTs,
--          PostgreSQL rejects the query before RLS runs.
--
-- Cause B: Policies used only org_id = current_org_id(), so users only
--          see the “first” org; multi-company switcher needs membership.
-- ============================================================

-- ── Privileges (required for API access) ───────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_accounts TO authenticated;

GRANT ALL ON TABLE public.bank_transactions TO service_role;
GRANT ALL ON TABLE public.bank_accounts TO service_role;

-- ── RLS: any org the user belongs to (matches company switcher) ──
DROP POLICY IF EXISTS "org_all_bank_txns" ON public.bank_transactions;
CREATE POLICY "org_all_bank_txns"
  ON public.bank_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = bank_transactions.org_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = bank_transactions.org_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_all_bank_accts" ON public.bank_accounts;
CREATE POLICY "org_all_bank_accts"
  ON public.bank_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = bank_accounts.org_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.org_id = bank_accounts.org_id
        AND cm.user_id = auth.uid()
    )
  );
