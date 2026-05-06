import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TrendingUp, Plus, DollarSign, Clock, CheckCircle, Pause, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useRevenueContracts, useRevenueSchedule, useCreateRevenueContract } from "@/hooks/useRevenueRecognition";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { RevenueContract } from "@/hooks/useRevenueRecognition";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const methodLabels: Record<string, string> = {
  straight_line: "Straight-Line (Ratable)",
  milestone: "Milestone-Based",
  usage_based: "Usage-Based",
  point_in_time: "Point-in-Time",
};

const statusConfig = {
  active:    { label: "Active",    icon: TrendingUp, color: "bg-success/10 text-success border-success/20" },
  completed: { label: "Completed", icon: CheckCircle, color: "bg-primary/10 text-primary border-primary/20" },
  paused:    { label: "Paused",    icon: Pause,       color: "bg-warning/10 text-warning border-warning/20" },
};

export default function RevenueRecognition() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: contracts = [] } = useRevenueContracts(orgId);
  const createContract = useCreateRevenueContract();
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const { data: schedule = [] } = useRevenueSchedule(selectedContract ?? undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const [form, setForm] = useState({
    customer_name: "", contract_name: "", total_value: "",
    start_date: "", end_date: "", recognition_method: "straight_line" as RevenueContract['recognition_method'],
  });

  const totalDeferred = contracts.reduce((sum, c) => sum + c.deferred_revenue, 0);
  const totalRecognized = contracts.reduce((sum, c) => sum + c.recognized_to_date, 0);
  const totalValue = contracts.reduce((sum, c) => sum + c.total_value, 0);

  const handleCreate = async () => {
    if (!form.customer_name || !form.contract_name || !form.total_value || !form.start_date || !form.end_date) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    try {
      await createContract.mutateAsync({
        org_id: orgId,
        customer_name: form.customer_name,
        contract_name: form.contract_name,
        total_value: parseFloat(form.total_value),
        start_date: form.start_date,
        end_date: form.end_date,
        recognition_method: form.recognition_method,
        status: "active",
      });
      toast({ title: "Contract created" });
      setShowCreate(false);
      setForm({ customer_name: "", contract_name: "", total_value: "", start_date: "", end_date: "", recognition_method: "straight_line" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const viewSchedule = (contractId: string) => {
    setSelectedContract(contractId);
    setShowSchedule(true);
  };

  const selectedContractData = contracts.find(c => c.id === selectedContract);

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Revenue Recognition</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">ASC 606 compliant revenue schedules</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Contract
        </Button>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Contract Value</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalValue)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recognized to Date</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(totalRecognized)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deferred Revenue</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(totalDeferred)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Contracts</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{contracts.filter(c => c.status === "active").length}</p>
        </div>
      </div>

      {/* Contracts list */}
      <div className="space-y-3">
        {contracts.map(contract => {
          const cfg = statusConfig[contract.status];
          const StatusIcon = cfg.icon;
          const pct = contract.total_value > 0 ? Math.round((contract.recognized_to_date / contract.total_value) * 100) : 0;

          return (
            <div key={contract.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", cfg.color)}>
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </span>
                    <span className="text-sm font-medium text-foreground">{contract.contract_name}</span>
                    <span className="text-xs text-muted-foreground">{contract.customer_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Value</p>
                      <p className="text-sm font-medium text-foreground">{fmtCurrency(contract.total_value)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recognized</p>
                      <p className="text-sm font-medium text-success">{fmtCurrency(contract.recognized_to_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deferred</p>
                      <p className="text-sm font-medium text-warning">{fmtCurrency(contract.deferred_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</p>
                      <p className="text-sm font-medium text-foreground">{methodLabels[contract.recognition_method]}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Period</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(contract.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – {new Date(contract.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Recognition Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-500", contract.status === "completed" ? "bg-primary" : "bg-success")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 border-border/50 shrink-0" onClick={() => viewSchedule(contract.id)}>
                  <Eye className="h-3.5 w-3.5" /> Schedule
                </Button>
              </div>
            </div>
          );
        })}

        {contracts.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No revenue contracts yet. Create one to start tracking recognition.</p>
          </div>
        )}
      </div>

      {/* Create contract dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Revenue Contract</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Acme Corp" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Name *</Label>
                <Input value={form.contract_name} onChange={e => setForm(f => ({ ...f, contract_name: e.target.value }))} placeholder="Annual SaaS License" className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Total Value *</Label>
                <Input type="number" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} placeholder="120000" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Recognition Method</Label>
              <Select value={form.recognition_method} onValueChange={(v: RevenueContract['recognition_method']) => setForm(f => ({ ...f, recognition_method: v }))}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Straight-Line (Ratable over term)</SelectItem>
                  <SelectItem value="milestone">Milestone-Based (ASC 606 Step 5)</SelectItem>
                  <SelectItem value="usage_based">Usage-Based (Variable consideration)</SelectItem>
                  <SelectItem value="point_in_time">Point-in-Time (Immediate)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createContract.isPending}>
                {createContract.isPending ? "Creating..." : "Create Contract"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Recognition Schedule{selectedContractData && ` — ${selectedContractData.contract_name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2 max-h-[400px] overflow-y-auto">
            {schedule.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  {s.status === "recognized" ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">{s.period}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{fmtCurrency(s.amount)}</span>
                  <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", s.status === "recognized" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    {s.status === "recognized" ? "Recognized" : "Scheduled"}
                  </span>
                </div>
              </div>
            ))}
            {schedule.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No schedule entries yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
