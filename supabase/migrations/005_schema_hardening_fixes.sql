-- ============================================================
-- Migration: aiaccountants schema fixes and improvements
-- Date: 2024-04-11
-- Description: Schema hardening, enum conversions, new columns,
--              RLS fixes, and performance indexes
-- Applied via: Supabase SQL Editor (manual)
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1: CREATE ENUMS
-- ------------------------------------------------------------

-- Journal entry lifecycle status
CREATE TYPE journal_entry_status AS ENUM (
  'draft', 'pending_review', 'posted', 'voided'
);

-- Normal balance type for chart of accounts
CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');

-- Financial statement section for chart of accounts
CREATE TYPE fs_section_type AS ENUM (
  'current_assets', 'fixed_assets', 'current_liabilities',
  'long_term_liabilities', 'equity', 'revenue', 'cogs',
  'operating_expenses', 'other_income', 'other_expenses'
);

-- AI suggestion types
CREATE TYPE suggestion_type_enum AS ENUM (
  'categorization', 'account_mapping', 'vendor_match',
  'duplicate_detection', 'anomaly', 'journal_entry'
);

-- Audit log action types
CREATE TYPE audit_action_type AS ENUM (
  'create', 'update', 'delete', 'void',
  'post', 'approve', 'reject', 'ai_suggest',
  'ai_apply', 'period_close', 'period_reopen'
);


-- ------------------------------------------------------------
-- STEP 2: JOURNAL_ENTRIES — void support + status lifecycle
-- ------------------------------------------------------------

ALTER TABLE journal_entries
ADD COLUMN is_voided boolean NOT NULL DEFAULT false,
ADD COLUMN voided_by uuid REFERENCES users(id),
ADD COLUMN voided_at timestamptz,
ADD COLUMN void_reason text,
ADD COLUMN period_closed boolean NOT NULL DEFAULT false;

ALTER TABLE journal_entries
ADD COLUMN status journal_entry_status NOT NULL DEFAULT 'draft';


-- ------------------------------------------------------------
-- STEP 3: JOURNAL_ENTRY_LINES — integrity + org isolation
-- ------------------------------------------------------------

ALTER TABLE journal_entry_lines
ADD COLUMN org_id uuid REFERENCES organizations(id),
ADD COLUMN updated_at timestamptz DEFAULT now(),
ADD COLUMN is_voided boolean NOT NULL DEFAULT false;

-- Enforce that each line is either a debit OR a credit, not both
ALTER TABLE journal_entry_lines
ADD CONSTRAINT chk_debit_credit
  CHECK (
    (debit > 0 AND credit = 0) OR
    (credit > 0 AND debit = 0) OR
    (debit = 0 AND credit = 0)
  );


-- ------------------------------------------------------------
-- STEP 4: BANK_TRANSACTIONS — proper GL account linkage
-- ------------------------------------------------------------

ALTER TABLE bank_transactions
ADD COLUMN account_id uuid REFERENCES accounts(id);


-- ------------------------------------------------------------
-- STEP 5: ACCOUNTS — enum conversions + new columns
-- ------------------------------------------------------------

-- Drop the text-based check constraint before converting type
ALTER TABLE accounts
DROP CONSTRAINT accounts_normal_balance_check;

-- Drop default before type conversion
ALTER TABLE accounts
ALTER COLUMN normal_balance DROP DEFAULT;

-- Convert normal_balance from text to enum
ALTER TABLE accounts
ALTER COLUMN normal_balance TYPE normal_balance_type
USING normal_balance::normal_balance_type;

-- Restore default using enum type
ALTER TABLE accounts
ALTER COLUMN normal_balance SET DEFAULT 'debit'::normal_balance_type;

-- Add new columns
ALTER TABLE accounts
ADD COLUMN is_reconcilable boolean NOT NULL DEFAULT false,
ADD COLUMN fs_section fs_section_type,
ADD COLUMN sort_order integer;


-- ------------------------------------------------------------
-- STEP 6: AI_TRANSACTION_SUGGESTIONS — enum + missing columns
-- ------------------------------------------------------------

-- Drop default before type conversion
ALTER TABLE ai_transaction_suggestions
ALTER COLUMN suggestion_type DROP DEFAULT;

-- Convert suggestion_type from text to enum
ALTER TABLE ai_transaction_suggestions
ALTER COLUMN suggestion_type TYPE suggestion_type_enum
USING suggestion_type::suggestion_type_enum;

-- Restore default
ALTER TABLE ai_transaction_suggestions
ALTER COLUMN suggestion_type SET DEFAULT 'categorization'::suggestion_type_enum;

-- Convert suggested_value from text to jsonb for structured suggestions
ALTER TABLE ai_transaction_suggestions
ALTER COLUMN suggested_value TYPE jsonb
USING suggested_value::jsonb;

-- Add missing columns (skip if already exist)
ALTER TABLE ai_transaction_suggestions
ADD COLUMN IF NOT EXISTS model_version text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS source_table text,
ADD COLUMN IF NOT EXISTS metadata jsonb;


-- ------------------------------------------------------------
-- STEP 7: AUDIT_LOG — action enum conversion
-- ------------------------------------------------------------

ALTER TABLE audit_log
ALTER COLUMN action TYPE audit_action_type
USING action::audit_action_type;


-- ------------------------------------------------------------
-- STEP 8: ROW LEVEL SECURITY — fix unprotected tables
-- ------------------------------------------------------------

ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see own MFA settings"
ON mfa_settings
FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Org members can only see own stripe data"
ON stripe_customers
FOR ALL
USING (org_id IN (
  SELECT org_id FROM company_memberships
  WHERE user_id = auth.uid()
));


-- ------------------------------------------------------------
-- STEP 9: PERFORMANCE INDEXES
-- ------------------------------------------------------------

-- journal_entry_lines: most queried table in any GL
CREATE INDEX idx_journal_entry_lines_entry_id
ON journal_entry_lines(journal_entry_id);

CREATE INDEX idx_journal_entry_lines_account_id
ON journal_entry_lines(account_id);

-- bank_transactions: reconciliation workflow
CREATE INDEX idx_bank_tx_matched
ON bank_transactions(org_id, is_matched, is_reconciled);

-- ai_transaction_suggestions: queried constantly by AI engine
CREATE INDEX idx_ai_suggestions_org_status
ON ai_transaction_suggestions(org_id, was_accepted);

CREATE INDEX idx_ai_suggestions_source
ON ai_transaction_suggestions(source_entity_id);

-- anomalies_detected: org filter for dashboard
CREATE INDEX idx_anomalies_org_created
ON anomalies_detected(org_id, created_at DESC);

-- vendors and bills: AP workflow
CREATE INDEX idx_vendors_org_name
ON vendors(org_id, name);

CREATE INDEX idx_bills_vendor
ON bills(vendor_id);

-- revenue_schedules: deferred revenue reports
CREATE INDEX idx_revenue_schedules_contract
ON revenue_schedules(contract_id);


-- ============================================================
-- END OF MIGRATION
-- ============================================================
