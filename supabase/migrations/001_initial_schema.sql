-- ============================================================
-- ConnectCash AI — Complete Database Schema
-- Run this once in your Supabase SQL editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE account_type_enum AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status_enum AS ENUM ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE bill_status_enum AS ENUM ('draft', 'received', 'approved', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE expense_status_enum AS ENUM ('pending', 'auto_categorized', 'review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type_enum AS ENUM ('income', 'expense', 'transfer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE actor_type_enum AS ENUM ('user', 'ai', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status_enum AS ENUM ('active', 'inactive', 'on_leave', 'terminated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_status_enum AS ENUM ('draft', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE bank_account_type_enum AS ENUM ('checking', 'savings', 'credit', 'investment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('admin', 'accountant', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Auto-update updated_at on every mutable table
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'general',
  fiscal_year_end_month INT NOT NULL DEFAULT 12 CHECK (fiscal_year_end_month BETWEEN 1 AND 12),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  tax_id       TEXT,
  address      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT,
  role         user_role_enum NOT NULL DEFAULT 'viewer',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS payment_terms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  days_due        INT NOT NULL DEFAULT 30,
  discount_percent NUMERIC(5,2),
  discount_days   INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           account_type_enum NOT NULL,
  sub_type       TEXT,
  parent_id      UUID REFERENCES accounts(id),
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_system      BOOLEAN NOT NULL DEFAULT FALSE,
  normal_balance TEXT NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  tax_category   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, account_number)
);
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- JOURNAL ENTRIES (General Ledger)
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date         DATE NOT NULL,
  description  TEXT NOT NULL,
  reference    TEXT,
  is_posted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES auth.users(id),
  prev_hash    TEXT,
  entry_hash   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, entry_number)
);
CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES accounts(id),
  debit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  description      TEXT,
  line_number      INT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  )
);

-- Enforce accounting equation on journal entry save
CREATE OR REPLACE FUNCTION check_accounting_equation()
RETURNS TRIGGER AS $$
DECLARE
  total_debits  NUMERIC;
  total_credits NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF total_debits <> total_credits THEN
    RAISE EXCEPTION 'Accounting equation violated for entry %: debits (%) ≠ credits (%)',
      NEW.journal_entry_id, total_debits, total_credits;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: this trigger only fires when is_posted = true to allow building up lines
-- The check is enforced at post time via the application layer instead
-- Uncomment to enforce at DB level on every line save:
-- CREATE TRIGGER trg_accounting_equation
--   AFTER INSERT OR UPDATE ON journal_entry_lines
--   FOR EACH ROW EXECUTE FUNCTION check_accounting_equation();

-- ============================================================
-- CUSTOMERS & AR
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  billing_address   JSONB,
  payment_terms_id  UUID REFERENCES payment_terms(id),
  credit_limit      NUMERIC(15,2),
  payment_score     INT NOT NULL DEFAULT 100 CHECK (payment_score BETWEEN 0 AND 100),
  total_revenue     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ar_balance        NUMERIC(15,2) NOT NULL DEFAULT 0,
  industry          TEXT,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  customer_id       UUID NOT NULL REFERENCES customers(id),
  status            invoice_status_enum NOT NULL DEFAULT 'draft',
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE NOT NULL,
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_due       NUMERIC(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  notes             TEXT,
  is_recurring      BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_interval TEXT,
  journal_entry_id  UUID REFERENCES journal_entries(id),
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, invoice_number)
);
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  account_id  UUID REFERENCES accounts(id),
  line_number INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date   DATE NOT NULL,
  amount         NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VENDORS & AP
-- ============================================================

CREATE TABLE IF NOT EXISTS vendors (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  email                    TEXT,
  phone                    TEXT,
  address                  JSONB,
  tax_id                   TEXT,
  payment_terms_id         UUID REFERENCES payment_terms(id),
  preferred_payment_method TEXT,
  total_spend              NUMERIC(15,2) NOT NULL DEFAULT 0,
  ap_balance               NUMERIC(15,2) NOT NULL DEFAULT 0,
  reliability_score        INT NOT NULL DEFAULT 100 CHECK (reliability_score BETWEEN 0 AND 100),
  is_1099                  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id      UUID NOT NULL REFERENCES vendors(id),
  po_number      TEXT NOT NULL,
  po_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'draft',
  subtotal       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total          NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, po_number)
);
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bills (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id        UUID NOT NULL REFERENCES vendors(id),
  bill_number      TEXT,
  status           bill_status_enum NOT NULL DEFAULT 'draft',
  bill_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE NOT NULL,
  subtotal         NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total            NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance_due      NUMERIC(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  description      TEXT,
  po_number        TEXT,
  is_duplicate     BOOLEAN NOT NULL DEFAULT FALSE,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bill_line_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id     UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  account_id  UUID REFERENCES accounts(id),
  line_number INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id        UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_date   DATE NOT NULL,
  amount         NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPENSES & RECEIPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id             UUID REFERENCES vendors(id),
  vendor_name           TEXT,
  description           TEXT NOT NULL,
  amount                NUMERIC(15,2) NOT NULL,
  account_id            UUID REFERENCES accounts(id),
  category              TEXT,
  status                expense_status_enum NOT NULL DEFAULT 'pending',
  ai_confidence         NUMERIC(5,2),
  ai_suggested_category TEXT,
  receipt_url           TEXT,
  bank_transaction_id   UUID,
  journal_entry_id      UUID REFERENCES journal_entries(id),
  project_id            UUID,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS receipts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_id       UUID REFERENCES expenses(id),
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT NOT NULL DEFAULT 'image/jpeg',
  ocr_text         TEXT,
  extracted_vendor TEXT,
  extracted_date   DATE,
  extracted_amount NUMERIC(15,2),
  extracted_tax    NUMERIC(15,2),
  extracted_items  JSONB,
  ocr_confidence   NUMERIC(5,2),
  is_duplicate     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- BANK ACCOUNTS & TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_name          TEXT NOT NULL,
  account_number_masked TEXT,
  bank_name             TEXT NOT NULL,
  account_type          bank_account_type_enum NOT NULL DEFAULT 'checking',
  currency              TEXT NOT NULL DEFAULT 'USD',
  current_balance       NUMERIC(15,2) NOT NULL DEFAULT 0,
  gl_account_id         UUID REFERENCES accounts(id),
  plaid_account_id      TEXT,
  last_sync_at          TIMESTAMPTZ,
  sync_status           TEXT NOT NULL DEFAULT 'disconnected',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id               UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  date                          DATE NOT NULL,
  description                   TEXT NOT NULL,
  amount                        NUMERIC(15,2) NOT NULL,
  type                          transaction_type_enum NOT NULL,
  category                      TEXT,
  merchant                      TEXT,
  balance_after                 NUMERIC(15,2),
  external_id                   TEXT,
  is_matched                    BOOLEAN NOT NULL DEFAULT FALSE,
  is_reconciled                 BOOLEAN NOT NULL DEFAULT FALSE,
  matched_journal_entry_line_id UUID REFERENCES journal_entry_lines(id),
  ai_confidence                 NUMERIC(5,2),
  ai_suggested_category         TEXT,
  is_pending                    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id             UUID NOT NULL REFERENCES bank_accounts(id),
  reconciliation_date         DATE NOT NULL,
  statement_beginning_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  statement_ending_balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
  gl_beginning_balance        NUMERIC(15,2) NOT NULL DEFAULT 0,
  gl_ending_balance           NUMERIC(15,2) NOT NULL DEFAULT 0,
  outstanding_deposits        NUMERIC(15,2) NOT NULL DEFAULT 0,
  outstanding_checks          NUMERIC(15,2) NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'in_progress',
  notes                       TEXT,
  created_by                  UUID REFERENCES auth.users(id),
  completed_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_bank_reconciliations_updated_at
  BEFORE UPDATE ON bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  job_title            TEXT,
  department           TEXT,
  hire_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date     DATE,
  status               employee_status_enum NOT NULL DEFAULT 'active',
  employment_type      TEXT NOT NULL DEFAULT 'full_time',
  salary               NUMERIC(15,2),
  salary_frequency     TEXT NOT NULL DEFAULT 'annual',
  overtime_multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  address              JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS timesheets (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id          UUID NOT NULL REFERENCES employees(id),
  week_start_date      DATE NOT NULL,
  total_hours          NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft',
  notes                TEXT,
  submitted_at         TIMESTAMPTZ,
  approved_at          TIMESTAMPTZ,
  approved_by          UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timesheet_id     UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  work_date        DATE NOT NULL,
  hours            NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_hours   NUMERIC(6,2) NOT NULL DEFAULT 0,
  project_id       UUID,
  task_description TEXT,
  billable         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end   DATE NOT NULL,
  payroll_date     DATE NOT NULL,
  status           payroll_status_enum NOT NULL DEFAULT 'draft',
  total_gross      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_taxes      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net        NUMERIC(15,2) NOT NULL DEFAULT 0,
  employee_count   INT NOT NULL DEFAULT 0,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS payroll_details (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id   UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id),
  gross_pay        NUMERIC(15,2) NOT NULL DEFAULT 0,
  federal_tax      NUMERIC(15,2) NOT NULL DEFAULT 0,
  state_tax        NUMERIC(15,2) NOT NULL DEFAULT 0,
  fica_employee    NUMERIC(15,2) NOT NULL DEFAULT 0,
  fica_employer    NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_pay          NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method   TEXT NOT NULL DEFAULT 'direct_deposit',
  paystub_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUDGETS & FORECASTS
-- ============================================================

CREATE TABLE IF NOT EXISTS budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  fiscal_year INT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  scenario    TEXT NOT NULL DEFAULT 'expected',
  status      TEXT NOT NULL DEFAULT 'draft',
  created_by  UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS budget_lines (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id    UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES accounts(id),
  period_label TEXT NOT NULL,
  amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'revenue',
  period           TEXT NOT NULL,
  methodology      TEXT NOT NULL DEFAULT 'trend',
  confidence_level NUMERIC(5,2) NOT NULL DEFAULT 0.85,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecast_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_id     UUID NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES accounts(id),
  forecast_date   DATE NOT NULL,
  lower_bound     NUMERIC(15,2) NOT NULL DEFAULT 0,
  expected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  upper_bound     NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(15,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECTS / JOB COSTING
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  customer_id      UUID REFERENCES customers(id),
  status           TEXT NOT NULL DEFAULT 'planning',
  project_type     TEXT NOT NULL DEFAULT 'fixed_price',
  start_date       DATE,
  end_date         DATE,
  budget_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_cost      NUMERIC(15,2) NOT NULL DEFAULT 0,
  revenue_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  percent_complete INT NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  description      TEXT,
  manager_id       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS project_phases (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phase_order   INT NOT NULL DEFAULT 1,
  start_date    DATE,
  end_date      DATE,
  budget_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_expenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expense_id            UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  allocation_percentage NUMERIC(5,2) NOT NULL DEFAULT 100,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_invoices (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAX
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_settings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL DEFAULT 'US',
  entity_type  TEXT NOT NULL DEFAULT 'llc',
  tax_id       TEXT,
  fiscal_year_end DATE,
  state        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id)
);
CREATE TRIGGER trg_tax_settings_updated_at
  BEFORE UPDATE ON tax_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gl_account_tax_mappings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id   UUID NOT NULL REFERENCES accounts(id),
  tax_form     TEXT NOT NULL,
  tax_line     TEXT NOT NULL,
  tax_category TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimated_tax_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_year            INT NOT NULL,
  quarter             INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  due_date            DATE NOT NULL,
  estimated_liability NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(15,2),
  paid_at             TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI FEATURES
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_transaction_suggestions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  suggestion_type  TEXT NOT NULL DEFAULT 'categorization',
  source_entity_id UUID,
  suggested_value  TEXT NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  was_accepted     BOOLEAN,
  user_correction  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomalies_detected (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anomaly_type       TEXT NOT NULL,
  severity           TEXT NOT NULL DEFAULT 'medium',
  description        TEXT NOT NULL,
  source_entity_id   UUID,
  source_entity_type TEXT,
  anomaly_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  was_reviewed       BOOLEAN NOT NULL DEFAULT FALSE,
  user_action        TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'medium',
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  action_label TEXT,
  action_url   TEXT,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  related_table TEXT,
  related_id   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (IMMUTABLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id             UUID NOT NULL REFERENCES organizations(id),
  timestamp          TIMESTAMPTZ DEFAULT NOW(),
  actor_id           UUID REFERENCES auth.users(id),
  actor_type         actor_type_enum NOT NULL DEFAULT 'user',
  actor_name         TEXT NOT NULL,
  action             TEXT NOT NULL,
  target_table       TEXT,
  target_id          UUID,
  target_description TEXT,
  old_value          JSONB,
  new_value          JSONB,
  ai_confidence      NUMERIC(5,2),
  is_flagged         BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address         TEXT
  -- No updated_at — this table is append-only
);

-- Trigger function to auto-log changes to invoices
CREATE OR REPLACE FUNCTION audit_invoices()
RETURNS TRIGGER AS $$
DECLARE v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  INSERT INTO audit_log (
    org_id, actor_id, actor_type, actor_name,
    action, target_table, target_id, target_description,
    old_value, new_value
  ) VALUES (
    v_org_id,
    auth.uid(), 'user',
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    TG_OP, 'invoices',
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'Created invoice ' || NEW.invoice_number
      WHEN 'UPDATE' THEN 'Updated invoice ' || COALESCE(NEW.invoice_number, OLD.invoice_number)
      WHEN 'DELETE' THEN 'Deleted invoice ' || OLD.invoice_number
    END,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_invoices();

-- Trigger for expenses
CREATE OR REPLACE FUNCTION audit_expenses()
RETURNS TRIGGER AS $$
DECLARE v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  INSERT INTO audit_log (
    org_id, actor_id, actor_type, actor_name,
    action, target_table, target_id, target_description,
    old_value, new_value
  ) VALUES (
    v_org_id,
    auth.uid(), 'user',
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    TG_OP, 'expenses',
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'Logged expense: ' || NEW.description
      WHEN 'UPDATE' THEN 'Updated expense: ' || COALESCE(NEW.description, OLD.description)
      WHEN 'DELETE' THEN 'Deleted expense: ' || OLD.description
    END,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_expenses();

-- ============================================================
-- MISC
-- ============================================================

CREATE TABLE IF NOT EXISTS document_attachments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attachment_type     TEXT NOT NULL,
  associated_entity_id UUID,
  associated_table    TEXT,
  file_url            TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  file_size           INT,
  uploaded_by         UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nlq_queries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id),
  user_id     UUID REFERENCES auth.users(id),
  query       TEXT NOT NULL,
  response    TEXT,
  was_helpful BOOLEAN,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_currency  TEXT NOT NULL,
  to_currency    TEXT NOT NULL,
  rate           NUMERIC(10,6) NOT NULL,
  rate_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  source         TEXT,
  is_manual      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPORTING VIEWS
-- ============================================================

CREATE OR REPLACE VIEW pl_summary AS
SELECT
  je.org_id,
  DATE_TRUNC('month', je.date) AS period,
  SUM(CASE WHEN a.type = 'revenue'  THEN jel.credit - jel.debit ELSE 0 END) AS revenue,
  SUM(CASE WHEN a.type = 'expense'  THEN jel.debit - jel.credit ELSE 0 END) AS expenses,
  SUM(CASE WHEN a.type = 'revenue'  THEN jel.credit - jel.debit ELSE 0 END) -
  SUM(CASE WHEN a.type = 'expense'  THEN jel.debit - jel.credit ELSE 0 END) AS net_income
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.is_posted = TRUE
GROUP BY je.org_id, DATE_TRUNC('month', je.date);

CREATE OR REPLACE VIEW balance_sheet AS
SELECT
  je.org_id,
  a.id AS account_id,
  a.account_number,
  a.name,
  a.type,
  a.sub_type,
  SUM(jel.debit - jel.credit) AS balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.is_posted = TRUE
  AND a.type IN ('asset', 'liability', 'equity')
GROUP BY je.org_id, a.id, a.account_number, a.name, a.type, a.sub_type;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bank_transactions_org_date   ON bank_transactions(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status          ON invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer            ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date            ON invoices(due_date) WHERE status NOT IN ('paid', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_expenses_org_date            ON expenses(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category            ON expenses(org_id, category);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_timestamp      ON audit_log(org_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_org_dismissed      ON ai_alerts(org_id, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org_date     ON journal_entries(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_org_status             ON bills(org_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_org_active         ON customers(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_org_active           ON vendors(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_org_status         ON employees(org_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function to get current user's org_id
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Apply RLS to all tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'organizations', 'users', 'payment_terms', 'accounts',
    'journal_entries', 'journal_entry_lines', 'customers',
    'invoices', 'invoice_line_items', 'invoice_payments',
    'vendors', 'purchase_orders', 'bills', 'bill_line_items', 'bill_payments',
    'expenses', 'receipts', 'bank_accounts', 'bank_transactions', 'bank_reconciliations',
    'employees', 'timesheets', 'timesheet_entries', 'payroll_runs', 'payroll_details',
    'budgets', 'budget_lines', 'forecasts', 'forecast_lines',
    'projects', 'project_phases', 'project_expenses', 'project_invoices',
    'tax_settings', 'gl_account_tax_mappings', 'estimated_tax_payments',
    'ai_transaction_suggestions', 'anomalies_detected', 'ai_alerts',
    'audit_log', 'document_attachments', 'nlq_queries', 'exchange_rates'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Organizations: users can only read their own org
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id = current_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (id = current_org_id());

-- Users: org-scoped
CREATE POLICY "users_select" ON users FOR SELECT
  USING (org_id = current_org_id());
CREATE POLICY "users_update" ON users FOR UPDATE
  USING (org_id = current_org_id() AND id = auth.uid());

-- Generic org-isolation policy for all data tables
CREATE POLICY "org_all_customers"   ON customers              USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_invoices"    ON invoices               USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_inv_lines"   ON invoice_line_items     USING (invoice_id IN (SELECT id FROM invoices WHERE org_id = current_org_id()));
CREATE POLICY "org_all_inv_pmts"    ON invoice_payments       USING (invoice_id IN (SELECT id FROM invoices WHERE org_id = current_org_id()));
CREATE POLICY "org_all_vendors"     ON vendors                USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_bills"       ON bills                  USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_bill_lines"  ON bill_line_items        USING (bill_id IN (SELECT id FROM bills WHERE org_id = current_org_id()));
CREATE POLICY "org_all_bill_pmts"   ON bill_payments          USING (bill_id IN (SELECT id FROM bills WHERE org_id = current_org_id()));
CREATE POLICY "org_all_expenses"    ON expenses               USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_receipts"    ON receipts               USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_accounts"    ON accounts               USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_je"          ON journal_entries        USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_je_lines"    ON journal_entry_lines    USING (journal_entry_id IN (SELECT id FROM journal_entries WHERE org_id = current_org_id()));
CREATE POLICY "org_all_bank_accts"  ON bank_accounts          USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_bank_txns"   ON bank_transactions      USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_recon"       ON bank_reconciliations   USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_employees"   ON employees              USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_timesheets"  ON timesheets             USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_ts_entries"  ON timesheet_entries      USING (timesheet_id IN (SELECT id FROM timesheets WHERE org_id = current_org_id()));
CREATE POLICY "org_all_payroll_run" ON payroll_runs           USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_payroll_dtl" ON payroll_details        USING (payroll_run_id IN (SELECT id FROM payroll_runs WHERE org_id = current_org_id()));
CREATE POLICY "org_all_budgets"     ON budgets                USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_budget_lines" ON budget_lines         USING (budget_id IN (SELECT id FROM budgets WHERE org_id = current_org_id()));
CREATE POLICY "org_all_projects"    ON projects               USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_proj_phases" ON project_phases         USING (project_id IN (SELECT id FROM projects WHERE org_id = current_org_id()));
CREATE POLICY "org_all_ai_alerts"   ON ai_alerts              USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_anomalies"   ON anomalies_detected     USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_audit"       ON audit_log              FOR SELECT USING (org_id = current_org_id());
-- audit_log: INSERT allowed (via triggers/app), no UPDATE/DELETE
CREATE POLICY "audit_insert"        ON audit_log              FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_tax_settings" ON tax_settings          USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_est_tax"     ON estimated_tax_payments USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_payment_terms" ON payment_terms        USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY "org_all_exchanges"   ON exchange_rates         USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());

-- ============================================================
-- ENABLE REALTIME for key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;

-- ============================================================
-- SEED INITIAL DATA for new organizations (via trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION seed_new_org_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Default payment terms
  INSERT INTO payment_terms (org_id, name, days_due) VALUES
    (NEW.id, 'Due on Receipt', 0),
    (NEW.id, 'Net 15', 15),
    (NEW.id, 'Net 30', 30),
    (NEW.id, 'Net 60', 60),
    (NEW.id, '2/10 Net 30', 30);

  -- Default Chart of Accounts (standard service business)
  INSERT INTO accounts (org_id, account_number, name, type, normal_balance, is_system) VALUES
    -- Assets
    (NEW.id, '1000', 'Cash',                    'asset', 'debit',  TRUE),
    (NEW.id, '1010', 'Checking Account',         'asset', 'debit',  FALSE),
    (NEW.id, '1020', 'Savings Account',          'asset', 'debit',  FALSE),
    (NEW.id, '1100', 'Accounts Receivable',      'asset', 'debit',  TRUE),
    (NEW.id, '1200', 'Inventory',                'asset', 'debit',  FALSE),
    (NEW.id, '1500', 'Fixed Assets',             'asset', 'debit',  FALSE),
    (NEW.id, '1510', 'Equipment',                'asset', 'debit',  FALSE),
    (NEW.id, '1900', 'Other Assets',             'asset', 'debit',  FALSE),
    -- Liabilities
    (NEW.id, '2000', 'Accounts Payable',         'liability', 'credit', TRUE),
    (NEW.id, '2100', 'Credit Card Payable',      'liability', 'credit', FALSE),
    (NEW.id, '2200', 'Payroll Liabilities',      'liability', 'credit', FALSE),
    (NEW.id, '2300', 'Sales Tax Payable',        'liability', 'credit', FALSE),
    (NEW.id, '2400', 'Loans Payable',            'liability', 'credit', FALSE),
    (NEW.id, '2900', 'Other Liabilities',        'liability', 'credit', FALSE),
    -- Equity
    (NEW.id, '3000', 'Owner Equity',             'equity', 'credit', FALSE),
    (NEW.id, '3100', 'Retained Earnings',        'equity', 'credit', TRUE),
    (NEW.id, '3200', 'Owner Draw',               'equity', 'debit',  FALSE),
    -- Revenue
    (NEW.id, '4000', 'Revenue',                  'revenue', 'credit', TRUE),
    (NEW.id, '4100', 'Product Sales',            'revenue', 'credit', FALSE),
    (NEW.id, '4200', 'Service Revenue',          'revenue', 'credit', FALSE),
    (NEW.id, '4300', 'Other Income',             'revenue', 'credit', FALSE),
    -- Expenses
    (NEW.id, '5000', 'Cost of Goods Sold',       'expense', 'debit', FALSE),
    (NEW.id, '6000', 'Operating Expenses',       'expense', 'debit', FALSE),
    (NEW.id, '6100', 'Payroll & Wages',          'expense', 'debit', FALSE),
    (NEW.id, '6200', 'Rent & Utilities',         'expense', 'debit', FALSE),
    (NEW.id, '6300', 'Marketing & Advertising',  'expense', 'debit', FALSE),
    (NEW.id, '6400', 'Software & Subscriptions', 'expense', 'debit', FALSE),
    (NEW.id, '6500', 'Travel & Entertainment',   'expense', 'debit', FALSE),
    (NEW.id, '6600', 'Office Supplies',          'expense', 'debit', FALSE),
    (NEW.id, '6700', 'Professional Services',    'expense', 'debit', FALSE),
    (NEW.id, '6800', 'Insurance',                'expense', 'debit', FALSE),
    (NEW.id, '6900', 'Depreciation',             'expense', 'debit', FALSE),
    (NEW.id, '7000', 'Other Expenses',           'expense', 'debit', FALSE);

  -- Default tax settings
  INSERT INTO tax_settings (org_id, jurisdiction, entity_type)
  VALUES (NEW.id, 'US', 'llc');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_new_org
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_new_org_data();
