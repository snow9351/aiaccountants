-- Ensure invoice Stripe / delivery columns exist (send-invoice edge function)

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(15,2) NOT NULL DEFAULT 0;
