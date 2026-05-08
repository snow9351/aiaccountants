-- ============================================================
-- 003: Puzzle.io Feature Parity
-- Month-End Close, Revenue Recognition (ASC 606),
-- Categorization Rules, Accountant Portal, Accruals
-- ============================================================

-- ---- Month-End Close ----

CREATE TABLE IF NOT EXISTS close_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- e.g. "2024-03"
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'closed')),
  started_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, period)
);

CREATE TABLE IF NOT EXISTS close_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES close_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('bank', 'receivables', 'payables', 'payroll', 'accruals', 'review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE close_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org close checklists" ON close_checklists
  FOR ALL USING (org_id IN (SELECT org_id FROM company_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage close tasks via checklist" ON close_tasks
  FOR ALL USING (checklist_id IN (
    SELECT id FROM close_checklists WHERE org_id IN (
      SELECT org_id FROM company_memberships WHERE user_id = auth.uid()
    )
  ));


-- ---- Revenue Recognition (ASC 606) ----

CREATE TABLE IF NOT EXISTS revenue_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  recognized_to_date NUMERIC(15,2) NOT NULL DEFAULT 0,
  deferred_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  recognition_method TEXT NOT NULL CHECK (recognition_method IN ('straight_line', 'milestone', 'usage_based', 'point_in_time')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES revenue_contracts(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- e.g. "2024-03"
  amount NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'recognized', 'adjusted')),
  recognized_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE revenue_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org revenue contracts" ON revenue_contracts
  FOR ALL USING (org_id IN (SELECT org_id FROM company_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage revenue schedules via contract" ON revenue_schedules
  FOR ALL USING (contract_id IN (
    SELECT id FROM revenue_contracts WHERE org_id IN (
      SELECT org_id FROM company_memberships WHERE user_id = auth.uid()
    )
  ));


-- ---- Categorization Rules Engine ----

CREATE TABLE IF NOT EXISTS categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  match_field TEXT NOT NULL CHECK (match_field IN ('description', 'vendor', 'amount', 'memo')),
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'starts_with', 'exact', 'regex', 'greater_than', 'less_than')),
  match_value TEXT NOT NULL,
  target_account_id UUID NOT NULL REFERENCES accounts(id),
  target_account_name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  times_applied INT NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org categorization rules" ON categorization_rules
  FOR ALL USING (org_id IN (SELECT org_id FROM company_memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_categorization_rules_org_active ON categorization_rules(org_id, is_active, priority);


-- ---- Client Requests (Accountant Portal) ----

CREATE TABLE IF NOT EXISTS client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_by_name TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_to_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category TEXT NOT NULL DEFAULT 'question' CHECK (category IN ('question', 'document_request', 'review', 'adjustment', 'tax')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE client_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org client requests" ON client_requests
  FOR ALL USING (org_id IN (SELECT org_id FROM company_memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_client_requests_org_status ON client_requests(org_id, status);


-- ---- Accrual Management ----

CREATE TABLE IF NOT EXISTS accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  description TEXT NOT NULL,
  vendor_or_customer TEXT,
  amount NUMERIC(15,2) NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  account_name TEXT NOT NULL,
  period TEXT NOT NULL, -- e.g. "2024-03"
  frequency TEXT NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time', 'monthly', 'quarterly')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  reversal_entry_id UUID REFERENCES journal_entries(id),
  auto_reverse BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  posted_at TIMESTAMPTZ
);

ALTER TABLE accruals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their org accruals" ON accruals
  FOR ALL USING (org_id IN (SELECT org_id FROM company_memberships WHERE user_id = auth.uid()));

CREATE INDEX idx_accruals_org_period ON accruals(org_id, period, status);
