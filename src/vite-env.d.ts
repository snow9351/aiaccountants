/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** JSON: plan name → { monthly?, annually? } Stripe Price IDs (see src/lib/stripePlanPriceIds.ts). */
  readonly VITE_STRIPE_PLAN_PRICE_IDS?: string;
}
