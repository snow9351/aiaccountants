-- ============================================================
-- Fix organizations SELECT for multi-company switcher
-- Previous policy only allowed id = current_org_id(), so users
-- could not read other orgs they belong to via company_memberships.
-- ============================================================

DROP POLICY IF EXISTS "org_select" ON organizations;

CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.org_id = organizations.id
        AND cm.user_id = auth.uid()
    )
    OR id = current_org_id()
  );
