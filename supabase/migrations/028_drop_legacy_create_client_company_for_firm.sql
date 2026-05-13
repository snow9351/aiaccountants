-- 028: Remove legacy create_client_company_for_firm signature (keeps the v2 one)

DROP FUNCTION IF EXISTS public.create_client_company_for_firm(TEXT, TEXT, TEXT, TEXT);

