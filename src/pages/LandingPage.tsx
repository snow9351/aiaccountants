import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Building2,
  ChartColumnIncreasing,
  CheckCircle2,
  Command,
  Database,
  Eye,
  Fingerprint,
  Globe,
  Layers3,
  Lock,
  MessageSquareText,
  ReceiptText,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Workflow,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { BillingIntervalToggle, type BillingInterval } from "@/components/pricing/BillingIntervalToggle";
import { formatPlanPrice, LANDING_PLAN_PRICES } from "@/lib/pricingDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { Menu, X } from "lucide-react";

/* ─── Data ─── */

const competitorComparison = [
  { feature: "AI actions logged with confidence scores", us: true, intuit: false, xero: false },
  { feature: "Immutable append-only event ledger", us: true, intuit: false, xero: false },
  { feature: "Month-end close workflow", us: true, intuit: false, xero: false },
  { feature: "ASC 606 revenue recognition", us: true, intuit: false, xero: false },
  { feature: "Custom categorization rules", us: true, intuit: "partial", xero: false },
  { feature: "Accountant collaboration portal", us: true, intuit: "partial", xero: "partial" },
  { feature: "Accrual automation", us: true, intuit: false, xero: false },
  { feature: "NL-to-SQL ad-hoc reporting", us: true, intuit: false, xero: false },
  { feature: "Fraud detection + 3σ anomaly scoring", us: true, intuit: false, xero: false },
  { feature: "US-native payroll (IRS Pub 15-T)", us: true, intuit: false, xero: false },
  { feature: "Multi-entity with auto intercompany elimination", us: true, intuit: "partial", xero: false },
  { feature: "AI on every tier including free", us: true, intuit: false, xero: false },
  { feature: "NL invoicing", us: true, intuit: true, xero: true },
  { feature: "Auto bank reconciliation", us: true, intuit: true, xero: true },
  { feature: "Cash flow forecasting", us: true, intuit: true, xero: false },
];

const painPoints = [
  {
    icon: Sparkles,
    title: "Setup in minutes, not hours",
    description: "Tell us your business type. We configure your chart of accounts, tax settings, and invoice templates automatically. No accounting degree required.",
    metric: "First invoice in under 5 minutes",
  },
  {
    icon: Command,
    title: "Just say what you need",
    description: '"Invoice Acme $5,000 net-30" — done. The command palette understands plain English and learns your shortcuts over time.',
    metric: "Every task in 2 steps or fewer",
  },
  {
    icon: WalletCards,
    title: "Reconciliation on autopilot",
    description: "Our AI matches 90%+ of bank transactions automatically. It learns your vendors, catches duplicates, and flags anything unusual before you even look.",
    metric: "500 transactions in under 10 minutes",
  },
  {
    icon: BrainCircuit,
    title: "Gets smarter every day",
    description: "Every correction you make teaches the system. Categories, vendors, patterns — accuracy climbs past 92% within 90 days and keeps improving.",
    metric: "92%+ accuracy, always learning",
  },
  {
    icon: ChartColumnIncreasing,
    title: "Reports in plain English",
    description: '"Show me top customers by profit margin last quarter." Instant answer. Export to CSV or Excel in one click. No report builder needed.',
    metric: "Any report in under 30 seconds",
  },
  {
    icon: Bot,
    title: "Insights that come to you",
    description: "AI Accountants doesn't wait for you to ask. It surfaces cash runway risks, overdue invoices, and spending anomalies before they become problems.",
    metric: "90-day cash flow forecasting",
  },
  {
    icon: Shield,
    title: "Built-in fraud protection",
    description: "Every transaction is scored for anomalies in real time. Duplicate charges, unusual amounts, and suspicious patterns are caught automatically.",
    metric: "Under 3% false positive rate",
  },
  {
    icon: Fingerprint,
    title: "Audit-proof by default",
    description: "Every action is permanently recorded — who did it, when, and why. Your auditor can search the trail in plain English. Nothing is ever overwritten.",
    metric: "Tamper-evident, always exportable",
  },
  {
    icon: Building2,
    title: "Multi-entity without the headache",
    description: "Run multiple companies from one dashboard. Intercompany transactions are detected and eliminated automatically. Consolidated reports in one click.",
    metric: "Up to 20 entities, zero slowdown",
  },
];

const architectureLayers = [
  { label: "Bank APIs", sublabel: "Plaid · Finicity · Direct", color: "bg-info/20 text-info border-info/30" },
  { label: "Raw Transactions", sublabel: "Append-only source data", color: "bg-muted/30 text-muted-foreground border-border/40" },
  { label: "Normalization + Dedup", sublabel: "Fuzzy resolution · Fingerprint", color: "bg-muted/30 text-muted-foreground border-border/40" },
  { label: "AI Classification", sublabel: "Confidence routing", color: "bg-accent/15 text-accent border-accent/30" },
  { label: "Transaction Service", sublabel: "Only path to ledger", color: "bg-primary/15 text-primary border-primary/30" },
  { label: "Event Store", sublabel: "Immutable double-entry", color: "bg-primary/20 text-primary border-primary/40" },
  { label: "Metrics Cache + Webhooks", sublabel: "Real-time KPIs · Event bus", color: "bg-success/15 text-success border-success/30" },
];

const modules = [
  "AI auto-categorization with confidence scoring",
  "Month-end close workflow (16-task checklist)",
  "Revenue recognition (ASC 606) — 4 methods",
  "Categorization rules engine",
  "Accountant/CPA collaboration portal",
  "Accrual management with auto-reversal",
  "Bank reconciliation with period locking",
  "Real-time reports: P&L, Balance Sheet, Cash Flow",
  "Payroll with IRS Pub 15-T compliance",
  "Multi-entity with auto COA generation",
  "Google OAuth + TOTP MFA",
  "Immutable audit trail with hash chain",
  "Natural language AI chat",
  "Project costing and budgeting",
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$19",
    subtitle: "per month",
    features: ["1 entity", "AI categorization", "Bank reconciliation", "Basic reports (P&L, Balance Sheet)", "Google OAuth + MFA"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$39",
    subtitle: "per month",
    features: ["Up to 3 entities", "Month-end close workflow", "Revenue recognition (ASC 606)", "Accrual management", "Categorization rules engine"],
    cta: "Start building",
    highlight: true,
  },
  {
    name: "Accountant",
    price: "$79",
    subtitle: "per month",
    features: ["Up to 10 entities", "CPA collaboration portal", "Project costing & budgeting", "Payroll (IRS Pub 15-T)", "Priority support"],
    cta: "Start today",
    highlight: false,
  },
  {
    name: "Firm",
    price: "$149",
    subtitle: "per month",
    features: ["Unlimited entities", "Auto COA generation", "Immutable audit trail", "Dedicated onboarding", "SLA guarantees"],
    cta: "Talk to us",
    highlight: false,
  },
];

const proof = [
  { label: "Common tasks", value: "≤ 2 steps" },
  { label: "Auto-match rate", value: "90%+" },
  { label: "Forecast horizon", value: "90 days" },
  { label: "Ad-hoc reports", value: "Plain English" },
];

/* ─── Component ─── */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeArch, setActiveArch] = useState(4);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appHref = isAuthenticated ? "/dashboard" : "/login";
  const planHref = isAuthenticated ? "/pricing" : "/login?redirect=/pricing";
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  const tiersWithPrices = useMemo(
    () =>
      pricingTiers.map((tier) => {
        const cents = LANDING_PLAN_PRICES[tier.name];
        const billing =
          cents != null
            ? formatPlanPrice(cents.monthlyCents, cents.annualCents, billingInterval)
            : null;
        return { ...tier, billing };
      }),
    [billingInterval],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-mesh text-foreground">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="font-display text-base sm:text-lg font-bold text-foreground">AI Accountants</p>
              <p className="hidden sm:block text-[10px] uppercase tracking-[0.3em] text-primary">AI-native accounting</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#thesis" className="transition-colors hover:text-foreground">Thesis</a>
            <a href="#pain-points" className="transition-colors hover:text-foreground">Pain Points</a>
            <a href="#architecture" className="transition-colors hover:text-foreground">Architecture</a>
            <a href="#comparison" className="transition-colors hover:text-foreground">vs QBO & Xero</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to={appHref}
              className="glass-subtle hidden rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/40 md:inline-flex"
            >
              {isAuthenticated ? "Open dashboard" : "Sign in"}
            </Link>
            <Link
              to={isAuthenticated ? "/pricing" : "/login"}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
            >
              {isAuthenticated ? "View plans" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border/30 bg-background/95 backdrop-blur-xl md:hidden animate-fade-in">
            <div className="space-y-1 px-4 py-4">
              {[
                { href: "#thesis", label: "Thesis" },
                { href: "#pain-points", label: "Pain Points" },
                { href: "#architecture", label: "Architecture" },
                { href: "#comparison", label: "vs QBO & Xero" },
                { href: "#pricing", label: "Pricing" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <Link
                to={isAuthenticated ? "/pricing" : "/login"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {isAuthenticated ? "View plans" : "Get started free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─── Hero ─── */}
        <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-28">
          <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute right-10 bottom-10 h-60 w-60 rounded-full bg-accent/10 blur-[100px]" />

          <div className="relative text-center">
            <ScrollReveal delay={0} direction="down" distance={20}>
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground glass-subtle">
                <Bot className="h-3.5 w-3.5 text-primary" />
                The future of accounting is here
              </div>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <h1 className="mx-auto mt-6 sm:mt-8 max-w-5xl font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl xl:text-7xl">
                Your books should <span className="text-primary">think for themselves.</span>{" "}
                <span className="text-muted-foreground">Now they do.</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg leading-7 sm:leading-8 text-muted-foreground">
                AI-native accounting built from the ground up. Month-end close workflows, ASC 606 revenue recognition,
                accrual automation, and real-time collaboration with your accountant — all powered by AI, all in plain English.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={450}>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  to={appHref}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-primary px-6 sm:px-8 py-3.5 sm:py-4 text-base font-semibold text-primary-foreground transition-all hover:opacity-90"
                >
                  {isAuthenticated ? "Open dashboard" : "Start for free"}
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#pain-points"
                  className="glass-subtle inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 sm:px-8 py-3.5 sm:py-4 text-base font-medium text-foreground transition-all hover:border-primary/40"
                >
                  <Database className="h-4 w-4 text-primary" />
                  See how it works
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={600}>
              <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {proof.map((item, i) => (
                  <ScrollReveal key={item.label} delay={600 + i * 100}>
                    <div className="glass-card rounded-2xl p-5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                      <p className="mt-2 font-display text-2xl font-bold text-foreground">{item.value}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Thesis ─── */}
        <section id="thesis" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div className="glass-card rounded-[2rem] p-8 lg:p-10">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Why not QuickBooks?</p>
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                  QuickBooks added AI. We started with it.
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Intuit's AI features sit on top of a 20-year-old database that overwrites your data.
                  When the AI makes a mistake, the original is gone — no history, no undo, no confidence score.
                </p>
                <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                  <p className="text-sm font-semibold text-destructive">The core problem</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    You can't bolt intelligence onto a system designed to be passive.
                    AI Accountants records <span className="font-medium text-foreground">every decision, every correction, every confidence score</span> — by design, not as an afterthought.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={150}>
              <div className="glass-card rounded-[2rem] p-8 lg:p-10">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Why not Xero?</p>
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                  Xero has JAX. We have the whole brain.
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Xero's AI assistant is impressive — but it still writes to a passive ledger
                  with no audit trail for AI actions, no multi-entity, and no US payroll.
                </p>
                <div className="mt-6 rounded-2xl border border-warning/20 bg-warning/5 p-5">
                  <p className="text-sm font-semibold text-warning">What's missing</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    No fraud detection. No natural-language reporting. No confidence scoring.
                    AI Accountants ships all of these on every plan — including free.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Product Preview ─── */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ScrollReveal>
          <div className="glass-card relative overflow-hidden rounded-[2rem] border border-border/60 p-5 shadow-2xl lg:p-8">
            <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />

            <div className="relative grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/40 bg-card/50 p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <Command className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                    Ask AI Accountants anything
                  </p>
                  <kbd className="rounded-md border border-border/50 bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
                </div>
                <p className="mt-5 text-base leading-7 text-foreground">
                  "Create invoice for Acme $5,000 net-30, check their payment history, and draft a follow-up if overdue."
                </p>
                <div className="mt-5 space-y-2">
                  {[
                    { step: "Invoice #1049 drafted — $5,000 to Acme Corp, due May 3", icon: CheckCircle2, color: "text-success" },
                    { step: "AR risk: Acme has 2 invoices > 60 days — payment likelihood 62%", icon: Eye, color: "text-warning" },
                    { step: "Collection email queued — firm tone (60-day overdue template)", icon: MessageSquareText, color: "text-info" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                      <s.icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`} />
                      <p className="text-sm text-foreground">{s.step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-border/40 bg-card/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Live metrics</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Cash runway", value: "8.2 months", color: "text-success" },
                      { label: "AR at risk", value: "$18.3K", color: "text-warning" },
                      { label: "Auto-match", value: "96.4%", color: "text-primary" },
                      { label: "AI accuracy", value: "94.2%", color: "text-accent" },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className={`font-display text-lg font-bold ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-primary">AI Insight</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    AWS charge $4,820 — 3.2x above 90-day average. Possible billing spike detected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
        </section>

        {/* ─── Pain Points ─── */}
        <section id="pain-points" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <ScrollReveal>
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Built to fix what's broken</p>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                Every QuickBooks frustration, solved.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                We studied the top 100 complaints from real QBO users and built solutions directly into the product — not as workarounds, but as core features.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {painPoints.map((item, i) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={i * 80}>
                  <article className="glass-card group rounded-3xl p-6 transition-all duration-300 h-full">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                    <div className="mt-5 inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                      {item.metric}
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* ─── Architecture ─── */}
        <section id="architecture" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <ScrollReveal direction="left">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">How it works under the hood</p>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                  One pipeline. Total control. Full transparency.
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Every transaction flows through a single secure pipeline. High-confidence items post automatically.
                  Lower confidence? You review first. Nothing touches your books without your knowledge.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    { icon: Lock, text: "Append-only ledger — no UPDATE or DELETE ever" },
                    { icon: Database, text: "Double-entry balance validated before commit" },
                    { icon: Shield, text: "SHA-256 hash chain — tamper-evident" },
                    { icon: Globe, text: "Row-level security on ALL tables" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 rounded-xl border border-border/30 bg-secondary/30 p-3">
                      <item.icon className="h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm text-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <div className="glass-card rounded-[2rem] p-6 lg:p-8">
                <p className="mb-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Data flow — top to bottom</p>
                <div className="space-y-2">
                  {architectureLayers.map((layer, i) => (
                    <button
                      key={layer.label}
                      onClick={() => setActiveArch(i)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                        activeArch === i
                          ? layer.color + " scale-[1.02] shadow-lg"
                          : "border-border/30 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{layer.label}</p>
                        <p className="mt-0.5 text-xs opacity-70">{layer.sublabel}</p>
                      </div>
                      {i < architectureLayers.length - 1 && (
                        <span className="text-xs opacity-50">↓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Competitor Comparison ─── */}
        <section id="comparison" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <ScrollReveal>
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Side-by-side comparison</p>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                See what they can't do.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                A feature-by-feature comparison of what's actually shipped — not roadmap promises.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mx-auto mt-10 max-w-4xl glass-card overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Capability</th>
                      <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-primary">AI Accountants</th>
                      <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Intuit IES</th>
                      <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Xero JAX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorComparison.map((row, i) => (
                      <tr key={i} className="border-b border-border/20 transition-colors hover:bg-secondary/20">
                        <td className="px-6 py-3.5 text-sm text-foreground">{row.feature}</td>
                        <td className="px-6 py-3.5 text-center">
                          {row.us && <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {row.intuit === true ? (
                            <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground/50" />
                          ) : row.intuit === "partial" ? (
                            <span className="text-xs text-warning">Partial</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {row.xero === true ? (
                            <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground/50" />
                          ) : row.xero === "partial" ? (
                            <span className="text-xs text-warning">Partial</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ─── Modules ─── */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <ScrollReveal direction="left">
              <div className="glass-card rounded-[2rem] p-8 lg:p-10 h-full">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Everything you need</p>
                <h2 className="mt-3 font-display text-3xl font-bold text-foreground">Every feature, built in from day one.</h2>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {modules.map((module) => (
                    <div key={module} className="flex items-start gap-3 rounded-2xl border border-border/40 bg-card/50 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <p className="text-sm leading-6 text-foreground">{module}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={150}>
              <div className="glass-card rounded-[2rem] p-8 lg:p-10 h-full">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Our promises to you</p>
                <h2 className="mt-3 font-display text-3xl font-bold text-foreground">Security principles we'll never compromise.</h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  These aren't guidelines — they're hard rules baked into every layer of the system. Your data integrity is non-negotiable.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    "Your financial history is append-only. Nothing is ever overwritten or deleted.",
                    "Every transaction is double-entry validated before it hits the books.",
                    "AI never writes directly to your ledger — it always goes through review first.",
                    "Your data is isolated at the database level. No one else can see it. Period.",
                    "Every AI decision is logged with a confidence score and model version.",
                    "Cryptographic hash chain ensures your records are tamper-proof.",
                    "Export all your data anytime — even on the free plan. Your data is yours.",
                  ].map((rule) => (
                    <div key={rule} className="flex items-start gap-3 rounded-xl border border-destructive/15 bg-destructive/5 p-3">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <p className="text-xs leading-5 text-foreground">{rule}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <ScrollReveal>
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Simple, honest pricing</p>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground md:text-4xl">
                Four plans. Full AI on every one.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                From solo founders to multi-partner firms. Every plan includes AI categorization, bank reconciliation, and real-time reports. Scale up as you grow.
              </p>
            </div>
          </ScrollReveal>

          <BillingIntervalToggle
            value={billingInterval}
            onChange={setBillingInterval}
            size="lg"
            className="mx-auto mt-8"
          />

          <div className="pricing-plan-grid mx-auto mt-10 max-w-6xl">
            {tiersWithPrices.map((tier, i) => (
              <div key={tier.name} className="h-full">
              <ScrollReveal delay={i * 150}>
                <div
                  className={cn(
                    "pricing-plan-card h-full",
                    tier.highlight && "pricing-plan-card--featured pricing-plan-card--selected",
                  )}
                >
                  {tier.highlight ? (
                    <span className="pricing-plan-badge-popular">Most popular</span>
                  ) : (
                    <span className="pricing-plan-badge-spacer" aria-hidden />
                  )}
                  <h3 className={cn("text-xl font-bold", tier.highlight ? "text-primary" : "text-foreground")}>
                    {tier.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={
                          tier.highlight ? "pricing-plan-price--featured" : "pricing-plan-price--default"
                        }
                      >
                        {tier.billing ? `$${tier.billing.perMonthLabel}` : tier.price}
                      </span>
                      {tier.billing && <span className="text-sm text-muted-foreground">/mo</span>}
                    </div>
                    {tier.billing && billingInterval === "annually" && tier.billing.savings > 0 && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                        Save {tier.billing.savings}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tier.billing?.billedLine ?? tier.subtitle}
                  </p>

                  <div className="mt-6 flex-1 space-y-3">
                    {tier.features.map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        <p className="text-sm text-foreground">{f}</p>
                      </div>
                    ))}
                  </div>

                  <Link
                    to={planHref}
                    className={`mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                      tier.highlight
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "glass-subtle text-foreground hover:border-primary/40"
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </ScrollReveal>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-20">
          <ScrollReveal distance={30}>
            <div className="glass-card relative overflow-hidden rounded-[2rem] p-10 text-center lg:p-16">
              <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-primary/15 blur-[80px]" />
              <div className="absolute -bottom-20 -right-20 h-52 w-52 rounded-full bg-accent/15 blur-[80px]" />

              <div className="relative">
                <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold text-foreground md:text-5xl">
                  Stop fighting your accounting software.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  AI Accountants handles the busywork so you can focus on growing your business. Start free — no credit card, no setup, no BS.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to={appHref}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground transition-all hover:opacity-90"
                  >
                    <Zap className="h-5 w-5" />
                    {isAuthenticated ? "Open dashboard" : "Get started free"}
                  </Link>
                </div>
              </div>
            </div>
           </ScrollReveal>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 bg-background/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">AI Accountants</p>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 AI Accountants. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
