-- ============================================================
-- Seed data for AI Accountants
-- Runs after migrations during `supabase db reset`
-- ============================================================

-- Plans are seeded in migration 002, so skip if they exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM plans LIMIT 1) THEN
    INSERT INTO plans (name, display_name, price_monthly, price_annually, max_companies, max_users, features) VALUES
      ('starter',    'Starter',    1900,  19000,  1,  2,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true}'),
      ('pro',        'Pro',        3900,  39000,  3,  5,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true}'),
      ('accountant', 'Accountant', 7900,  79000,  10, 15, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true}'),
      ('firm',       'Firm',       14900, 149000, 99, 99, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true,"white_label":true}');
  END IF;
END $$;

-- ============================================================
-- Demo organization + data (created via auth trigger in production)
-- For local dev, we create a demo org with sample data
-- ============================================================

-- Create a demo organization
INSERT INTO organizations (id, name, business_type, entity_type, accounting_method, fiscal_year_end_month, base_currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'Acme Technologies Inc', 'saas', 'llc', 'accrual', 12, 'USD')
ON CONFLICT (id) DO NOTHING;

-- Generate default chart of accounts for the demo org
SELECT generate_default_coa('00000000-0000-0000-0000-000000000001'::UUID, 'llc');

-- Demo customers
INSERT INTO customers (org_id, name, email, phone, is_active, payment_score, total_revenue, ar_balance, industry)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'TechStart Inc', 'billing@techstart.io', '(415) 555-0101', true, 95, 85000, 12500, 'Technology'),
  ('00000000-0000-0000-0000-000000000001', 'Global Finance Ltd', 'ap@globalfinance.com', '(212) 555-0202', true, 88, 120000, 25000, 'Financial Services'),
  ('00000000-0000-0000-0000-000000000001', 'RetailMax', 'accounts@retailmax.co', '(312) 555-0303', true, 72, 45000, 8500, 'Retail'),
  ('00000000-0000-0000-0000-000000000001', 'HealthFirst Clinic', 'billing@healthfirst.org', '(617) 555-0404', true, 91, 67000, 0, 'Healthcare')
ON CONFLICT DO NOTHING;

-- Demo vendors
INSERT INTO vendors (org_id, name, email, is_1099, is_active, total_spend, ap_balance, reliability_score)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Amazon Web Services', 'billing@aws.amazon.com', false, true, 48000, 4200, 99),
  ('00000000-0000-0000-0000-000000000001', 'Gusto Payroll', 'invoicing@gusto.com', false, true, 3600, 300, 98),
  ('00000000-0000-0000-0000-000000000001', 'WeWork', 'billing@wework.com', false, true, 54000, 4500, 95),
  ('00000000-0000-0000-0000-000000000001', 'Wilson & Associates LLP', 'billing@wilsonlaw.com', true, true, 22500, 7500, 90),
  ('00000000-0000-0000-0000-000000000001', 'Adobe Systems', 'ar@adobe.com', false, true, 7200, 600, 99)
ON CONFLICT DO NOTHING;

-- Demo bank account
INSERT INTO bank_accounts (id, org_id, account_name, bank_name, account_type, currency, current_balance, account_number_masked, is_active, sync_status)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Business Checking', 'Mercury Bank', 'checking', 'USD', 241000.00, '****4521', true, 'synced'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Business Savings', 'Mercury Bank', 'savings', 'USD', 150000.00, '****7832', true, 'synced')
ON CONFLICT (id) DO NOTHING;

-- Demo bank transactions
INSERT INTO bank_transactions (org_id, bank_account_id, date, description, amount, type, category, merchant, is_reconciled, is_matched)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-01', 'STRIPE PAYOUT - March revenue', 28500.00, 'income', 'Revenue', 'Stripe', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-02', 'AMAZON WEB SERVICES AWS.AMAZON.CO', -4200.00, 'expense', 'Cloud Hosting', 'AWS', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-02', 'GUSTO PAYROLL 040124', -18750.00, 'expense', 'Payroll', 'Gusto', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-03', 'WEWORK MONTHLY RENT', -4500.00, 'expense', 'Rent', 'WeWork', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-03', 'ADOBE CREATIVE CLOUD', -599.88, 'expense', 'Software', 'Adobe', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-04', 'ACH DEPOSIT - TechStart Inc', 12500.00, 'income', 'Revenue', 'TechStart Inc', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-04', 'UBER TRIP 04/04', -45.30, 'expense', 'Travel', 'Uber', false, false),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '2024-04-05', 'STAPLES OFFICE SUPPLIES', -287.45, 'expense', 'Office Supplies', 'Staples', false, false)
ON CONFLICT DO NOTHING;

-- Demo employees
INSERT INTO employees (org_id, first_name, last_name, email, job_title, department, hire_date, status, employment_type, salary, salary_frequency)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Jordan', 'Davis', 'jordan@acmetech.com', 'CEO & Founder', 'Executive', '2023-01-01', 'active', 'full_time', 150000, 'annual'),
  ('00000000-0000-0000-0000-000000000001', 'Sarah', 'Chen', 'sarah@acmetech.com', 'Lead Engineer', 'Engineering', '2023-03-15', 'active', 'full_time', 135000, 'annual'),
  ('00000000-0000-0000-0000-000000000001', 'Mike', 'Rodriguez', 'mike@acmetech.com', 'Product Designer', 'Design', '2023-06-01', 'active', 'full_time', 115000, 'annual'),
  ('00000000-0000-0000-0000-000000000001', 'Alex', 'Kim', 'alex@acmetech.com', 'Marketing Manager', 'Marketing', '2023-09-01', 'active', 'full_time', 95000, 'annual')
ON CONFLICT DO NOTHING;
