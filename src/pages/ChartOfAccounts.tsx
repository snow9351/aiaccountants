import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  BookOpen,
  Plus,
  ChevronDown,
  Search,
  Download,
  Building,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Scale,
  MoreHorizontal,
  GitMerge,
  Pencil,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import {
  useChartOfAccounts,
  useAccountTree,
  useCreateAccount,
  useUpdateAccount,
  useMergeAccounts,
} from "@/hooks/useAccounts";
import { useCompanies, useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Account, FsSectionType } from "@/integrations/supabase/types";
import {
  coaSubTypesForAccountType,
  labelCoaSubType,
  type CoaSubType,
} from "@/lib/coaSubTypes";

const FS_SECTION_LABELS: Record<FsSectionType, string> = {
  current_assets: "Current Assets",
  fixed_assets: "Fixed Assets",
  current_liabilities: "Current Liabilities",
  long_term_liabilities: "Long-Term Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "COGS",
  operating_expenses: "Operating Expenses",
  other_income: "Other Income",
  other_expenses: "Other Expenses",
};

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  asset: { label: "Assets", icon: Building, color: "text-success border-success/20 bg-success/10" },
  liability: { label: "Liabilities", icon: TrendingDown, color: "text-destructive border-destructive/20 bg-destructive/10" },
  equity: { label: "Equity", icon: Scale, color: "text-info border-info/20 bg-info/10" },
  revenue: { label: "Revenue", icon: TrendingUp, color: "text-primary border-primary/20 bg-primary/10" },
  expense: { label: "Expenses", icon: DollarSign, color: "text-warning border-warning/20 bg-warning/10" },
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
type AccountTypeSection = (typeof TYPE_ORDER)[number];

function suggestNextAccountNumber(existing: Account[]): string {
  const nums = existing
    .map((a) => {
      const raw = a.account_number;
      if (raw == null || String(raw).trim() === "") return NaN;
      const n = parseInt(String(raw).replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > 0 ? n : NaN;
    })
    .filter((n) => !Number.isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 8999;
  return String(Math.max(max + 1, 9000));
}

function defaultSubTypeFor(type: Account["type"]): CoaSubType {
  return coaSubTypesForAccountType(type)[0] as CoaSubType;
}

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const orgId = useOrgId();
  const { data: companies = [], isPending: companiesPending, isFetched: companiesFetched } = useCompanies();
  const activeCompany = companies.find((c) => c.id === orgId) ?? companies[0];
  const requireNumbers = activeCompany?.require_account_numbers !== false;

  const [showInactive, setShowInactive] = useState(false);
  const {
    data: accounts = [],
    isPending: accountsPending,
    isFetched: accountsFetched,
    isError: accountsError,
    error: accountsQueryError,
  } = useChartOfAccounts(orgId || undefined, { includeInactive: showInactive });
  const byType = useAccountTree(orgId || undefined, { includeInactive: showInactive });
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const mergeAccounts = useMergeAccounts();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    account_number: "",
    name: "",
    type: "expense" as Account["type"],
    sub_type: "other_expense" as CoaSubType,
    description: "",
    is_reconcilable: false,
    fs_section: "" as FsSectionType | "",
    tax_category: "",
    sort_order: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({
    account_number: "",
    name: "",
    sub_type: "" as CoaSubType | "",
    description: "",
    is_reconcilable: false,
    fs_section: "" as FsSectionType | "",
    tax_category: "",
  });

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<Account | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const [openSections, setOpenSections] = useState<Record<AccountTypeSection, boolean>>(() => ({
    asset: true,
    liability: false,
    equity: false,
    revenue: false,
    expense: false,
  }));

  const filtered = accounts.filter(
    (a) =>
      search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      String(a.account_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (acc: Account) => {
    setEditAcc(acc);
    setEditForm({
      account_number: acc.account_number ?? "",
      name: acc.name,
      sub_type: (acc.sub_type as CoaSubType) || defaultSubTypeFor(acc.type),
      description: acc.description ?? "",
      is_reconcilable: acc.is_reconcilable,
      fs_section: (acc.fs_section as FsSectionType) || "",
      tax_category: acc.tax_category ?? "",
    });
    setEditOpen(true);
  };

  const openMerge = (acc: Account) => {
    setMergeFrom(acc);
    setMergeTargetId("");
    setMergeOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editAcc || !orgId) return;
    const num = editForm.account_number.trim();
    if (requireNumbers && !num) {
      toast({ title: "Account number required", variant: "destructive" });
      return;
    }
    if (num && accounts.some((a) => a.id !== editAcc.id && (a.account_number ?? "").trim() === num)) {
      toast({ title: "Account number already in use", variant: "destructive" });
      return;
    }
    try {
      await updateAccount.mutateAsync({
        id: editAcc.id,
        org_id: orgId,
        name: editForm.name.trim(),
        account_number: num ? num : null,
        sub_type: editForm.sub_type || defaultSubTypeFor(editAcc.type),
        description: editForm.description.trim() || null,
        is_reconcilable: editForm.is_reconcilable,
        fs_section: (editForm.fs_section as FsSectionType) || null,
        tax_category: editForm.tax_category.trim() || null,
      });
      toast({ title: "Account updated" });
      setEditOpen(false);
      setEditAcc(null);
    } catch (err) {
      toast({
        title: "Update failed",
        description: (err as Error)?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async (acc: Account) => {
    if (!orgId) return;
    if (acc.is_system) {
      toast({ title: "System accounts cannot be deactivated", variant: "destructive" });
      return;
    }
    try {
      await updateAccount.mutateAsync({ id: acc.id, org_id: orgId, is_active: false });
      toast({ title: "Account deactivated", description: acc.name });
    } catch (err) {
      toast({
        title: "Could not deactivate",
        description: (err as Error)?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const handleMerge = async () => {
    if (!mergeFrom || !mergeTargetId || !orgId) return;
    if (mergeFrom.id === mergeTargetId) {
      toast({ title: "Pick a different target account", variant: "destructive" });
      return;
    }
    try {
      await mergeAccounts.mutateAsync({
        orgId,
        fromAccountId: mergeFrom.id,
        toAccountId: mergeTargetId,
      });
      toast({ title: "Accounts merged", description: `Moved activity into the target account.` });
      setMergeOpen(false);
      setMergeFrom(null);
    } catch (err) {
      toast({
        title: "Merge failed",
        description: (err as Error)?.message ?? "",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!orgId) return;
    const num = form.account_number.trim();
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (requireNumbers && !num) {
      toast({ title: "Account number required", description: "Turn off “require account numbers” in Settings → Company if you prefer codes optional.", variant: "destructive" });
      return;
    }
    if (num && accounts.some((a) => (a.account_number ?? "").trim() === num)) {
      toast({
        title: "Account number already in use",
        description: `Try ${suggestNextAccountNumber(accounts)} or another unused code.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const createdType = form.type;
      const createdLabel = form.name.trim();
      await createAccount.mutateAsync({
        account_number: num ? num : null,
        name: createdLabel,
        type: createdType,
        sub_type: form.sub_type,
        description: form.description || undefined,
        org_id: orgId,
        is_active: true,
        is_system: false,
        normal_balance: createdType === "asset" || createdType === "expense" ? "debit" : "credit",
        is_reconcilable: form.is_reconcilable,
        fs_section: (form.fs_section as FsSectionType) || null,
        tax_category: form.tax_category.trim() || null,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : null,
      });
      setOpenSections((s) => ({ ...s, [createdType]: true }));
      toast({
        title: "Account created",
        description: `It’s in the “${typeConfig[createdType].label}” section below (opened for you). Count in the header updates to include this account.`,
      });
      setShowDialog(false);
      setForm({
        account_number: "",
        name: "",
        type: "expense",
        sub_type: "other_expense",
        description: "",
        is_reconcilable: false,
        fs_section: "",
        tax_category: "",
        sort_order: "",
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      const dup =
        msg.includes("accounts_org_id_account_number") ||
        msg.includes("accounts_org_id_account_number_unique") ||
        msg.includes("23505");
      toast({
        title: "Failed to create account",
        description: dup
          ? `That account number is already used. Try ${suggestNextAccountNumber(accounts)}.`
          : msg,
        variant: "destructive",
      });
    }
  };

  const mergeCandidates =
    mergeFrom == null
      ? []
      : accounts.filter((a) => a.id !== mergeFrom.id && a.is_active);

  return (
    <AppLayout>
      <CommandPalette />

      {isSupabaseConfigured && user && companiesPending && (
        <div className="mb-4 rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
          Loading your workspace…
        </div>
      )}

      {isSupabaseConfigured && user && companiesFetched && companies.length === 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">No company workspace on this account</p>
          <p className="mt-1 text-muted-foreground">
            If you registered as an accountant without a client org, or skipped creating a workspace at signup, create a company from the switcher in the sidebar, or accept an invitation. A standard business signup gets a default company and chart automatically.
          </p>
        </div>
      )}

      {orgId && accountsError && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load accounts: {(accountsQueryError as Error)?.message ?? "Unknown error"}
        </div>
      )}

      {orgId && accountsFetched && !accountsPending && !accountsError && accounts.length === 0 && (
        <div className="mb-4 rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">No general-ledger accounts for this company</p>
          <p className="mt-1 text-muted-foreground">
            New workspaces should receive a default chart from the database when you sign up. If this list stays empty, confirm migration <code className="rounded bg-muted px-1 text-xs">030_feature4_coa_foundation</code> is applied and that{" "}
            <code className="rounded bg-muted px-1 text-xs">generate_default_coa</code> ran for your org. You can still add accounts with <strong>New Account</strong>.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Chart of Accounts</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Show inactive
          </label>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)} disabled={!orgId}>
            <Plus className="h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by account number or name..."
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TYPE_ORDER.map((type) => {
          const cfg = typeConfig[type];
          const count = (byType[type] ?? []).length;
          return (
            <div key={type} className={cn("glass-card rounded-2xl border p-4", cfg.color.split(" ").slice(1).join(" "))}>
              <cfg.icon className={cn("mb-2 h-4 w-4", cfg.color.split(" ")[0])} />
              <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
              <p className={cn("font-display text-xl font-bold", cfg.color.split(" ")[0])}>{count}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {TYPE_ORDER.map((type) => {
          const cfg = typeConfig[type];
          const typeAccounts = search ? filtered.filter((a) => a.type === type) : (byType[type] ?? []);
          if (typeAccounts.length === 0) return null;

          return (
            <Collapsible
              key={type}
              open={openSections[type]}
              onOpenChange={(open) => setOpenSections((s) => ({ ...s, [type]: open }))}
              className="glass-card overflow-hidden rounded-2xl"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/30 px-5 py-3.5 text-left transition-colors hover:bg-background/30",
                    cfg.color
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      openSections[type] && "rotate-180"
                    )}
                    aria-hidden
                  />
                  <cfg.icon className="h-4 w-4 shrink-0" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide">{cfg.label}</h3>
                  <span className="ml-auto rounded-full bg-background/20 px-2 py-0.5 text-xs font-medium tabular-nums">
                    {typeAccounts.length}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Number
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Account Name
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sub-type
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        FS Section
                      </th>
                      <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Tax Category
                      </th>
                      <th className="px-5 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Reconcilable
                      </th>
                      <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Balance
                      </th>
                      <th className="w-10 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {typeAccounts.map((acc: Account) => (
                      <tr
                        key={acc.id}
                        className={cn(
                          "border-b border-border/10 transition-colors hover:bg-secondary/20",
                          !acc.is_active && "opacity-60"
                        )}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {acc.account_number ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              acc.is_system ? "text-foreground" : "text-foreground/80",
                              acc.parent_id ? "pl-4" : ""
                            )}
                          >
                            {acc.parent_id ? "↳ " : ""}
                            {acc.name}
                            {acc.is_system && (
                              <span className="ml-2 rounded bg-primary/10 px-1 text-[10px] text-primary">System</span>
                            )}
                            {!acc.is_active && (
                              <span className="ml-2 rounded bg-muted px-1 text-[10px] text-muted-foreground">Inactive</span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{labelCoaSubType(acc.sub_type)}</td>
                        <td className="px-5 py-3">
                          {acc.fs_section ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {FS_SECTION_LABELS[acc.fs_section]}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{acc.tax_category ?? "—"}</td>
                        <td className="px-5 py-3 text-center">
                          {acc.is_reconcilable ? (
                            <span className="text-xs font-medium text-success">✓</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-foreground">—</td>
                        <td className="px-2 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl">
                              <DropdownMenuItem className="gap-2" onClick={() => openEdit(acc)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2" onClick={() => openMerge(acc)}>
                                <GitMerge className="h-3.5 w-3.5" /> Merge into…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                disabled={acc.is_system || !acc.is_active}
                                onClick={() => handleDeactivate(acc)}
                              >
                                <EyeOff className="h-3.5 w-3.5" /> Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (open) {
            setForm({
              account_number: requireNumbers ? suggestNextAccountNumber(accounts) : "",
              name: "",
              type: "expense",
              sub_type: defaultSubTypeFor("expense"),
              description: "",
              is_reconcilable: false,
              fs_section: "",
              tax_category: "",
              sort_order: "",
            });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/50 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New account</DialogTitle>
            <DialogDescription>
              Same columns as the chart grid: number, name, sub-type, FS section, tax category, reconcilable. Balance is not set here (it comes from the ledger).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acct-number">Number{requireNumbers ? "" : " (optional)"}</Label>
                <Input
                  id="acct-number"
                  placeholder={requireNumbers ? suggestNextAccountNumber(accounts) : "Leave blank if preferred"}
                  value={form.account_number}
                  onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acct-type">Type</Label>
                <Select
                  name="acct-type"
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      type: v as Account["type"],
                      sub_type: defaultSubTypeFor(v as Account["type"]),
                    }))
                  }
                >
                  <SelectTrigger id="acct-type" className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {typeConfig[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-sub">Sub-type</Label>
              <Select
                value={form.sub_type}
                onValueChange={(v) => setForm((f) => ({ ...f, sub_type: v as CoaSubType }))}
              >
                <SelectTrigger id="acct-sub" className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {coaSubTypesForAccountType(form.type).map((st) => (
                    <SelectItem key={st} value={st}>
                      {labelCoaSubType(st)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-name">Account Name</Label>
              <Input
                id="acct-name"
                placeholder="e.g. Utilities — satellite office"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-desc">Description (optional)</Label>
              <Input
                id="acct-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-fs-section">FS Section (optional)</Label>
              <Select
                name="acct-fs-section"
                value={form.fs_section}
                onValueChange={(v) => setForm((f) => ({ ...f, fs_section: v as FsSectionType | "" }))}
              >
                <SelectTrigger id="acct-fs-section" className="bg-background/50">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FS_SECTION_LABELS) as FsSectionType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {FS_SECTION_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-tax-category">Tax Category (optional)</Label>
              <Input
                id="acct-tax-category"
                placeholder="e.g. Schedule C line, 1099 box"
                value={form.tax_category}
                onChange={(e) => setForm((f) => ({ ...f, tax_category: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acct-sort">Sort Order (optional)</Label>
                <Input
                  id="acct-sort"
                  type="number"
                  placeholder="10"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="acct-reconcilable"
                  checked={form.is_reconcilable}
                  onChange={(e) => setForm((f) => ({ ...f, is_reconcilable: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="acct-reconcilable" className="cursor-pointer">
                  Reconcilable
                </Label>
              </div>
            </div>
            {requireNumbers && (
              <p className="text-xs text-muted-foreground">
                Numbers must be unique when provided. Seeded charts use roughly 1000–7150; pick a free code or use the
                suggestion.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/50 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Edit account</DialogTitle>
            <DialogDescription>
              Edit the same fields as the table: number, name, sub-type, FS section, tax category, reconcilable. Account type is fixed after creation. Balance is read-only (computed from journal entries, not stored on the account).
            </DialogDescription>
          </DialogHeader>
          {editAcc && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Type (fixed) </span>
                <span className="font-medium text-foreground">{typeConfig[editAcc.type]?.label ?? editAcc.type}</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-number">Number</Label>
                <Input
                  id="edit-number"
                  value={editForm.account_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, account_number: e.target.value }))}
                  className="bg-background/50"
                  placeholder={requireNumbers ? undefined : "Optional"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Account name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sub">Sub-type</Label>
                <Select
                  value={editForm.sub_type}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, sub_type: v as CoaSubType }))}
                >
                  <SelectTrigger id="edit-sub" className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {coaSubTypesForAccountType(editAcc.type).map((st) => (
                      <SelectItem key={st} value={st}>
                        {labelCoaSubType(st)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-fs">FS Section</Label>
                <Select
                  value={editForm.fs_section}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, fs_section: v as FsSectionType | "" }))}
                >
                  <SelectTrigger id="edit-fs" className="bg-background/50">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FS_SECTION_LABELS) as FsSectionType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {FS_SECTION_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-tax">Tax category</Label>
                <Input
                  id="edit-tax"
                  placeholder="e.g. Schedule C line"
                  value={editForm.tax_category}
                  onChange={(e) => setEditForm((f) => ({ ...f, tax_category: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/10 px-3 py-2.5">
                <input
                  type="checkbox"
                  id="edit-reconcilable"
                  checked={editForm.is_reconcilable}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_reconcilable: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="edit-reconcilable" className="cursor-pointer text-sm font-medium">
                  Reconcilable
                </Label>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                <div className="font-medium text-foreground">Balance</div>
                <p className="mt-1 text-muted-foreground">
                  Not edited on this screen. The grid shows “—” until balances are loaded from posted journal entries / reports.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description (optional)</Label>
                <Input
                  id="edit-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleSaveEdit} disabled={updateAccount.isPending}>
                  {updateAccount.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="rounded-2xl border-border/50 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Merge accounts</DialogTitle>
            <DialogDescription>
              All journal lines, expenses, bank links, budgets, and AI training rows that pointed at{" "}
              <span className="font-medium text-foreground">{mergeFrom?.name}</span> will point to the account you
              choose. The source account is then deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Move everything into</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select target account" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {mergeCandidates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {(a.account_number ? `${a.account_number} · ` : "") + a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setMergeOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleMerge} disabled={mergeAccounts.isPending || !mergeTargetId}>
                {mergeAccounts.isPending ? "Merging…" : "Merge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
