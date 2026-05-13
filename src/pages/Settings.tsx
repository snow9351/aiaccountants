import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanies, useUpdateCompany, useCompanyMembers, useOrgId, useFiscalPeriods } from "@/hooks/useCompanies";
import { usePendingInvitations } from "@/hooks/useAccountantPortal";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FiscalPeriod } from "@/integrations/supabase/types";
import {
  Building2,
  Users,
  CreditCard,
  Zap,
  Shield,
  Plug,
  Download,
  Save,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Crown,
  UserCog,
  Eye,
  Bot,
  FileJson,
  FileSpreadsheet,
  FileText,
  Package,
  ShieldCheck,
  Link2,
  Hash,
  Scale,
  Sparkles,
  AlertTriangle,
  ClipboardCheck,
  Lock,
  ChevronDown,
  CalendarRange,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Company Profile Tab                                                */
/* ------------------------------------------------------------------ */
function CompanyProfileTab() {
  const orgId = useOrgId();
  const { data: companies } = useCompanies();
  const updateCompany = useUpdateCompany();
  const { toast } = useToast();

  const company = companies?.find((c) => c.id === orgId) ?? companies?.[0];

  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [accountingMethod, setAccountingMethod] = useState("");
  const [fiscalYearStart, setFiscalYearStart] = useState("1");
  const [timezone, setTimezone] = useState("");
  const [requireAccountNumbers, setRequireAccountNumbers] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setEntityType(company.entity_type ?? "llc");
      setAccountingMethod(company.accounting_method ?? "cash");
      setFiscalYearStart(String(company.fiscal_year_start ?? 1));
      setTimezone(company.timezone ?? "America/New_York");
      setRequireAccountNumbers(company.require_account_numbers !== false);
      setDirty(false);
    }
  }, [company]);

  const handleSave = () => {
    if (!company) return;
    updateCompany.mutate(
      {
        id: company.id,
        name,
        entity_type: entityType,
        accounting_method: accountingMethod,
        fiscal_year_start: Number(fiscalYearStart),
        timezone,
        require_account_numbers: requireAccountNumbers,
      },
      {
        onSuccess: () => {
          toast({ title: "Company updated", description: "Your changes have been saved." });
          setDirty(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save changes. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const markDirty = () => setDirty(true);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Company Profile</h3>
            <p className="text-sm text-muted-foreground">Core business information and accounting configuration</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Company Name */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name" className="text-sm font-medium text-foreground">
              Company Name
            </Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              placeholder="Your company name"
              className="rounded-xl border-border/50 bg-secondary/30"
            />
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Entity Type</Label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); markDirty(); }}>
              <SelectTrigger className="rounded-xl border-border/50 bg-secondary/30">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sole_prop">Sole Proprietorship</SelectItem>
                <SelectItem value="llc">LLC</SelectItem>
                <SelectItem value="s_corp">S Corporation</SelectItem>
                <SelectItem value="c_corp">C Corporation</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="nonprofit">Non-profit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Accounting Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Accounting Method</Label>
            <Select value={accountingMethod} onValueChange={(v) => { setAccountingMethod(v); markDirty(); }}>
              <SelectTrigger className="rounded-xl border-border/50 bg-secondary/30">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash Basis</SelectItem>
                <SelectItem value="accrual">Accrual Basis</SelectItem>
                <SelectItem value="hybrid">Modified Cash (Hybrid)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal Year Start */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Fiscal Year Start</Label>
            <Select value={fiscalYearStart} onValueChange={(v) => { setFiscalYearStart(v); markDirty(); }}>
              <SelectTrigger className="rounded-xl border-border/50 bg-secondary/30">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Timezone</Label>
            <Select value={timezone} onValueChange={(v) => { setTimezone(v); markDirty(); }}>
              <SelectTrigger className="rounded-xl border-border/50 bg-secondary/30">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-secondary/15 px-4 py-3 sm:col-span-2">
            <div className="min-w-0 space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Require account numbers
              </Label>
              <p className="text-xs text-muted-foreground">
                When off, the chart of accounts allows creating GL accounts without a numeric code (numbers stay unique when present).
              </p>
            </div>
            <Switch
              checked={requireAccountNumbers}
              onCheckedChange={(v) => { setRequireAccountNumbers(v); markDirty(); }}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!dirty || updateCompany.isPending}
            className="gap-2 rounded-xl"
          >
            <Save className="h-4 w-4" />
            {updateCompany.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <FiscalYearPeriodsSection />
    </div>
  );
}

function formatPeriodDate(iso: string) {
  const safe = iso.includes("T") ? iso : `${iso}T12:00:00`;
  return new Date(safe).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function periodStatusBadgeClass(status: FiscalPeriod["status"]) {
  if (status === "open") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status === "locked") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400";
  return "border-border/50 bg-muted/50 text-muted-foreground";
}

/* ------------------------------------------------------------------ */
/*  Fiscal year periods (read-only; seeded at company creation)       */
/* ------------------------------------------------------------------ */
function FiscalYearPeriodsSection() {
  const orgId = useOrgId();
  const { data: periods = [], isLoading, isError, error } = useFiscalPeriods(orgId || undefined);

  const years = useMemo(() => {
    const ys = [...new Set(periods.map((p) => p.fiscal_year))].sort((a, b) => a - b);
    return ys;
  }, [periods]);

  const byYear = useMemo(() => {
    const m = new Map<number, FiscalPeriod[]>();
    for (const p of periods) {
      const list = m.get(p.fiscal_year) ?? [];
      list.push(p);
      m.set(p.fiscal_year, list);
    }
    return m;
  }, [periods]);

  const latestYear = years.length ? years[years.length - 1]! : null;

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <CalendarRange className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Fiscal year periods</h3>
          <p className="text-sm text-muted-foreground">
            Monthly periods created for this company (read-only). New companies get the current and next fiscal years seeded automatically.
          </p>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <p className="text-sm text-muted-foreground">Connect Supabase to load fiscal periods.</p>
      )}

      {isSupabaseConfigured && isLoading && (
        <p className="text-sm text-muted-foreground">Loading periods…</p>
      )}

      {isSupabaseConfigured && isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load fiscal periods."}
        </p>
      )}

      {isSupabaseConfigured && !isLoading && !isError && years.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No fiscal periods found for this company. They are created when the workspace is first set up. If this organization existed before that feature, ask an administrator to run a backfill.
        </p>
      )}

      {isSupabaseConfigured && !isLoading && !isError && years.length > 0 && (
        <div className="space-y-3">
          {years.map((fy) => {
            const rows = byYear.get(fy) ?? [];
            return (
              <Collapsible key={fy} defaultOpen={fy === latestYear} className="group overflow-hidden rounded-xl border border-border/40">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 bg-secondary/20 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary/35"
                  >
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                    <span className="text-foreground">Fiscal year {fy}</span>
                    <span className="ml-auto rounded-full bg-background/40 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                      {rows.length} periods
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Period</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Start</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">End</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id} className="border-border/20">
                          <TableCell className="font-medium tabular-nums">{row.period_number}</TableCell>
                          <TableCell className="text-muted-foreground">{formatPeriodDate(row.period_start)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatPeriodDate(row.period_end)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("capitalize", periodStatusBadgeClass(row.status))}>
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Team & Access Tab                                                  */
/* ------------------------------------------------------------------ */
function TeamAccessTab() {
  const orgId = useOrgId();
  const { data: members = [], isLoading, isError, error } = useCompanyMembers(orgId);
  const { data: pendingInvites = [] } = usePendingInvitations(orgId);
  const { user } = useAuth();

  const roleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="h-3 w-3" />;
      case "admin": return <UserCog className="h-3 w-3" />;
      case "accountant": return <ClipboardCheck className="h-3 w-3" />;
      case "bookkeeper": return <Users className="h-3 w-3" />;
      case "read_only": return <Eye className="h-3 w-3" />;
      case "viewer": return <Eye className="h-3 w-3" />;
      case "ai_agent": return <Bot className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "admin": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "accountant": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "bookkeeper": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "read_only": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "viewer": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "ai_agent": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  /** Demo placeholder only when Supabase is off; with Supabase, an empty list is real (or an error). */
  const displayMembers =
    members.length > 0
      ? members.filter((m: any) => m.user_id !== user?.id)
      : !isSupabaseConfigured
        ? [
            {
              user_id: user?.id ?? "demo",
              role: "owner",
              users: {
                email: user?.email ?? "jordan@connectcash.ai",
                user_metadata: user?.user_metadata ?? { full_name: "Jordan Davis" },
              },
            },
          ]
        : [];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Team Members</h3>
              <p className="text-sm text-muted-foreground">
                {displayMembers.length} active member{displayMembers.length !== 1 ? "s" : ""}
                {pendingInvites.length > 0 ? ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
          </div>
          <Link to="/accountant-portal">
            <Button variant="outline" className="gap-2 rounded-xl border-border/50">
              <ExternalLink className="h-4 w-4" />
              Accountant Portal
            </Button>
          </Link>
        </div>

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load team: {(error as Error)?.message ?? "Unknown error"}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary/30" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayMembers.map((member: any, idx: number) => {
              const email = member.users?.email ?? "Unknown";
              const fullName = member.users?.user_metadata?.full_name ?? email.split("@")[0];
              const initials = fullName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={member.user_id ?? idx}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{fullName}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>
                  </div>
                  <Badge className={cn("gap-1 border", roleColor(member.role))}>
                    {roleIcon(member.role)}
                    {member.role?.replace("_", " ")}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && isSupabaseConfigured && pendingInvites.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending invitations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              These people are not listed as members until they accept the invite link.
            </p>
            <ul className="mt-3 space-y-2">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{inv.email}</span>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {inv.role.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLoading && !isError && isSupabaseConfigured && displayMembers.length === 0 && pendingInvites.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/50 bg-secondary/10 px-4 py-6 text-center text-sm text-muted-foreground">
            No members in this organization yet. Pending invites appear below once sent; after someone accepts, they show as active members. Use the Accountant Portal to invite people.
          </p>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-border/50 bg-secondary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Manage invitations and role assignments in the{" "}
            <Link to="/accountant-portal" className="font-medium text-primary hover:underline">
              Accountant Portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Billing & Subscription Tab                                         */
/* ------------------------------------------------------------------ */
function BillingTab() {
  const orgId = useOrgId();
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const activeCompany = companies.find((c) => c.id === orgId);
  const noBillingAccess = activeCompany?.role === "bookkeeper" || activeCompany?.role === "read_only";

  const { data: subscription } = useSubscription(orgId, !companiesLoading && !noBillingAccess);

  const planDisplayNames: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    accountant: "Accountant",
    firm: "Firm",
    free: "Free",
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    trialing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    past_due: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    canceled: "bg-red-500/10 text-red-400 border-red-500/20",
    unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    active: <CheckCircle2 className="h-3 w-3" />,
    trialing: <Clock className="h-3 w-3" />,
    past_due: <AlertTriangle className="h-3 w-3" />,
    canceled: <XCircle className="h-3 w-3" />,
  };

  const planName = subscription?.plan ? (planDisplayNames[subscription.plan] ?? subscription.plan) : "Free";
  const status = subscription?.status ?? "active";
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null;

  if (companiesLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary/40" />
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-secondary/30" />
        </div>
      </div>
    );
  }

  if (noBillingAccess) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="mt-6 font-display text-lg font-semibold text-foreground">Billing is restricted</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your role on this company is <span className="font-medium text-foreground capitalize">{activeCompany?.role?.replace("_", " ")}</span>.
            Bookkeepers and read-only members cannot view subscription, payment methods, or change plans. Ask an owner or accountant if you need billing help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Billing & Subscription</h3>
            <p className="text-sm text-muted-foreground">Manage your plan and payment details</p>
          </div>
        </div>

        {/* Current Plan Card */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-foreground">{planName}</span>
                <Badge className={cn("gap-1 border", statusColors[status] ?? "bg-secondary text-muted-foreground")}>
                  {statusIcons[status]}
                  {status.replace("_", " ")}
                </Badge>
              </div>

              {status === "trialing" && daysLeft !== null && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-500/5 px-3 py-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-blue-300">
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining in trial
                    {trialEnd && (
                      <span className="text-blue-400/60"> &middot; Ends {trialEnd.toLocaleDateString()}</span>
                    )}
                  </span>
                </div>
              )}

              {subscription?.payment_method_last4 && (
                <p className="text-sm text-muted-foreground">
                  Payment: {subscription.payment_method_brand ?? "Card"} ending in {subscription.payment_method_last4}
                </p>
              )}
            </div>

            <Link to="/pricing">
              <Button className="gap-2 rounded-xl">
                <Sparkles className="h-4 w-4" />
                Upgrade Plan
              </Button>
            </Link>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-secondary/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="mt-1 text-sm font-medium text-foreground">{planName}</p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium capitalize text-foreground">{status.replace("_", " ")}</p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {status === "trialing" ? "Trial Ends" : "Next Billing"}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {trialEnd ? trialEnd.toLocaleDateString() : subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Settings Tab                                                    */
/* ------------------------------------------------------------------ */
function AISettingsTab() {
  const thresholds = [
    {
      label: "Auto-Post",
      range: ">= 95% confidence",
      description: "Transactions meeting this threshold are automatically posted to the ledger without manual review.",
      color: "from-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/20",
      iconColor: "text-emerald-400",
      icon: <CheckCircle2 className="h-5 w-5" />,
      badge: "Automated",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      label: "Review Queue",
      range: "80% - 95% confidence",
      description: "Transactions in this range are queued for human review before posting. AI pre-fills the categorization for faster approval.",
      color: "from-amber-500/10 to-amber-500/5",
      borderColor: "border-amber-500/20",
      iconColor: "text-amber-400",
      icon: <Eye className="h-5 w-5" />,
      badge: "Review Required",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      label: "Manual Flag",
      range: "< 80% confidence",
      description: "Low-confidence transactions are flagged for full manual categorization. These often involve new vendor types or unusual amounts.",
      color: "from-red-500/10 to-red-500/5",
      borderColor: "border-red-500/20",
      iconColor: "text-red-400",
      icon: <AlertTriangle className="h-5 w-5" />,
      badge: "Manual",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">AI Confidence Thresholds</h3>
            <p className="text-sm text-muted-foreground">
              How the AI categorization engine routes transactions based on confidence scores
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {thresholds.map((t) => (
            <div
              key={t.label}
              className={cn("rounded-xl border bg-gradient-to-br p-5", t.borderColor, t.color)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn("mt-0.5", t.iconColor)}>{t.icon}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-foreground">{t.label}</h4>
                      <Badge className={cn("border text-xs", t.badgeClass)}>{t.badge}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground/80">{t.range}</p>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              The AI model retrains automatically every <span className="font-medium text-foreground">24 hours</span> based on your corrections and approvals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Security Tab                                                       */
/* ------------------------------------------------------------------ */
function SecurityTab() {
  const features = [
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "Row-Level Security",
      description: "Every database table is protected by Supabase RLS policies. Users can only access data belonging to their organization.",
      detail: "Enabled on all tables",
      color: "from-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/20",
      iconColor: "text-emerald-400",
    },
    {
      icon: <Hash className="h-5 w-5" />,
      title: "SHA-256 Hash Chain",
      description: "Every ledger entry is cryptographically chained using SHA-256 hashes, creating a tamper-evident audit log similar to blockchain immutability.",
      detail: "Validated every 15 minutes",
      color: "from-blue-500/10 to-blue-500/5",
      borderColor: "border-blue-500/20",
      iconColor: "text-blue-400",
    },
    {
      icon: <Scale className="h-5 w-5" />,
      title: "Accounting Equation Enforcement",
      description: "Assets = Liabilities + Equity is continuously verified. Any imbalance is immediately detected and flagged for investigation.",
      detail: "Checked every 15 minutes",
      color: "from-purple-500/10 to-purple-500/5",
      borderColor: "border-purple-500/20",
      iconColor: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Security & Integrity</h3>
            <p className="text-sm text-muted-foreground">
              Enterprise-grade protections for your financial data
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {features.map((f) => (
            <div
              key={f.title}
              className={cn("rounded-xl border bg-gradient-to-br p-5", f.borderColor, f.color)}
            >
              <div className="flex items-start gap-4">
                <div className={cn("mt-0.5 flex-shrink-0", f.iconColor)}>{f.icon}</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-foreground">{f.title}</h4>
                    <Badge variant="outline" className="border-border/50 text-xs">{f.detail}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-secondary/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Access Control</p>
            <p className="mt-1 text-sm font-medium text-foreground">5 roles: Owner, Admin, Accountant, Viewer, AI Agent</p>
          </div>
          <div className="rounded-xl bg-secondary/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Data Encryption</p>
            <p className="mt-1 text-sm font-medium text-foreground">AES-256 at rest, TLS 1.3 in transit</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Integrations Tab                                                   */
/* ------------------------------------------------------------------ */
function IntegrationsTab() {
  const integrations = [
    {
      name: "Plaid",
      description: "Bank account sync and transaction import",
      status: "connected",
      icon: <Link2 className="h-5 w-5" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      name: "Stripe",
      description: "Subscription billing and payment processing",
      status: "connected",
      icon: <CreditCard className="h-5 w-5" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      name: "Claude AI",
      description: "Intelligent transaction categorization and analysis",
      status: "connected",
      icon: <Bot className="h-5 w-5" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Integrations</h3>
            <p className="text-sm text-muted-foreground">Connected services and third-party integrations</p>
          </div>
        </div>

        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex items-center gap-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", integration.bgColor, integration.color)}>
                  {integration.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration.status === "connected" ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data Export Tab                                                     */
/* ------------------------------------------------------------------ */
function DataExportTab() {
  const { toast } = useToast();

  const exports = [
    {
      icon: <FileJson className="h-5 w-5" />,
      title: "Export Ledger (JSON)",
      description: "Full double-entry ledger with all journal entries, metadata, and hash chain integrity proofs.",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: <FileSpreadsheet className="h-5 w-5" />,
      title: "Export Chart of Accounts (CSV)",
      description: "Complete chart of accounts with account codes, types, balances, and hierarchy.",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "QBO-Compatible Export",
      description: "QuickBooks Online compatible IIF format for easy migration to or from QBO.",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: <Package className="h-5 w-5" />,
      title: "CPA Handoff Package",
      description: "Comprehensive ZIP archive with trial balance, P&L, balance sheet, and supporting schedules ready for your CPA.",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
  ];

  const handleExport = (title: string) => {
    toast({
      title: "Export started",
      description: `Preparing "${title}"... You'll be notified when the download is ready.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Data Export</h3>
            <p className="text-sm text-muted-foreground">
              Full export always available -- even on the free tier. Your data is never held hostage.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {exports.map((exp) => (
            <div
              key={exp.title}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex items-center gap-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", exp.bgColor, exp.color)}>
                  {exp.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{exp.title}</p>
                  <p className="text-xs text-muted-foreground max-w-md">{exp.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => handleExport(exp.title)}
                className="gap-2 rounded-xl border-border/50 flex-shrink-0"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                 */
/* ------------------------------------------------------------------ */

const tabs = [
  { value: "company", label: "Company", icon: Building2 },
  { value: "team", label: "Team & Access", icon: Users },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "ai", label: "AI Settings", icon: Zap },
  { value: "security", label: "Security", icon: Shield },
  { value: "integrations", label: "Integrations", icon: Plug },
  { value: "export", label: "Data Export", icon: Download },
];

export default function Settings() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <CommandPalette />

      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your company, team, billing, and preferences
          </p>
        </div>
        {user && (
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {user.user_metadata?.full_name ?? user.email?.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(user.user_metadata?.full_name ?? user.email ?? "U")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="company" className="space-y-6">
        <div className="glass-card rounded-2xl p-1.5">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-transparent sm:grid-cols-4 lg:grid-cols-7">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2 rounded-xl px-3 py-2.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:text-sm"
              >
                <tab.icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="company"><CompanyProfileTab /></TabsContent>
        <TabsContent value="team"><TeamAccessTab /></TabsContent>
        <TabsContent value="billing"><BillingTab /></TabsContent>
        <TabsContent value="ai"><AISettingsTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="export"><DataExportTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
