import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BookMarked, Plus, Search, CheckCircle, Clock, X, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useJournalEntries, useCreateJournalEntry, usePostEntry, useVoidJournalEntry } from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { JournalEntryWithLines } from "@/hooks/useJournalEntries";
import type { JournalEntryStatus } from "@/integrations/supabase/types";
import { formatAccountLabel } from "@/lib/coaSubTypes";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

interface DraftLine {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

const EMPTY_LINE: DraftLine = { account_id: "", debit: "", credit: "", description: "" };

const STATUS_CONFIG: Record<JournalEntryStatus, { label: string; icon: typeof CheckCircle; rowClass: string; badgeClass: string }> = {
  draft:          { label: "Draft",          icon: Clock,          rowClass: "bg-warning/10 text-warning",                  badgeClass: "bg-warning/10 text-warning" },
  pending_review: { label: "Pending Review", icon: AlertTriangle,  rowClass: "bg-yellow-500/10 text-yellow-400",             badgeClass: "bg-yellow-500/10 text-yellow-400" },
  posted:         { label: "Posted",         icon: CheckCircle,    rowClass: "bg-success/10 text-success",                  badgeClass: "bg-success/10 text-success" },
  voided:         { label: "Voided",         icon: Ban,            rowClass: "bg-destructive/10 text-destructive",           badgeClass: "bg-destructive/10 text-destructive" },
};

export default function JournalEntries() {
  const { toast } = useToast();
  const { user } = useAuth();
  const orgId = useOrgId();
  const { data: entries = [] } = useJournalEntries();
  const { data: accounts = [] } = useChartOfAccounts(orgId || undefined);
  const createEntry = useCreateJournalEntry();
  const postEntry = usePostEntry();
  const voidEntry = useVoidJournalEntry();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "posted" | "draft" | "voided">("all");
  const [showDialog, setShowDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", reference: "" });
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [lineErrors, setLineErrors] = useState<string[]>([]);

  // Void dialog state
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const filtered = entries.filter((e: JournalEntryWithLines) => {
    const matchesSearch =
      search === "" ||
      (e.entry_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.reference ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "posted"  && e.status === "posted") ||
      (filterStatus === "draft"   && (e.status === "draft" || e.status === "pending_review")) ||
      (filterStatus === "voided"  && e.status === "voided");
    return matchesSearch && matchesFilter;
  });

  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const updateLine = (idx: number, field: keyof DraftLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    setLineErrors([]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const resetDialog = () => {
    setForm({ date: new Date().toISOString().slice(0, 10), description: "", reference: "" });
    setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    setLineErrors([]);
  };

  const validateLines = (): boolean => {
    const errors: string[] = [];
    lines.forEach((l, i) => {
      const d = parseFloat(l.debit) || 0;
      const c = parseFloat(l.credit) || 0;
      if (d > 0 && c > 0) errors.push(`Line ${i + 1}: a line cannot have both a debit and a credit`);
    });
    setLineErrors(errors);
    return errors.length === 0;
  };

  const handleCreate = async () => {
    if (!form.description) { toast({ title: "Description is required", variant: "destructive" }); return; }
    if (!validateLines()) return;
    if (!isBalanced) { toast({ title: "Debits must equal credits", description: `Debits: ${fmtCurrency(totalDebits)}, Credits: ${fmtCurrency(totalCredits)}`, variant: "destructive" }); return; }
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { toast({ title: "At least 2 lines required", variant: "destructive" }); return; }
    try {
      await createEntry.mutateAsync({
        entry: { date: form.date, description: form.description, reference: form.reference || undefined, org_id: orgId, is_posted: false },
        lines: validLines.map((l, i) => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
          line_number: i + 1,
        })),
      });
      toast({ title: "Journal entry created" });
      setShowDialog(false);
      resetDialog();
    } catch (err) {
      toast({ title: "Failed to create entry", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) { toast({ title: "Void reason is required", variant: "destructive" }); return; }
    try {
      await voidEntry.mutateAsync({ id: voidTarget, void_reason: voidReason.trim(), voided_by: user?.id ?? null });
      toast({ title: "Entry voided" });
      setVoidTarget(null);
      setVoidReason("");
    } catch (err) {
      toast({ title: "Failed to void entry", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BookMarked className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Journal Entries</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Double-entry general ledger</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" /> New Entry
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Entries</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{entries.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Posted</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{entries.filter(e => e.status === "posted").length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Drafts</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{entries.filter(e => e.status === "draft" || e.status === "pending_review").length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Voided</p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{entries.filter(e => e.status === "voided").length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border/50 bg-secondary/20 p-1">
          {(["all", "posted", "draft", "voided"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all", filterStatus === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." className="rounded-xl border-border/50 bg-secondary/30 pl-10 h-9" />
        </div>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {filtered.map((entry: JournalEntryWithLines) => {
          const cfg = STATUS_CONFIG[entry.status ?? "draft"];
          const StatusIcon = cfg.icon;
          return (
            <div key={entry.id} className={cn("glass-card rounded-2xl overflow-hidden", entry.status === "voided" && "opacity-60")}>
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cfg.rowClass)}>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{entry.entry_number ?? "—"}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.badgeClass)}>
                      {cfg.label}
                    </span>
                    {entry.period_closed && (
                      <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Period Closed</span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 text-sm font-medium text-foreground truncate", entry.status === "voided" && "line-through text-muted-foreground")}>
                    {entry.description}
                  </p>
                  {entry.status === "voided" && entry.void_reason && (
                    <p className="text-[10px] text-destructive/70 truncate">Void reason: {entry.void_reason}</p>
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</p>
                  {entry.reference && <p className="text-[10px] text-muted-foreground/60">{entry.reference}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{fmtCurrency(entry.total_debits)}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.lines.length} lines</p>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {(entry.status === "draft" || entry.status === "pending_review") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={entry.period_closed}
                      title={entry.period_closed ? "Period is closed" : undefined}
                      className="rounded-xl border-success/30 text-success hover:bg-success/10 text-xs disabled:opacity-40"
                      onClick={() => { postEntry.mutate(entry.id); toast({ title: "Entry posted" }); }}
                    >
                      Post
                    </Button>
                  )}
                  {entry.status === "posted" && !entry.period_closed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => { setVoidTarget(entry.id); setVoidReason(""); }}
                    >
                      <Ban className="h-3 w-3 mr-1" /> Void
                    </Button>
                  )}
                </div>
              </div>

              {expandedId === entry.id && (
                <div className="border-t border-border/20 px-5 pb-4">
                  <table className="w-full mt-3">
                    <thead>
                      <tr>
                        <th className="pb-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Account</th>
                        <th className="pb-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</th>
                        <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Debit</th>
                        <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map(line => {
                        const account = accounts.find(a => a.id === line.account_id);
                        return (
                          <tr key={line.id} className={cn("border-t border-border/10", line.is_voided && "opacity-40 line-through")}>
                            <td className="py-2 text-sm text-foreground">{account ? formatAccountLabel(account) : line.account_id}</td>
                            <td className="py-2 text-sm text-muted-foreground">{line.description ?? "—"}</td>
                            <td className="py-2 text-right text-sm font-medium text-foreground">{line.debit > 0 ? fmtCurrency(line.debit) : "—"}</td>
                            <td className="py-2 text-right text-sm font-medium text-muted-foreground">{line.credit > 0 ? fmtCurrency(line.credit) : "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-border/30">
                        <td colSpan={2} className="py-2 text-xs font-medium text-muted-foreground uppercase">Total</td>
                        <td className="py-2 text-right text-sm font-bold text-foreground">{fmtCurrency(entry.total_debits)}</td>
                        <td className="py-2 text-right text-sm font-bold text-foreground">{fmtCurrency(entry.total_credits)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <BookMarked className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No journal entries found.</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { setShowDialog(open); if (!open) resetDialog(); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-border/50 bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="je-date">Date</Label>
                <Input id="je-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="je-reference">Reference</Label>
                <Input id="je-reference" placeholder="INV-001, AP-2024-01" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="je-description">Description *</Label>
              <Input id="je-description" placeholder="e.g. Record April rent payment" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background/50" />
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <div className={cn("text-xs font-medium", isBalanced ? "text-success" : "text-destructive")}>
                  {isBalanced ? "Balanced ✓" : `Difference: ${fmtCurrency(Math.abs(totalDebits - totalCredits))}`}
                </div>
              </div>
              {lineErrors.length > 0 && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 space-y-0.5">
                  {lineErrors.map((err, i) => <p key={i} className="text-xs text-destructive">{err}</p>)}
                </div>
              )}
              <div className="rounded-xl border border-border/30 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 bg-secondary/20">
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Account</th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Memo</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Debit</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Credit</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const d = parseFloat(line.debit) || 0;
                      const c = parseFloat(line.credit) || 0;
                      const hasConflict = d > 0 && c > 0;
                      return (
                        <tr key={idx} className={cn("border-b border-border/10", hasConflict && "bg-destructive/5")}>
                          <td className="p-1.5">
                            <Select name={`line-account-${idx}`} value={line.account_id} onValueChange={v => updateLine(idx, "account_id", v)}>
                              <SelectTrigger id={`line-account-${idx}`} className="h-8 text-xs bg-background/50 border-border/30">
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map(a => (
                                  <SelectItem key={a.id} value={a.id} className="text-xs">
                                    {formatAccountLabel(a)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5">
                            <Input placeholder="Optional" value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} className="h-8 text-xs bg-background/50 border-border/30" />
                          </td>
                          <td className="p-1.5">
                            <Input type="number" placeholder="0.00" value={line.debit} onChange={e => { updateLine(idx, "debit", e.target.value); if (e.target.value) updateLine(idx, "credit", ""); }} className={cn("h-8 text-xs bg-background/50 border-border/30 text-right", hasConflict && "border-destructive/50")} />
                          </td>
                          <td className="p-1.5">
                            <Input type="number" placeholder="0.00" value={line.credit} onChange={e => { updateLine(idx, "credit", e.target.value); if (e.target.value) updateLine(idx, "debit", ""); }} className={cn("h-8 text-xs bg-background/50 border-border/30 text-right", hasConflict && "border-destructive/50")} />
                          </td>
                          <td className="p-1.5">
                            <button onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors">
                              <X className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border/30 bg-secondary/10">
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Total</td>
                      <td />
                      <td className={cn("px-3 py-2 text-right text-xs font-bold", isBalanced ? "text-success" : "text-foreground")}>{fmtCurrency(totalDebits)}</td>
                      <td className={cn("px-3 py-2 text-right text-xs font-bold", isBalanced ? "text-success" : "text-foreground")}>{fmtCurrency(totalCredits)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl w-full border-dashed" onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Line
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createEntry.isPending || !isBalanced}>
                {createEntry.isPending ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) { setVoidTarget(null); setVoidReason(""); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-destructive">Void Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Voiding a posted entry is irreversible. The entry will remain in the ledger marked as voided.</p>
            <div className="space-y-1.5">
              <Label htmlFor="void-reason">Void Reason *</Label>
              <Input
                id="void-reason"
                placeholder="e.g. Duplicate entry, incorrect account..."
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setVoidTarget(null); setVoidReason(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={handleVoid}
                disabled={voidEntry.isPending || !voidReason.trim()}
              >
                {voidEntry.isPending ? "Voiding..." : "Void Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
