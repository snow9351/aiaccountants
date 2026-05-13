/**
 * Optional JSON map so Pricing / Checkout work before DB columns are filled.
 * Keys are plan `name` values (starter, pro, accountant, firm).
 *
 * Example (.env):
 * VITE_STRIPE_PLAN_PRICE_IDS={"starter":{"monthly":"price_xxx","annually":"price_yyy"},"pro":{"monthly":"price_..."}}
 *
 * Deploy the same object as Supabase secret STRIPE_PLAN_PRICE_IDS for create-checkout-session.
 */
/** One-line template; replace every `price_…` with IDs from Stripe → Product → Pricing. */
export const STRIPE_PLAN_PRICE_IDS_JSON_TEMPLATE =
  '{"starter":{"monthly":"price_xxx","annually":"price_yyy"},"pro":{"monthly":"price_xxx","annually":"price_yyy"},"accountant":{"monthly":"price_xxx","annually":"price_yyy"},"firm":{"monthly":"price_xxx","annually":"price_yyy"}}';

/** Plan `name` values used on the Pricing page and in Checkout. */
export const PRICING_PLAN_NAMES = ["starter", "pro", "accountant", "firm"] as const;

export function pricingPlanNamesMissingStripeInterval<
  T extends { name: string; stripe_price_id_monthly?: string | null; stripe_price_id_annually?: string | null },
>(plans: T[] | undefined, interval: "monthly" | "annually"): string[] {
  const field = interval === "annually" ? "stripe_price_id_annually" : "stripe_price_id_monthly";
  return PRICING_PLAN_NAMES.filter((name) => {
    const row = plans?.find((p) => p.name === name);
    if (!row) return true;
    return !String(row[field as keyof T] ?? "").trim();
  });
}

/** Canonical list-price cents when DB values are missing or clearly wrong (Table Editor typos). */
export const MVP_PLAN_PRICE_FALLBACK_CENTS: Record<
  (typeof PRICING_PLAN_NAMES)[number],
  { price_monthly: number; price_annually: number }
> = {
  starter: { price_monthly: 1900, price_annually: 19000 },
  pro: { price_monthly: 3900, price_annually: 39000 },
  accountant: { price_monthly: 7900, price_annually: 79000 },
  firm: { price_monthly: 14900, price_annually: 149000 },
};

function isBrokenMonthlyCents(cents: unknown): boolean {
  const n = typeof cents === "number" ? cents : Number(cents);
  return !Number.isFinite(n) || n < 1000;
}

function isBrokenAnnualCents(cents: unknown): boolean {
  const n = typeof cents === "number" ? cents : Number(cents);
  return !Number.isFinite(n) || n < 5000;
}

/** Pricing cards only; Stripe still uses DB / env Price IDs. */
export function planDisplayPriceCents<
  T extends { name: string; price_monthly: number; price_annually: number },
>(plan: T, field: "price_monthly" | "price_annually"): number {
  const raw = plan[field];
  const fb = MVP_PLAN_PRICE_FALLBACK_CENTS[plan.name as keyof typeof MVP_PLAN_PRICE_FALLBACK_CENTS];
  if (!fb) return raw;
  if (field === "price_monthly" && isBrokenMonthlyCents(raw)) return fb.price_monthly;
  if (field === "price_annually" && isBrokenAnnualCents(raw)) return fb.price_annually;
  return raw;
}

export type StripePlanPriceOverride = { monthly?: string; annually?: string };
export type StripePlanPriceOverrideMap = Record<string, StripePlanPriceOverride>;

export function parseStripePlanPriceOverrideMap(raw: string | undefined): StripePlanPriceOverrideMap | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    return v as StripePlanPriceOverrideMap;
  } catch {
    return undefined;
  }
}

export function mergePlansWithStripePriceEnv<
  T extends { name: string; stripe_price_id_monthly?: string | null; stripe_price_id_annually?: string | null },
>(plans: T[], rawEnv: string | undefined): T[] {
  const map = parseStripePlanPriceOverrideMap(rawEnv);
  if (!map) return plans;
  return plans.map((p) => {
    const o = map[p.name];
    if (!o) return p;
    const m = p.stripe_price_id_monthly?.trim();
    const a = p.stripe_price_id_annually?.trim();
    return {
      ...p,
      stripe_price_id_monthly: m || o.monthly?.trim() || p.stripe_price_id_monthly || null,
      stripe_price_id_annually: a || o.annually?.trim() || p.stripe_price_id_annually || null,
    };
  });
}
