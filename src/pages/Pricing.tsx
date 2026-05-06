import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlans, useCreateCheckoutSession } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/useCompanies";

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

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = useOrgId();
  const { data: plans = [] } = usePlans();
  const checkout = useCreateCheckoutSession();
  const [interval, setInterval] = useState<"monthly" | "annually">("monthly");

  const handleSelect = (planName: string) => {
    if (!user) { navigate("/login?redirect=/pricing"); return; }
    checkout.mutate({ plan: planName, billing_interval: interval, org_id: orgId, user_id: user.id });
  };

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="mx-auto max-w-7xl px-4 py-16">
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
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map(plan => {
            const Icon = PLAN_ICONS[plan.name] ?? Zap;
            const price = interval === "annually" ? plan.price_annually / 12 : plan.price_monthly;
            const isPopular = plan.name === "pro";

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
                    <p className="text-xs text-success mt-1">Billed ${(plan.price_annually / 100).toFixed(0)}/year</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Up to {plan.max_companies === 99 ? "unlimited" : plan.max_companies} {plan.max_companies === 1 ? "company" : "companies"} · {plan.max_users === 99 ? "unlimited" : plan.max_users} users
                  </p>
                </div>

                <Button
                  className={cn("w-full rounded-xl mb-6", isPopular ? "" : "bg-secondary/50 text-foreground hover:bg-secondary")}
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSelect(plan.name)}
                  disabled={checkout.isPending}
                >
                  Start free trial
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
