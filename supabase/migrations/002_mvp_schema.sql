-- ============================================================
-- Migration 002: MVP v2 — Auth, Billing, Multi-company, Plaid, AI
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('owner', 'accountant', 'bookkeeper', 'read_only');
CREATE TYPE plan_name AS ENUM ('starter', 'pro', 'accountant', 'firm');
CREATE TYPE billing_model AS ENUM ('client_pays', 'accountant_pays', 'revenue_share');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE reconciliation_status AS ENUM ('in_progress', 'completed', 'locked');
CREATE TYPE categorization_status AS ENUM ('unreviewed', 'ai_suggested', 'confirmed', 'overridden');
CREATE TYPE plaid_status AS ENUM ('active', 'error', 'pending_expiration', 'revoked');

-- ── Plans ──────────────────────────────────────────────────
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name plan_name NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL, -- cents
  price_annually INTEGER NOT NULL, -- cents
  stripe_price_id_monthly TEXT,
  stripe_price_id_annually TEXT,
  max_companies INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, display_name, price_monthly, price_annually, max_companies, max_users, features) VALUES
  ('starter',    'Starter',    1900,  19000,  1,  2,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true}'),
  ('pro',        'Pro',        3900,  39000,  3,  5,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true}'),
  ('accountant', 'Accountant', 7900,  79000,  10, 15, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true}'),
  ('firm',       'Firm',       14900, 149000, 99, 99, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true,"white_label":true}');

-- ── Firms (accounting practices) ──────────────────────────
CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT,
  plan plan_name NOT NULL DEFAULT 'accountant',
  subscription_status subscription_status NOT NULL DEFAULT 'trialing',
  billing_model billing_model NOT NULL DEFAULT 'accountant_pays',
  max_clients INTEGER NOT NULL DEFAULT 10,
  logo_url TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Stripe customers & subscriptions ──────────────────────
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan plan_name NOT NULL,
  billing_model billing_model NOT NULL DEFAULT 'client_pays',
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  payment_method_last4 TEXT,
  payment_method_brand TEXT,
  dunning_count INTEGER NOT NULL DEFAULT 0,
  dunning_grace_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Company memberships (user ↔ org with roles) ───────────
CREATE TABLE company_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id),
  role user_role NOT NULL DEFAULT 'read_only',
  is_billing_owner BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ── Invitations ────────────────────────────────────────────
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'read_only',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── MFA / TOTP ────────────────────────────────────────────
CREATE TABLE mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false, -- true for accountant role
  totp_secret TEXT, -- encrypted
  backup_codes TEXT[], -- hashed
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Plaid connections ─────────────────────────────────────
CREATE TABLE plaid_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  access_token TEXT NOT NULL, -- encrypted in vault
  item_id TEXT NOT NULL UNIQUE,
  institution_id TEXT,
  institution_name TEXT,
  status plaid_status NOT NULL DEFAULT 'active',
  cursor TEXT, -- for incremental sync
  last_synced_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── AI categorization signals (training data) ─────────────
CREATE TABLE ai_categorization_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES bank_transactions(id),
  merchant_name TEXT,
  description_normalized TEXT,
  amount_range TEXT, -- e.g. '0-50', '50-200', '200+'
  suggested_account_id UUID REFERENCES accounts(id),
  confirmed_account_id UUID REFERENCES accounts(id),
  was_overridden BOOLEAN NOT NULL DEFAULT false,
  confidence NUMERIC(4,3),
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_signals_merchant ON ai_categorization_signals(org_id, merchant_name);
CREATE INDEX idx_ai_signals_description ON ai_categorization_signals(org_id, description_normalized);

-- ── Categorization queue ──────────────────────────────────
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS categorization_status categorization_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS suggested_account_id UUID REFERENCES accounts(id),
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS ai_model_version TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX idx_bank_tx_categorization ON bank_transactions(org_id, categorization_status);

-- ── Invoice improvements ──────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ── Bank reconciliation periods ───────────────────────────
CREATE TABLE reconciliation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_balance NUMERIC(15,2) NOT NULL,
  closing_balance NUMERIC(15,2) NOT NULL,
  statement_balance NUMERIC(15,2) NOT NULL,
  difference NUMERIC(15,2) GENERATED ALWAYS AS (closing_balance - statement_balance) STORED,
  status reconciliation_status NOT NULL DEFAULT 'in_progress',
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent posting to locked periods
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM reconciliation_periods rp
    WHERE rp.org_id = NEW.org_id
      AND rp.bank_account_id = NEW.bank_account_id
      AND rp.status = 'locked'
      AND NEW.date BETWEEN rp.period_start AND rp.period_end
  ) INTO v_locked;
  IF v_locked THEN
    RAISE EXCEPTION 'Cannot modify transactions in a locked reconciliation period';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_period_lock
  BEFORE INSERT OR UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION check_period_lock();

-- ── CSV import jobs ───────────────────────────────────────
CREATE TABLE csv_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  file_name TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed
  rows_total INTEGER,
  rows_imported INTEGER,
  rows_duplicate INTEGER,
  rows_failed INTEGER,
  error_message TEXT,
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── Updated_at triggers for new tables ────────────────────
CREATE TRIGGER set_firms_updated_at BEFORE UPDATE ON firms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_plaid_connections_updated_at BEFORE UPDATE ON plaid_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_reconciliation_periods_updated_at BEFORE UPDATE ON reconciliation_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_mfa_settings_updated_at BEFORE UPDATE ON mfa_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON plans FOR SELECT USING (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_org_isolation" ON subscriptions FOR ALL
  USING (org_id = current_org_id() OR firm_id IN (SELECT firm_id FROM company_memberships WHERE user_id = auth.uid()));

ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_org" ON company_memberships FOR ALL
  USING (org_id = current_org_id() OR user_id = auth.uid());

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_org" ON invitations FOR ALL
  USING (org_id = current_org_id() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plaid_org" ON plaid_connections FOR ALL USING (org_id = current_org_id());

ALTER TABLE ai_categorization_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_signals_org" ON ai_categorization_signals FOR ALL USING (org_id = current_org_id());

ALTER TABLE reconciliation_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reconciliation_org" ON reconciliation_periods FOR ALL USING (org_id = current_org_id());

ALTER TABLE csv_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csv_imports_org" ON csv_import_jobs FOR ALL USING (org_id = current_org_id());

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firms_member" ON firms FOR ALL
  USING (owner_id = auth.uid() OR id IN (SELECT firm_id FROM company_memberships WHERE user_id = auth.uid()));

-- ── Realtime ──────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
-- bank_transactions already added in migration 001

-- ── Default COA by entity type (function) ─────────────────
CREATE OR REPLACE FUNCTION generate_default_coa(p_org_id UUID, p_entity_type TEXT)
RETURNS VOID AS $$
DECLARE
  accounts_data JSONB;
BEGIN
  -- Core accounts every entity gets
  INSERT INTO accounts (org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active)
  VALUES
    (p_org_id, '1000', 'Cash & Cash Equivalents', 'asset', 'current_asset', 'debit', true, true),
    (p_org_id, '1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit', true, true),
    (p_org_id, '1200', 'Inventory', 'asset', 'current_asset', 'debit', true, true),
    (p_org_id, '1500', 'Fixed Assets', 'asset', 'fixed_asset', 'debit', true, true),
    (p_org_id, '1510', 'Accumulated Depreciation', 'asset', 'fixed_asset', 'credit', true, true),
    (p_org_id, '2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', true, true),
    (p_org_id, '2100', 'Accrued Liabilities', 'liability', 'current_liability', 'credit', true, true),
    (p_org_id, '2200', 'Sales Tax Payable', 'liability', 'current_liability', 'credit', true, true),
    (p_org_id, '2300', 'Payroll Liabilities', 'liability', 'current_liability', 'credit', true, true),
    (p_org_id, '2900', 'Long-Term Debt', 'liability', 'long_term_liability', 'credit', true, true),
    (p_org_id, '4000', 'Revenue', 'revenue', 'operating_revenue', 'credit', true, true),
    (p_org_id, '4100', 'Service Revenue', 'revenue', 'operating_revenue', 'credit', true, true),
    (p_org_id, '4200', 'Product Revenue', 'revenue', 'operating_revenue', 'credit', true, true),
    (p_org_id, '4900', 'Other Income', 'revenue', 'other_revenue', 'credit', true, true),
    (p_org_id, '5000', 'Cost of Goods Sold', 'expense', 'cogs', 'debit', true, true),
    (p_org_id, '6000', 'Payroll & Wages', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6100', 'Payroll Taxes', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6200', 'Rent & Lease', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6300', 'Utilities', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6400', 'Software & Subscriptions', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6500', 'Marketing & Advertising', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6600', 'Travel & Entertainment', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6700', 'Professional Services', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6800', 'Insurance', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '6900', 'Depreciation', 'expense', 'operating_expense', 'debit', true, true),
    (p_org_id, '7000', 'Interest Expense', 'expense', 'other_expense', 'debit', true, true),
    (p_org_id, '7100', 'Other Expenses', 'expense', 'other_expense', 'debit', true, true)
  ON CONFLICT DO NOTHING;

  -- Entity-specific equity accounts
  IF p_entity_type IN ('llc', 'sole_prop', 'partnership') THEN
    INSERT INTO accounts (org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active)
    VALUES
      (p_org_id, '3000', 'Owner''s Equity', 'equity', 'owners_equity', 'credit', true, true),
      (p_org_id, '3100', 'Owner''s Draw', 'equity', 'owners_equity', 'debit', true, true),
      (p_org_id, '3900', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, true)
    ON CONFLICT DO NOTHING;
  ELSE -- S-Corp, C-Corp
    INSERT INTO accounts (org_id, account_number, name, type, sub_type, normal_balance, is_system, is_active)
    VALUES
      (p_org_id, '3000', 'Common Stock', 'equity', 'paid_in_capital', 'credit', true, true),
      (p_org_id, '3100', 'Additional Paid-In Capital', 'equity', 'paid_in_capital', 'credit', true, true),
      (p_org_id, '3900', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, true),
      (p_org_id, '3950', 'Distributions', 'equity', 'distributions', 'debit', true, true)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Organization improvements ─────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'llc',
  ADD COLUMN IF NOT EXISTS accounting_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS fiscal_year_start INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS plan plan_name DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days';
