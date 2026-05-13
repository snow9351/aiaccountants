import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Building2, Star, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  STRIPE_PLAN_PRICE_IDS_JSON_TEMPLATE,
  pricingPlanNamesMissingStripeInterval,
  planDisplayPriceCents,
} from "@/lib/stripePlanPriceIds";
import { usePlans, useCreateCheckoutSession, type Plan } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/useCompanies";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FEATURE_LABELS: Record<string, string> = {
  invoicing: "Invoicing & A/R",
  expenses: "Expense tracking",
  banking: "Bank connections",
  reports: "Financial reports",
  payroll: "Payroll management",
  projects: "Project tracking",
  budgets: "Budget vs. actuals",
  ai_categorization: "AI transaction categorization",
  firm_access: "Firm management portal",
  client_management: "Multi-client management",
  white_label: "White-label branding",
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  pro: Star,
  accountant: Building2,
  firm: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  starter: "border-border/50",
  pro: "border-primary ring-2 ring-primary/30",
  accountant: "border-info/50",
  firm: "border-accent/50",
};

/** Shown when Supabase env is missing (demo) or API returns no rows after load. */
const DEMO_PLANS: Plan[] = [
  {
    id: "demo-starter",
    name: "starter",
    display_name: "Starter",
    price_monthly: 1900,
    price_annually: 19000,
    max_companies: 1,
    max_users: 2,
    features: { invoicing: true, expenses: true, banking: true, reports: true },
  },
  {
    id: "demo-pro",
    name: "pro",
    display_name: "Pro",
    price_monthly: 3900,
    price_annually: 39000,
    max_companies: 3,
    max_users: 5,
    features: {
      invoicing: true,
      expenses: true,
      banking: true,
      reports: true,
      payroll: true,
      projects: true,
      budgets: true,
      ai_categorization: true,
    },
  },
  {
    id: "demo-accountant",
    name: "accountant",
    display_name: "Accountant",
    price_monthly: 7900,
    price_annually: 79000,
    max_companies: 10,
    max_users: 15,
    features: {
      invoicing: true,
      expenses: true,
      banking: true,
      reports: true,
      payroll: true,
      projects: true,
      budgets: true,
      ai_categorization: true,
      firm_access: true,
      client_management: true,
    },
  },
  {
    id: "demo-firm",
    name: "firm",
    display_name: "Firm",
    price_monthly: 14900,
    price_annually: 149000,
    max_companies: 99,
    max_users: 99,
    features: {
      invoicing: true,
      expenses: true,
      banking: true,
      reports: true,
      payroll: true,
      projects: true,
      budgets: true,
      ai_categorization: true,
      firm_access: true,
      client_management: true,
      white_label: true,
    },
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const orgId = useOrgId();
  const { data, isLoading, isError, error, refetch, isFetching } = usePlans();
  const checkout = useCreateCheckoutSession();
  const [interval, setInterval] = useState<"monthly" | "annually">("monthly");

  const plans = useMemo(() => {
    if (data && data.length > 0) return data;
    if (!isSupabaseConfigured) return DEMO_PLANS;
    if (!isLoading && (isError || !data?.length)) return DEMO_PLANS;
    return [];
  }, [data, isLoading, isError, isSupabaseConfigured]);

  /** UI fallback only — does not mean Stripe is configured. */
  const showingDemoPlanCards =
    !isSupabaseConfigured || (isSupabaseConfigured && (isError || !data?.length) && !isLoading);

  const plansFromDatabase = !!(isSupabaseConfigured && !isLoading && !isError && data && data.length > 0);

  const planNamesMissingStripe = useMemo(
    () => pricingPlanNamesMissingStripeInterval(data, interval),
    [data, interval],
  );
  const anyPlanMissingStripeForInterval = planNamesMissingStripe.length > 0;

  const stripeReadyForPlan = (plan: Plan) => {
    const pid = interval === "annually" ? plan.stripe_price_id_annually : plan.stripe_price_id_monthly;
    return typeof pid === "string" && pid.trim().length > 0;
  };

  const canAttemptCheckout = plansFromDatabase && !!user && !!orgId;

  const handleSelect = (planName: string) => {
    if (!user) {
      navigate("/login?redirect=/pricing");
      return;
    }
    if (!orgId) {
      toast({
        title: "Select a company",
        description: "Use the company switcher in the sidebar to select the workspace you want to bill, then try again.",
        variant: "destructive",
      });
      return;
    }
    if (!isSupabaseConfigured) {
      toast({
        title: "Checkout unavailable",
        description: "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable billing.",
        variant: "destructive",
      });
      return;
    }
    if (!plansFromDatabase) {
      toast({
        title: "Plans not loaded from the database",
        description:
          (error as Error)?.message ??
          "Apply migrations (including grants on public.plans), ensure plan rows exist, then refresh. You can still see reference prices below.",
        variant: "destructive",
      });
      return;
    }
    const row = data?.find((p) => p.name === planName);
    if (row && !stripeReadyForPlan(row)) {
      toast({
        title: "Stripe price not configured",
        description: `Set stripe_price_id_${interval === "annually" ? "annually" : "monthly"} on the "${planName}" row in public.plans (Stripe Dashboard → Product → Price ID).`,
        variant: "destructive",
      });
      return;
    }
    checkout.mutate({ plan: planName, billing_interval: interval, org_id: orgId, user_id: user.id });
  };

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="mx-auto max-w-7xl px-4 py-16">
        {isSupabaseConfigured && !isLoading && !isError && (!data || data.length === 0) && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium">No plan rows in the database</p>
              <p className="mt-1 text-muted-foreground">
                Run migrations (plan seed is in <span className="font-mono text-foreground">002_auth_billing_multicompany.sql</span>) or insert rows into{" "}
                <span className="font-mono text-foreground">public.plans</span>. Then set{" "}
                <span className="font-mono text-foreground">stripe_price_id_monthly</span> /{" "}
                <span className="font-mono text-foreground">stripe_price_id_annually</span> from your Stripe Dashboard so Checkout can start subscriptions.
              </p>
            </div>
          </div>
        )}

        {isError && isSupabaseConfigured && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Could not load plans from the API</p>
              <p className="mt-1 text-destructive/90">{(error as Error)?.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Showing reference prices below. If the error mentions permission denied, apply the latest migrations (including the one that grants SELECT on{" "}
                <span className="font-mono text-foreground">plans</span> to API roles), and ensure your database was seeded with plan rows.
              </p>
            </div>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="mb-8 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 text-center text-sm text-muted-foreground">
            Supabase is not configured. Showing static plan layout for UI preview; checkout requires env keys and a linked project.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-4">
            <Zap className="h-3.5 w-3.5" /> 14-day free trial on all plans
          </div>
          <h1 className="font-display text-5xl font-bold text-foreground">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">From solo founders to accounting firms. Cancel anytime.</p>

          {/* Interval toggle */}
          <div className="mt-8 inline-flex items-center rounded-xl border border-border/50 bg-secondary/20 p-1">
            <button onClick={() => setInterval("monthly")} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Monthly
            </button>
            <button onClick={() => setInterval("annually")} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", interval === "annually" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Annually <span className="ml-1 text-xs opacity-70">Save ~17%</span>
            </button>
          </div>

          {plansFromDatabase && anyPlanMissingStripeForInterval && (
            <div className="mx-auto mt-6 max-w-2xl space-y-3 rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
              <p className="text-center text-foreground">
                Add Stripe recurring <span className="font-mono">price_…</span> IDs to{" "}
                <span className="font-mono">
                  stripe_price_id_{interval === "annually" ? "annually" : "monthly"}
                </span>{" "}
                for: <span className="font-semibold">{planNamesMissingStripe.join(", ")}</span>.
              </p>
              <p className="text-center text-xs leading-relaxed">
                List prices (<span className="font-mono">price_monthly</span> / <span className="font-mono">price_annually</span>) already update the cards — checkout
                uses different columns. Copy IDs from Stripe → Product catalog → each price.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="inline-flex items-center"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Reloading…
                    </>
                  ) : (
                    "Reload plans"
                  )}
                </Button>
                <details className="text-xs">
                  <summary className="cursor-pointer text-primary hover:underline">Env JSON override</summary>
                  <p className="mt-2 max-w-md text-left text-muted-foreground">
                    Set <span className="font-mono">VITE_STRIPE_PLAN_PRICE_IDS</span> and the same JSON as Supabase secret{" "}
                    <span className="font-mono">STRIPE_PLAN_PRICE_IDS</span> on <span className="font-mono">create-checkout-session</span>. Restart dev server after{" "}
                    <span className="font-mono">.env</span> changes.
                  </p>
                  <pre className="mt-2 max-h-28 max-w-md overflow-auto whitespace-pre-wrap break-all rounded border bg-background/80 p-2 font-mono text-[10px] leading-relaxed">
                    {STRIPE_PLAN_PRICE_IDS_JSON_TEMPLATE}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && isSupabaseConfigured && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading plans…</p>
            </div>
          )}
          {(isLoading && isSupabaseConfigured ? [] : plans).map((plan) => {
            const Icon = PLAN_ICONS[plan.name] ?? Zap;
            const displayMonthly = planDisplayPriceCents(plan, "price_monthly");
            const displayAnnual = planDisplayPriceCents(plan, "price_annually");
            const price = interval === "annually" ? displayAnnual / 12 : displayMonthly;
            const isPopular = plan.name === "pro";
            const planRow = plansFromDatabase ? data?.find((p) => p.name === plan.name) : undefined;
            const stripeOk = !plansFromDatabase || (planRow ? stripeReadyForPlan(planRow) : false);
            const buttonDisabled =
              checkout.isPending || !canAttemptCheckout || !stripeOk;

            return (
              <div key={plan.id} className={cn("glass-card relative rounded-2xl p-6 flex flex-col", PLAN_COLORS[plan.name])}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-foreground">{plan.display_name}</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="font-display text-4xl font-bold text-foreground">${(price / 100).toFixed(0)}</span>
                    <span className="text-muted-foreground mb-1">/mo</span>
                  </div>
                  {interval === "annually" && (
                    <p className="text-xs text-success mt-1">Billed ${(displayAnnual / 100).toFixed(0)}/year</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Up to {plan.max_companies === 99 ? "unlimited" : plan.max_companies} {plan.max_companies === 1 ? "company" : "companies"} · {plan.max_users === 99 ? "unlimited" : plan.max_users} users
                  </p>
                </div>

                <Button
                  className={cn("w-full rounded-xl mb-6", isPopular ? "" : "bg-secondary/50 text-foreground hover:bg-secondary")}
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSelect(plan.name)}
                  disabled={buttonDisabled}
                  title={
                    !plansFromDatabase
                      ? showingDemoPlanCards
                        ? "Load plans from Supabase (migrations + grants) to enable checkout"
                        : "Loading…"
                      : !user
                        ? "Sign in to subscribe"
                        : !orgId
                          ? "Select a company in the sidebar"
                          : !stripeOk
                            ? "Set Stripe Price IDs on this plan in the database"
                            : undefined
                  }
                >
                  {!plansFromDatabase
                    ? showingDemoPlanCards
                      ? "Checkout unavailable"
                      : "Loading…"
                    : !user
                      ? "Sign in to subscribe"
                      : !orgId
                        ? "Select company"
                        : !stripeOk
                          ? "Configure Stripe price"
                          : "Start free trial"}
                </Button>

                <ul className="space-y-2.5 flex-1">
                  {Object.entries(plan.features).filter(([, v]) => v).map(([key]) => (
                    <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      {FEATURE_LABELS[key] ?? key}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Revenue share note */}
        <div className="mt-10 glass-card rounded-2xl p-6 text-center max-w-2xl mx-auto">
          <p className="text-sm font-medium text-foreground">Accountant revenue share program</p>
          <p className="mt-1 text-sm text-muted-foreground">Enroll clients on ConnectCash AI and earn a monthly commission on their subscription. Contact us at <span className="text-primary">partners@connectcash.ai</span> to learn more.</p>
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-sm">Questions? <a href="mailto:hello@connectcash.ai" className="text-primary hover:underline">hello@connectcash.ai</a></p>
          <button onClick={() => navigate("/dashboard")} className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
