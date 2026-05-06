import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Scale, Plus, Lock, CheckCircle, AlertCircle, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useReconciliationPeriods, useCreateReconciliationPeriod, useLockReconciliation, useUpdateReconciliation } from "@/hooks/useReconciliation";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReconciliationPeriod } from "@/hooks/useReconciliation";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const statusConfig = {
  in_progress: { label: "In Progress", icon: Clock, color: "bg-warning/10 text-warning border-warning/20" },
  completed:   { label: "Completed",   icon: CheckCircle, color: "bg-success/10 text-success border-success/20" },
  locked:      { label: "Locked",      icon: Lock, color: "bg-primary/10 text-primary border-primary/20" },
};

const exportPDF = (period: ReconciliationPeriod, bankName: string) => {
  // Dynamic import to avoid SSR issues
  import("jspdf").then(({ default: jsPDF }) => {
    import("jspdf-autotable").then(() => {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Bank Reconciliation Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Bank Account: ${bankName}`, 14, 32);
      doc.text(`Period: ${new Date(period.period_start).toLocaleDateString()} – ${new Date(period.period_end).toLocaleDateString()}`, 14, 38);
      doc.text(`Status: ${period.status.toUpperCase()}`, 14, 44);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 50);

      (doc as any).autoTable({
        startY: 60,
        head: [["Item", "Amount"]],
        body: [
          ["Opening Balance", fmtCurrency(period.opening_balance)],
          ["Closing Balance (Book)", fmtCurrency(period.closing_balance)],
          ["Statement Balance (Bank)", fmtCurrency(period.statement_balance)],
          ["Difference", fmtCurrency(period.difference)],
        ],
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
      });

      if (period.notes) {
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text(`Notes: ${period.notes}`, 14, finalY);
      }

      doc.save(`reconciliation-${period.period_start}-to-${period.period_end}.pdf`);
    });
  });
};

export default function Reconciliation() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: periods = [] } = useReconciliationPeriods(orgId);
  const { data: bankAccounts = [] } = useBankAccounts();
  const createPeriod = useCreateReconciliationPeriod();
  const lockPeriod = useLockReconciliation();
  const updatePeriod = useUpdateReconciliation();

  const [showDialog, setShowDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState<string | null>(null);
  const [lockNotes, setLockNotes] = useState("");
  const [form, setForm] = useState({
    bank_account_id: "", period_start: "", period_end: "",
    opening_balance: "", statement_balance: "",
  });

  const locked = periods.filter(p => p.status === "locked").length;
  const inProgress = periods.find(p => p.status === "in_progress");

  const handleCreate = async () => {
    if (!form.bank_account_id || !form.period_start || !form.period_end || !form.statement_balance) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    try {
      await createPeriod.mutateAsync({
        org_id: orgId,
        bank_account_id: form.bank_account_id,
        period_start: form.period_start,
        period_end: form.period_end,
        opening_balance: parseFloat(form.opening_balance) || 0,
        closing_balance: parseFloat(form.opening_balance) || 0, // start same as opening
        statement_balance: parseFloat(form.statement_balance),
        status: "in_progress",
      });
      toast({ title: "Reconciliation period started" });
      setShowDialog(false);
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleLock = async () => {
    if (!showLockDialog) return;
    try {
      await lockPeriod.mutateAsync({ id: showLockDialog, notes: lockNotes });
      toast({ title: "Period locked", description: "Transactions in this period are now protected." });
      setShowLockDialog(null);
      setLockNotes("");
    } catch (err) {
      toast({ title: "Failed to lock", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Bank Reconciliation</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Match transactions to bank statements, lock closed periods</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)} disabled={!!inProgress}>
          <Plus className="h-4 w-4" /> {inProgress ? "Period In Progress" : "New Period"}
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Locked Periods</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{locked}</p>
          <p className="mt-1 text-xs text-muted-foreground">Immutable, audit-safe</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">In Progress</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{inProgress ? "1" : "0"}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Difference</p>
          <p className={cn("mt-1 font-display text-2xl font-bold", !inProgress || inProgress.difference === 0 ? "text-success" : "text-destructive")}>
            {inProgress ? fmtCurrency(Math.abs(inProgress.difference)) : "—"}
          </p>
          {inProgress && inProgress.difference !== 0 && <p className="mt-1 text-xs text-destructive">Unresolved discrepancy</p>}
          {inProgress && inProgress.difference === 0 && <p className="mt-1 text-xs text-success">Books balance ✓</p>}
        </div>
      </div>

      {/* Periods list */}
      <div className="space-y-3">
        {periods.map((period: ReconciliationPeriod) => {
          const cfg = statusConfig[period.status];
          const StatusIcon = cfg.icon;
          const bank = bankAccounts.find(b => b.id === period.bank_account_id);
          const isBalanced = period.difference === 0;

          return (
            <div key={period.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", cfg.color)}>
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {new Date(period.period_start).toLocaleDateString("en-US", { month: "short", year: "numeric" })} –{" "}
                      {new Date(period.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {bank && <span className="text-xs text-muted-foreground">{bank.name}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opening Balance</p>
                      <p className="text-sm font-medium text-foreground">{fmtCurrency(period.opening_balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Book Closing</p>
                      <p className="text-sm font-medium text-foreground">{fmtCurrency(period.closing_balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Statement Balance</p>
                      <p className="text-sm font-medium text-foreground">{fmtCurrency(period.statement_balance)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Difference</p>
                      <p className={cn("text-sm font-bold", isBalanced ? "text-success" : "text-destructive")}>
                        {isBalanced ? "✓ $0.00" : fmtCurrency(Math.abs(period.difference))}
                      </p>
                    </div>
                  </div>

                  {period.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic">{period.notes}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 border-border/50"
                    onClick={() => exportPDF(period, bank?.name ?? "Bank Account")}
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>

                  {period.status === "in_progress" && (
                    <Button
                      size="sm"
                      className={cn("rounded-xl gap-1.5", isBalanced ? "bg-success hover:bg-success/90" : "")}
                      onClick={() => { if (!isBalanced) { toast({ title: "Cannot lock", description: "Difference must be $0.00 before locking.", variant: "destructive" }); return; } setShowLockDialog(period.id); }}
                    >
                      <Lock className="h-3.5 w-3.5" /> Lock Period
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {periods.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No reconciliation periods yet. Start by creating one.</p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Reconciliation Period</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Bank Account *</Label>
              <Select value={form.bank_account_id} onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period Start *</Label>
                <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Period End *</Label>
                <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opening Balance</Label>
                <Input type="number" placeholder="0.00" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Statement Balance *</Label>
                <Input type="number" placeholder="From bank statement" value={form.statement_balance} onChange={e => setForm(f => ({ ...f, statement_balance: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createPeriod.isPending}>
                {createPeriod.isPending ? "Starting..." : "Start Reconciliation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lock confirmation dialog */}
      <Dialog open={!!showLockDialog} onOpenChange={() => setShowLockDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Lock Reconciliation Period</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-sm font-medium text-warning">⚠️ This action is irreversible</p>
              <p className="mt-1 text-xs text-muted-foreground">Locking this period prevents any changes to transactions within it. This is required for audit compliance and IRS documentation.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Closing Notes (optional)</Label>
              <Textarea placeholder="Add any notes about this reconciliation..." value={lockNotes} onChange={e => setLockNotes(e.target.value)} className="bg-background/50 resize-none" rows={3} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowLockDialog(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-primary" onClick={handleLock} disabled={lockPeriod.isPending}>
                <Lock className="h-4 w-4 mr-2" /> {lockPeriod.isPending ? "Locking..." : "Lock Period"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
