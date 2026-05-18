import { MVP_PLAN_PRICE_FALLBACK_CENTS } from "@/lib/stripePlanPriceIds";

export type BillingInterval = "monthly" | "annually";

export function annualSavingsPercent(monthlyCents: number, annualCents: number): number {
  if (monthlyCents <= 0 || annualCents <= 0) return 0;
  const perMonthAnnual = annualCents / 12;
  return Math.max(0, Math.round((1 - perMonthAnnual / monthlyCents) * 100));
}

export function formatPlanPrice(monthlyCents: number, annualCents: number, interval: BillingInterval) {
  const monthly = monthlyCents / 100;
  const annualTotal = annualCents / 100;
  const perMonth = interval === "annually" ? annualTotal / 12 : monthly;
  const savings = annualSavingsPercent(monthlyCents, annualCents);
  return {
    perMonth,
    perMonthLabel: perMonth.toFixed(0),
    monthly,
    annualTotal,
    savings,
    billedLine:
      interval === "annually"
        ? `Billed $${annualTotal.toFixed(0)}/year`
        : "Billed monthly",
  };
}

/** Landing page static tier keys */
export const LANDING_PLAN_PRICES: Record<
  string,
  { monthlyCents: number; annualCents: number }
> = {
  Starter: {
    monthlyCents: MVP_PLAN_PRICE_FALLBACK_CENTS.starter.price_monthly,
    annualCents: MVP_PLAN_PRICE_FALLBACK_CENTS.starter.price_annually,
  },
  Pro: {
    monthlyCents: MVP_PLAN_PRICE_FALLBACK_CENTS.pro.price_monthly,
    annualCents: MVP_PLAN_PRICE_FALLBACK_CENTS.pro.price_annually,
  },
  Accountant: {
    monthlyCents: MVP_PLAN_PRICE_FALLBACK_CENTS.accountant.price_monthly,
    annualCents: MVP_PLAN_PRICE_FALLBACK_CENTS.accountant.price_annually,
  },
  Firm: {
    monthlyCents: MVP_PLAN_PRICE_FALLBACK_CENTS.firm.price_monthly,
    annualCents: MVP_PLAN_PRICE_FALLBACK_CENTS.firm.price_annually,
  },
};
