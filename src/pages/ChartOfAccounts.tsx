import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BookOpen, Plus, ChevronRight, Search, Download, Building, DollarSign, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useChartOfAccounts, useAccountTree, useCreateAccount } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Account, FsSectionType } from "@/integrations/supabase/types";

const FS_SECTION_LABELS: Record<FsSectionType, string> = {
  current_assets:         "Current Assets",
  fixed_assets:           "Fixed Assets",
  current_liabilities:    "Current Liabilities",
  long_term_liabilities:  "Long-Term Liabilities",
  equity:                 "Equity",
  revenue:                "Revenue",
  cogs:                   "COGS",
  operating_expenses:     "Operating Expenses",
  other_income:           "Other Income",
  other_expenses:         "Other Expenses",
};

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  asset:     { label: "Assets",      icon: Building,    color: "text-success border-success/20 bg-success/10" },
  liability: { label: "Liabilities", icon: TrendingDown, color: "text-destructive border-destructive/20 bg-destructive/10" },
  equity:    { label: "Equity",      icon: Scale,        color: "text-info border-info/20 bg-info/10" },
  revenue:   { label: "Revenue",     icon: TrendingUp,   color: "text-primary border-primary/20 bg-primary/10" },
  expense:   { label: "Expenses",    icon: DollarSign,   color: "text-warning border-warning/20 bg-warning/10" },
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: accounts = [] } = useChartOfAccounts();
  const byType = useAccountTree();
  const createAccount = useCreateAccount();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    account_number: "", name: "", type: "expense" as Account["type"], description: "",
    is_reconcilable: false, fs_section: "" as FsSectionType | "", sort_order: "",
  });

  const filtered = accounts.filter(a =>
    search === "" ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.includes(search)
  );

  const handleCreate = async () => {
    if (!form.account_number || !form.name) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    try {
      await createAccount.mutateAsync({
        account_number: form.account_number,
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        org_id: orgId,
        is_active: true,
        is_system: false,
        normal_balance: form.type === "asset" || form.type === "expense" ? "debit" : "credit",
        is_reconcilable: form.is_reconcilable,
        fs_section: (form.fs_section as FsSectionType) || null,
        sort_order: form.sort_order ? parseInt(form.sort_order) : null,
      });
      toast({ title: "Account created", description: `${form.account_number} — ${form.name}` });
      setShowDialog(false);
      setForm({ account_number: "", name: "", type: "expense", description: "", is_reconcilable: false, fs_section: "", sort_order: "" });
    } catch (err) {
      toast({ title: "Failed to create account", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Chart of Accounts</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{accounts.length} accounts across 5 types</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by account number or name..."
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TYPE_ORDER.map(type => {
          const cfg = typeConfig[type];
          const count = (byType[type] ?? []).length;
          return (
            <div key={type} className={cn("glass-card rounded-2xl p-4 border", cfg.color.split(' ').slice(1).join(' '))}>
              <cfg.icon className={cn("h-4 w-4 mb-2", cfg.color.split(' ')[0])} />
              <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
              <p className={cn("text-xl font-bold font-display", cfg.color.split(' ')[0])}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Account tree by type */}
      <div className="space-y-4">
        {TYPE_ORDER.map(type => {
          const cfg = typeConfig[type];
          const typeAccounts = search
            ? filtered.filter(a => a.type === type)
            : (byType[type] ?? []);
          if (typeAccounts.length === 0) return null;

          return (
            <div key={type} className="glass-card rounded-2xl overflow-hidden">
              <div className={cn("flex items-center gap-3 px-5 py-3.5 border-b border-border/30", cfg.color)}>
                <cfg.icon className="h-4 w-4" />
                <h3 className="font-semibold text-sm uppercase tracking-wide">{cfg.label}</h3>
                <span className="ml-auto rounded-full bg-background/20 px-2 py-0.5 text-xs font-medium">{typeAccounts.length}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Number</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Name</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-type</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">FS Section</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tax Category</th>
                    <th className="px-5 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Reconcilable</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {typeAccounts.map((acc: Account) => (
                    <tr key={acc.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{acc.account_number}</td>
                      <td className="px-5 py-3">
                        <span className={cn("text-sm font-medium", acc.is_system ? "text-foreground" : "text-foreground/80", acc.parent_id ? "pl-4" : "")}>
                          {acc.parent_id ? "↳ " : ""}{acc.name}
                          {acc.is_system && <span className="ml-2 text-[10px] bg-primary/10 text-primary rounded px-1">System</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{acc.sub_type ?? "—"}</td>
                      <td className="px-5 py-3">
                        {acc.fs_section ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {FS_SECTION_LABELS[acc.fs_section]}
                          </span>
                        ) : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{acc.tax_category ?? "—"}</td>
                      <td className="px-5 py-3 text-center">
                        {acc.is_reconcilable ? (
                          <span className="text-success text-xs font-medium">✓</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">—</td>
                      <td className="px-3 py-3">
                        <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Create Account Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acct-number">Account Number</Label>
                <Input id="acct-number" placeholder="6900" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acct-type">Type</Label>
                <Select name="acct-type" value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Account["type"] }))}>
                  <SelectTrigger id="acct-type" className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{typeConfig[t].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-name">Account Name</Label>
              <Input id="acct-name" placeholder="Depreciation Expense" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-desc">Description (optional)</Label>
              <Input id="acct-desc" placeholder="Annual equipment depreciation" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-fs-section">FS Section (optional)</Label>
              <Select name="acct-fs-section" value={form.fs_section} onValueChange={v => setForm(f => ({ ...f, fs_section: v as FsSectionType | "" }))}>
                <SelectTrigger id="acct-fs-section" className="bg-background/50"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FS_SECTION_LABELS) as FsSectionType[]).map(k => (
                    <SelectItem key={k} value={k}>{FS_SECTION_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acct-sort">Sort Order (optional)</Label>
                <Input id="acct-sort" type="number" placeholder="10" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="acct-reconcilable"
                  checked={form.is_reconcilable}
                  onChange={e => setForm(f => ({ ...f, is_reconcilable: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="acct-reconcilable" className="cursor-pointer">Reconcilable</Label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createAccount.isPending}>
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
