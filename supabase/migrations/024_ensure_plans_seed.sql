-- 024: Ensure public.plans always has the four MVP rows (idempotent upsert).
-- Fixes remote DBs where 002 insert was skipped, failed, or plans were deleted.

INSERT INTO public.plans (name, display_name, price_monthly, price_annually, max_companies, max_users, features)
VALUES
  ('starter',    'Starter',    1900,  19000,  1,  2,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true}'::jsonb),
  ('pro',        'Pro',        3900,  39000,  3,  5,  '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true}'::jsonb),
  ('accountant', 'Accountant', 7900,  79000,  10, 15, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true}'::jsonb),
  ('firm',       'Firm',       14900, 149000, 99, 99, '{"invoicing":true,"expenses":true,"banking":true,"reports":true,"payroll":true,"projects":true,"budgets":true,"ai_categorization":true,"firm_access":true,"client_management":true,"white_label":true}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  price_annually = EXCLUDED.price_annually,
  max_companies = EXCLUDED.max_companies,
  max_users = EXCLUDED.max_users,
  features = EXCLUDED.features,
  is_active = true;
