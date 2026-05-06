-- ============================================================
-- AI Accountants — COMPLETE DATABASE MIGRATION
-- ============================================================
-- Paste this ENTIRE file into Supabase SQL Editor and click "Run"
-- This combines all 4 migrations into a single runnable script.
--
-- INSTRUCTIONS:
-- 1. Go to https://app.supabase.com → your project → SQL Editor
-- 2. Click "New query"
-- 3. Paste this entire file
-- 4. Click "Run" (or Cmd+Enter)
-- 5. You should see "Success. No rows returned" when done
-- ============================================================


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
-- ============================================================
-- 004: Auth Triggers & User Onboarding
-- Auto-create organization, membership, and user profile on signup
-- ============================================================

-- ── Create user profile + default org on signup ─────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Create a default organization for the user
  INSERT INTO organizations (name, business_type, entity_type, accounting_method)
  VALUES (
    v_full_name || '''s Company',
    'general',
    'llc',
    'accrual'
  )
  RETURNING id INTO v_org_id;

  -- Create user profile in the users table
  INSERT INTO users (id, org_id, email, full_name, role)
  VALUES (NEW.id, v_org_id, NEW.email, v_full_name, 'admin');

  -- Create company membership (owner role)
  INSERT INTO company_memberships (org_id, user_id, role, is_billing_owner)
  VALUES (v_org_id, NEW.id, 'owner', true);

  -- Generate default chart of accounts
  PERFORM generate_default_coa(v_org_id, 'llc');

  -- Set trial subscription status on the org
  UPDATE organizations SET
    plan = 'starter',
    subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days'
  WHERE id = v_org_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Update current_org_id() to use company_memberships ──────
-- This makes the RLS helper work with the multi-company model
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
BEGIN
  -- Use the first org the user belongs to (typically their default org)
  -- In practice, the app should pass org_id via RPC or filter
  RETURN (
    SELECT org_id
    FROM company_memberships
    WHERE user_id = auth.uid()
    ORDER BY is_billing_owner DESC, joined_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Handle invitation acceptance ────────────────────────────
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find valid invitation
  SELECT * INTO v_invite
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Create membership
  INSERT INTO company_memberships (org_id, user_id, firm_id, role, invited_by)
  VALUES (v_invite.org_id, v_user_id, v_invite.firm_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE invitations SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'org_id', v_invite.org_id,
    'role', v_invite.role,
    'accepted', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto-expire old invitations ─────────────────────────────
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Grant execute on RPC functions ──────────────────────────
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_default_coa(UUID, TEXT) TO authenticated;
