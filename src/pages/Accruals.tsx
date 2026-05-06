import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Repeat, Plus, ArrowUpCircle, ArrowDownCircle, CheckCircle, RotateCcw, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useAccruals, useCreateAccrual, usePostAccrual, useReverseAccrual } from "@/hooks/useAccruals";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Accrual } from "@/hooks/useAccruals";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const statusConfig = {
  draft:    { label: "Draft",    icon: FileText,    color: "bg-muted text-muted-foreground border-border" },
  posted:   { label: "Posted",   icon: CheckCircle, color: "bg-success/10 text-success border-success/20" },
  reversed: { label: "Reversed", icon: RotateCcw,   color: "bg-warning/10 text-warning border-warning/20" },
};

const frequencyLabels: Record<string, string> = {
  one_time: "One-Time",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export default function Accruals() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: accruals = [] } = useAccruals(orgId);
  const createAccrual = useCreateAccrual();
  const postAccrual = usePostAccrual();
  const reverseAccrual = useReverseAccrual();

  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "posted" | "reversed">("all");

  const [form, setForm] = useState({
    type: "expense" as Accrual['type'],
    description: "", vendor_or_customer: "",
    amount: "", account_name: "",
    period: "", frequency: "one_time" as Accrual['frequency'],
    auto_reverse: true,
  });

  const filtered = filter === "all" ? accruals : accruals.filter(a => a.status === filter);
  const draftTotal = accruals.filter(a => a.status === "draft").reduce((s, a) => s + a.amount, 0);
  const postedTotal = accruals.filter(a => a.status === "posted").reduce((s, a) => s + a.amount, 0);

  const handleCreate = async () => {
    if (!form.description || !form.amount || !form.account_name || !form.period) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    try {
      await createAccrual.mutateAsync({
        org_id: orgId,
        type: form.type,
        description: form.description,
        vendor_or_customer: form.vendor_or_customer,
        amount: parseFloat(form.amount),
        account_id: `acc-${form.account_name.toLowerCase().replace(/\s+/g, '-')}`,
        account_name: form.account_name,
        period: form.period,
        frequency: form.frequency,
        status: "draft",
        auto_reverse: form.auto_reverse,
      });
      toast({ title: "Accrual created" });
      setShowCreate(false);
      setForm({ type: "expense", description: "", vendor_or_customer: "", amount: "", account_name: "", period: "", frequency: "one_time", auto_reverse: true });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handlePost = async (id: string) => {
    try {
      await postAccrual.mutateAsync(id);
      toast({ title: "Accrual posted", description: "Journal entry created." });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleReverse = async (id: string) => {
    try {
      await reverseAccrual.mutateAsync(id);
      toast({ title: "Accrual reversed", description: "Reversal journal entry created." });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Repeat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Accrual Management</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage expense and revenue accruals with auto-reversal</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Accrual
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Draft Accruals</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(draftTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{accruals.filter(a => a.status === "draft").length} entries pending</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Posted This Period</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(postedTotal)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expense Accruals</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{accruals.filter(a => a.type === "expense").length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue Accruals</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{accruals.filter(a => a.type === "revenue").length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {(["all", "draft", "posted", "reversed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-all capitalize", filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Accruals list */}
      <div className="space-y-3">
        {filtered.map(accrual => {
          const cfg = statusConfig[accrual.status];
          const StatusIcon = cfg.icon;

          return (
            <div key={accrual.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", cfg.color)}>
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </span>
                    {accrual.type === "expense" ? (
                      <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                        <ArrowDownCircle className="h-3 w-3" /> Expense
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                        <ArrowUpCircle className="h-3 w-3" /> Revenue
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {frequencyLabels[accrual.frequency]}
                    </span>
                    {accrual.auto_reverse && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <RotateCcw className="h-2.5 w-2.5" /> Auto-Reverse
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-foreground">{accrual.description}</p>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                      <p className="text-sm font-bold text-foreground">{fmtCurrency(accrual.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</p>
                      <p className="text-sm font-medium text-foreground">{accrual.account_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{accrual.type === "expense" ? "Vendor" : "Customer"}</p>
                      <p className="text-sm font-medium text-foreground">{accrual.vendor_or_customer || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Period</p>
                      <p className="text-sm font-medium text-foreground">{accrual.period}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {accrual.status === "draft" && (
                    <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handlePost(accrual.id)}>
                      <CheckCircle className="h-3.5 w-3.5" /> Post
                    </Button>
                  )}
                  {accrual.status === "posted" && (
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5 border-border/50" onClick={() => handleReverse(accrual.id)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reverse
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Repeat className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "No accruals yet. Create one to get started." : `No ${filter} accruals.`}
            </p>
          </div>
        )}
      </div>

      {/* Create accrual dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Accrual</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: Accrual['type']) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense Accrual</SelectItem>
                    <SelectItem value="revenue">Revenue Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v: Accrual['frequency']) => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-Time</SelectItem>
                    <SelectItem value="monthly">Monthly (Recurring)</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. March rent accrual" className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.type === "expense" ? "Vendor" : "Customer"}</Label>
                <Input value={form.vendor_or_customer} onChange={e => setForm(f => ({ ...f, vendor_or_customer: e.target.value }))} placeholder="e.g. Regus" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="4500" className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account *</Label>
                <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Rent Expense" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Period *</Label>
                <Input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.auto_reverse} onCheckedChange={v => setForm(f => ({ ...f, auto_reverse: v }))} />
              <div>
                <Label>Auto-reverse next period</Label>
                <p className="text-xs text-muted-foreground">Automatically create a reversal entry at the start of the next period</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createAccrual.isPending}>
                {createAccrual.isPending ? "Creating..." : "Create Accrual"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
