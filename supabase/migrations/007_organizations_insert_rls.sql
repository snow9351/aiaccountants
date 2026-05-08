-- ============================================================
-- Allow authenticated users to insert organizations (new company)
-- Required for CompanySwitcher "create company" from the app.
-- Previously only SELECT/UPDATE existed on organizations → INSERT blocked by RLS.
-- ============================================================

DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;

CREATE POLICY "org_insert_authenticated" ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
