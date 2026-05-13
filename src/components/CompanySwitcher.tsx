import { useState } from "react";
import { Building2, ChevronDown, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateCompany, type Company } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { useMyFirm } from "@/hooks/useFirm";
import { useAuth } from "@/contexts/AuthContext";

function roleSubtitle(role: string | undefined): string {
  switch (role) {
    case "owner":
      return "Owner — full access";
    case "accountant":
      return "Invited accountant — client books";
    case "bookkeeper":
      return "Invited bookkeeper";
    case "read_only":
      return "View only";
    default:
      return role ?? "Member";
  }
}

export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useCompanies();
  const companies = (data ?? []).filter((c) => c.id && c.name);
  const { activeOrgId, setActiveOrgId } = useCompanyStore();
  const createCompany = useCreateCompany();
  const { data: firm, isPending: firmLoading, isError: firmError } = useMyFirm();

  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    entity_type: "llc",
    accounting_method: "cash",
    industry: "general",
    fiscal_year_start: 1,
    timezone: "America/New_York",
    ein: "",
  });

  const active = companies.find(c => c.id === activeOrgId) ?? companies[0];

  /**
   * Only owners can create standalone companies from the switcher.
   * Accountants should create client companies from the Accountant Portal instead.
   */
  const hasFirm = !!firm?.id;
  // If firm is still loading, don't show actions that depend on it (prevents confusing flash).
  const isOwnerSomewhere = companies.some((c) => c.role === "owner");
  const onboarding = (user?.user_metadata as any)?.onboarding as string | undefined;
  const skipDefaultWorkspace = (user?.user_metadata as any)?.skip_default_workspace as string | boolean | undefined;
  const isAccountantPersona = onboarding === "accountant";
  const isInviteOnlySignup = skipDefaultWorkspace === true || skipDefaultWorkspace === "true";

  // Owners can always add companies; if the list is empty (fresh business signup / transient fetch),
  // allow Add Company only for non-accountant personas to avoid encouraging accountants to create standalone orgs.
  const canAddCompany =
    !firmLoading &&
    (isOwnerSomewhere || (companies.length === 0 && !hasFirm && !isAccountantPersona && !isInviteOnlySignup));

  const handleCreate = async () => {
    if (!form.name) { toast({ title: "Company name required", variant: "destructive" }); return; }
    try {
      const company = await createCompany.mutateAsync(form);
      setActiveOrgId(company.id);
      toast({ title: "Company created", description: `${form.name} — COA auto-generated` });
      setShowCreateDialog(false);
      setForm({
        name: "",
        entity_type: "llc",
        accounting_method: "cash",
        industry: "general",
        fiscal_year_start: 1,
        timezone: "America/New_York",
        ein: "",
      });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground">
        <Building2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
              {active?.name?.slice(0, 2).toUpperCase() ?? "—"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{active?.name ?? "Select company"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {active ? roleSubtitle(active.role) : isLoading ? "Loading…" : ""}
              </p>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] w-[min(18rem,calc(100vw-1.5rem))] p-0"
        >
          <div className="max-h-52 overflow-y-auto rounded-xl border border-border/50 bg-card shadow-xl">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
              </div>
            )}
            {isError && !isLoading && (
              <div className="space-y-2 px-3 py-4">
                <div className="flex gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{(error as Error)?.message ?? "Could not load companies."}</span>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full rounded-lg" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {!isLoading && !isError && companies.length === 0 && (
              <div className="space-y-2 px-3 py-4 text-center text-sm text-muted-foreground">
                <p>No companies loaded for this account.</p>
                <Button type="button" variant="outline" size="sm" className="w-full rounded-lg" onClick={() => void refetch()}>
                  Retry
                </Button>
                <p className="text-xs">If you were invited, confirm you signed in with the invited email.</p>
              </div>
            )}
            {!isLoading &&
              !isError &&
              companies.map((company: Company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setActiveOrgId(company.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{company.name}</p>
                    <p className="text-[10px] text-muted-foreground">{roleSubtitle(company.role)}</p>
                  </div>
                  {company.id === activeOrgId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
          </div>
          {!isLoading && (
            <div className="border-t border-border/50 p-2">
              {firmLoading ? (
                <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground opacity-70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking firm…
                </div>
              ) : hasFirm ? (
                <div className="space-y-1">
                  <Link
                    to="/accountant-portal"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
                      "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" /> New client company (Accountant Portal)
                  </Link>
                  {isOwnerSomewhere && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setShowCreateDialog(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add company
                    </button>
                  )}
                </div>
              ) : firmError ? (
                <div className="space-y-2 rounded-lg px-3 py-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>Couldn’t check firm profile. Refresh if you just registered a firm.</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg"
                    onClick={() => void refetch()}
                  >
                    Refresh companies
                  </Button>
                </div>
              ) : canAddCompany ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowCreateDialog(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add company
                </button>
              ) : null}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add Company</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new organization by entering company details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Legal Name *</Label>
              <Input placeholder="Acme Technologies LLC" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="professional_services">Professional Services</SelectItem>
                    <SelectItem value="non_profit">Non-profit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <div className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm flex items-center text-muted-foreground">
                  USD (MVP)
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entity Type</Label>
                <Select value={form.entity_type} onValueChange={v => setForm(f => ({ ...f, entity_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="s_corp">S-Corp</SelectItem>
                    <SelectItem value="c_corp">C-Corp</SelectItem>
                    <SelectItem value="sole_prop">Sole Prop</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Accounting Method</Label>
                <Select value={form.accounting_method} onValueChange={v => setForm(f => ({ ...f, accounting_method: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fiscal year start</Label>
                <Select value={String(form.fiscal_year_start)} onValueChange={v => setForm(f => ({ ...f, fiscal_year_start: Number(v) }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Time zone</Label>
                <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">US/Eastern</SelectItem>
                    <SelectItem value="America/Chicago">US/Central</SelectItem>
                    <SelectItem value="America/Denver">US/Mountain</SelectItem>
                    <SelectItem value="America/Los_Angeles">US/Pacific</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>EIN (optional)</Label>
              <Input placeholder="XX-XXXXXXX" value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} className="bg-background/50" />
            </div>
            <p className="text-xs text-muted-foreground">
              We auto-generate a default chart of accounts, opening balance equity, and fiscal periods.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createCompany.isPending}>
                {createCompany.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
