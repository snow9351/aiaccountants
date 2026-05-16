-- 031: Feature 5 — Customers & Vendors (Contacts)
-- Unified contacts with type customer | vendor | both, default GL accounts, 1099 YTD tracking

DO $$ BEGIN
  CREATE TYPE public.contact_type AS ENUM ('customer', 'vendor', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Contacts (canonical contact record)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  contact_type public.contact_type NOT NULL,
  billing_address JSONB,
  shipping_address JSONB,
  tax_id TEXT,
  is_1099_eligible BOOLEAN NOT NULL DEFAULT false,
  payment_terms_id UUID REFERENCES public.payment_terms(id),
  default_income_account_id UUID REFERENCES public.accounts(id),
  default_expense_account_id UUID REFERENCES public.accounts(id),
  email TEXT,
  phone TEXT,
  notes TEXT,
  ytd_1099_payments NUMERIC(15,2) NOT NULL DEFAULT 0,
  ytd_1099_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contacts_customer_vendor_check CHECK (
    (contact_type = 'customer' AND customer_id IS NOT NULL AND vendor_id IS NULL)
    OR (contact_type = 'vendor' AND vendor_id IS NOT NULL AND customer_id IS NULL)
    OR (contact_type = 'both' AND customer_id IS NOT NULL AND vendor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_contacts_org_active ON public.contacts(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_org_type ON public.contacts(org_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_1099_ytd ON public.contacts(org_id, is_1099_eligible, ytd_1099_year)
  WHERE is_1099_eligible = true;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend customers / vendors for legacy queries and joins
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS default_income_account_id UUID REFERENCES public.accounts(id);

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address JSONB,
  ADD COLUMN IF NOT EXISTS default_expense_account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS ytd_1099_payments NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ytd_1099_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT;

-- Backfill display_name from name
UPDATE public.customers SET display_name = name WHERE display_name IS NULL;
UPDATE public.vendors SET display_name = name WHERE display_name IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 1099 YTD: roll up bill payments to vendor + linked contact
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_vendor_1099_ytd(p_vendor_id UUID, p_year INT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
  v_total NUMERIC(15,2);
  v_org UUID;
BEGIN
  SELECT org_id INTO v_org FROM public.vendors WHERE id = p_vendor_id;
  IF v_org IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(bp.amount), 0) INTO v_total
  FROM public.bill_payments bp
  INNER JOIN public.bills b ON b.id = bp.bill_id
  WHERE b.vendor_id = p_vendor_id
    AND b.org_id = v_org
    AND EXTRACT(YEAR FROM bp.payment_date)::INT = v_year;

  UPDATE public.vendors
  SET ytd_1099_payments = v_total, ytd_1099_year = v_year
  WHERE id = p_vendor_id;

  UPDATE public.contacts
  SET ytd_1099_payments = v_total, ytd_1099_year = v_year
  WHERE vendor_id = p_vendor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_bill_payment_refresh_1099()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
  v_year INT;
BEGIN
  SELECT b.vendor_id, EXTRACT(YEAR FROM COALESCE(NEW.payment_date, OLD.payment_date))::INT
  INTO v_vendor_id, v_year
  FROM public.bills b
  WHERE b.id = COALESCE(NEW.bill_id, OLD.bill_id);

  IF v_vendor_id IS NOT NULL THEN
    PERFORM public.refresh_vendor_1099_ytd(v_vendor_id, v_year);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS bill_payments_refresh_1099 ON public.bill_payments;
CREATE TRIGGER bill_payments_refresh_1099
  AFTER INSERT OR UPDATE OR DELETE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_bill_payment_refresh_1099();

-- Vendors at or above IRS 1099-NEC threshold (data capture; generation is post-MVP)
CREATE OR REPLACE FUNCTION public.vendors_1099_threshold(p_org_id UUID, p_year INT DEFAULT NULL)
RETURNS TABLE (
  contact_id UUID,
  vendor_id UUID,
  display_name TEXT,
  tax_id TEXT,
  ytd_1099_payments NUMERIC,
  threshold NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS contact_id,
    v.id AS vendor_id,
    COALESCE(c.display_name, v.display_name, v.name) AS display_name,
    COALESCE(c.tax_id, v.tax_id) AS tax_id,
    COALESCE(c.ytd_1099_payments, v.ytd_1099_payments, 0) AS ytd_1099_payments,
    600::NUMERIC AS threshold
  FROM public.vendors v
  LEFT JOIN public.contacts c ON c.vendor_id = v.id AND c.org_id = v.org_id
  WHERE v.org_id = p_org_id
    AND (v.is_1099 = true OR c.is_1099_eligible = true)
    AND COALESCE(c.ytd_1099_year, v.ytd_1099_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT)
      = COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT)
    AND COALESCE(c.ytd_1099_payments, v.ytd_1099_payments, 0) >= 600;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_vendor_1099_ytd(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendors_1099_threshold(UUID, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- create_contact RPC (atomic customer / vendor / both)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_contact(
  p_org_id UUID,
  p_contact_type public.contact_type,
  p_display_name TEXT,
  p_legal_name TEXT DEFAULT NULL,
  p_billing_address JSONB DEFAULT NULL,
  p_shipping_address JSONB DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_is_1099_eligible BOOLEAN DEFAULT false,
  p_payment_terms_id UUID DEFAULT NULL,
  p_default_income_account_id UUID DEFAULT NULL,
  p_default_expense_account_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_contact_id UUID;
  v_customer_id UUID;
  v_vendor_id UUID;
  v_display TEXT := trim(p_display_name);
  v_legal TEXT := NULLIF(trim(COALESCE(p_legal_name, '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_display = '' THEN RAISE EXCEPTION 'Display name is required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.org_id = p_org_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF p_contact_type IN ('customer', 'both') THEN
    INSERT INTO public.customers (
      org_id, name, display_name, legal_name, email, phone,
      billing_address, shipping_address, tax_id, payment_terms_id,
      default_income_account_id, notes, is_active
    ) VALUES (
      p_org_id, v_display, v_display, v_legal, NULLIF(trim(p_email), ''),
      NULLIF(trim(p_phone), ''), p_billing_address, p_shipping_address,
      NULLIF(trim(p_tax_id), ''), p_payment_terms_id, p_default_income_account_id,
      NULLIF(trim(p_notes), ''), true
    )
    RETURNING id INTO v_customer_id;
  END IF;

  IF p_contact_type IN ('vendor', 'both') THEN
    INSERT INTO public.vendors (
      org_id, name, display_name, legal_name, email, phone,
      address, billing_address, tax_id, payment_terms_id,
      default_expense_account_id, notes, is_1099, is_active
    ) VALUES (
      p_org_id, v_display, v_display, v_legal, NULLIF(trim(p_email), ''),
      NULLIF(trim(p_phone), ''), p_billing_address, p_billing_address,
      NULLIF(trim(p_tax_id), ''), p_payment_terms_id, p_default_expense_account_id,
      NULLIF(trim(p_notes), ''), COALESCE(p_is_1099_eligible, false), true
    )
    RETURNING id INTO v_vendor_id;
  END IF;

  INSERT INTO public.contacts (
    org_id, display_name, legal_name, contact_type,
    billing_address, shipping_address, tax_id, is_1099_eligible,
    payment_terms_id, default_income_account_id, default_expense_account_id,
    email, phone, notes, customer_id, vendor_id
  ) VALUES (
    p_org_id, v_display, v_legal, p_contact_type,
    p_billing_address, p_shipping_address, NULLIF(trim(p_tax_id), ''),
    COALESCE(p_is_1099_eligible, false), p_payment_terms_id,
    p_default_income_account_id, p_default_expense_account_id,
    NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_notes), ''), v_customer_id, v_vendor_id
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contact(
  UUID, public.contact_type, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID, TEXT, TEXT, TEXT
) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS: contacts + vendors (membership-scoped)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_org_memberships ON public.contacts;
CREATE POLICY contacts_org_memberships ON public.contacts
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_all_vendors" ON public.vendors;
CREATE POLICY vendors_org_memberships ON public.vendors
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT cm.org_id FROM public.company_memberships cm WHERE cm.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vendors TO authenticated;

-- Default payment terms per org (if missing)
CREATE OR REPLACE FUNCTION public.seed_default_payment_terms(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payment_terms WHERE org_id = p_org_id LIMIT 1) THEN
    INSERT INTO public.payment_terms (org_id, name, days_due) VALUES
      (p_org_id, 'Due on receipt', 0),
      (p_org_id, 'Net 15', 15),
      (p_org_id, 'Net 30', 30),
      (p_org_id, 'Net 60', 60);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_payment_terms(UUID) TO authenticated;

-- Backfill contacts from existing customers / vendors
INSERT INTO public.contacts (
  org_id, display_name, legal_name, contact_type, email, phone,
  billing_address, shipping_address, tax_id, payment_terms_id,
  default_income_account_id, notes, customer_id, is_active
)
SELECT
  c.org_id,
  COALESCE(c.display_name, c.name),
  c.legal_name,
  'customer'::public.contact_type,
  c.email,
  c.phone,
  c.billing_address,
  c.shipping_address,
  c.tax_id,
  c.payment_terms_id,
  c.default_income_account_id,
  c.notes,
  c.id,
  c.is_active
FROM public.customers c
WHERE NOT EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.customer_id = c.id);

INSERT INTO public.contacts (
  org_id, display_name, legal_name, contact_type, email, phone,
  billing_address, tax_id, is_1099_eligible, payment_terms_id,
  default_expense_account_id, notes, vendor_id, is_active,
  ytd_1099_payments, ytd_1099_year
)
SELECT
  v.org_id,
  COALESCE(v.display_name, v.name),
  v.legal_name,
  'vendor'::public.contact_type,
  v.email,
  v.phone,
  COALESCE(v.billing_address, v.address),
  v.tax_id,
  v.is_1099,
  v.payment_terms_id,
  v.default_expense_account_id,
  v.notes,
  v.id,
  v.is_active,
  v.ytd_1099_payments,
  v.ytd_1099_year
FROM public.vendors v
WHERE NOT EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.vendor_id = v.id);

-- Keep customers / vendors in sync when contact row is edited
CREATE OR REPLACE FUNCTION public.sync_contact_to_ar_ap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers SET
      name = NEW.display_name,
      display_name = NEW.display_name,
      legal_name = NEW.legal_name,
      email = NEW.email,
      phone = NEW.phone,
      billing_address = NEW.billing_address,
      shipping_address = NEW.shipping_address,
      tax_id = NEW.tax_id,
      payment_terms_id = NEW.payment_terms_id,
      default_income_account_id = NEW.default_income_account_id,
      notes = NEW.notes,
      is_active = NEW.is_active
    WHERE id = NEW.customer_id;
  END IF;
  IF NEW.vendor_id IS NOT NULL THEN
    UPDATE public.vendors SET
      name = NEW.display_name,
      display_name = NEW.display_name,
      legal_name = NEW.legal_name,
      email = NEW.email,
      phone = NEW.phone,
      address = NEW.billing_address,
      billing_address = NEW.billing_address,
      tax_id = NEW.tax_id,
      payment_terms_id = NEW.payment_terms_id,
      default_expense_account_id = NEW.default_expense_account_id,
      is_1099 = NEW.is_1099_eligible,
      notes = NEW.notes,
      is_active = NEW.is_active
    WHERE id = NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_sync_ar_ap ON public.contacts;
CREATE TRIGGER contacts_sync_ar_ap
  AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_contact_to_ar_ap();
