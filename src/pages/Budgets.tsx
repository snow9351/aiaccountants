import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Target, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useBudgets, useBudgetVsActuals, useCreateBudget } from "@/hooks/useBudgets";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { BudgetVsActual } from "@/hooks/useBudgets";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

export default function Budgets() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: budgets = [] } = useBudgets();
  const [selectedBudget, setSelectedBudget] = useState<string>("bud-1");
  const { data: bva = [] } = useBudgetVsActuals(selectedBudget);
  const createBudget = useCreateBudget();

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", fiscal_year: new Date().getFullYear().toString(), period_type: "monthly", scenario: "expected" });

  const revenue = bva.filter(r => r.account_type === "revenue");
  const expenses = bva.filter(r => r.account_type === "expense");
  const totalBudgeted = bva.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = bva.reduce((s, r) => s + r.actual, 0);
  const totalVariance = bva.reduce((s, r) => s + r.variance, 0);

  const handleCreate = async () => {
    if (!form.name) { toast({ title: "Budget name is required", variant: "destructive" }); return; }
    try {
      await createBudget.mutateAsync({ name: form.name, fiscal_year: parseInt(form.fiscal_year), period_type: form.period_type as "monthly" | "quarterly" | "annual", scenario: form.scenario as "expected" | "optimistic" | "pessimistic", status: "draft", org_id: orgId });
      toast({ title: "Budget created", description: form.name });
      setShowDialog(false);
      setForm({ name: "", fiscal_year: new Date().getFullYear().toString(), period_type: "monthly", scenario: "expected" });
    } catch (err) {
      toast({ title: "Failed to create budget", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Budgets</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Budget vs. actuals tracking</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" /> New Budget
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Budgeted</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalBudgeted)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Actual</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalActual)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Variance</p>
          <p className={cn("mt-1 font-display text-2xl font-bold", totalVariance >= 0 ? "text-success" : "text-destructive")}>
            {fmtCurrency(Math.abs(totalVariance))} {totalVariance >= 0 ? "under" : "over"}
          </p>
        </div>
      </div>

      {/* Budget selector */}
      {budgets.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <Label className="shrink-0 text-sm">Viewing:</Label>
          <Select value={selectedBudget} onValueChange={setSelectedBudget}>
            <SelectTrigger className="w-64 rounded-xl border-border/50 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {budgets.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Revenue section */}
      {revenue.length > 0 && (
        <BudgetTable title="Revenue" rows={revenue} positiveIsGood={true} />
      )}

      {/* Expenses section */}
      {expenses.length > 0 && (
        <div className="mt-6">
          <BudgetTable title="Expenses" rows={expenses} positiveIsGood={false} />
        </div>
      )}

      {bva.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No budget data found. Create a budget to get started.</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Budget</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Budget Name *</Label>
              <Input placeholder="FY2025 Operating Budget" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fiscal Year</Label>
                <Input type="number" value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Period Type</Label>
                <Select value={form.period_type} onValueChange={v => setForm(f => ({ ...f, period_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Scenario</Label>
              <Select value={form.scenario} onValueChange={v => setForm(f => ({ ...f, scenario: v }))}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expected">Expected</SelectItem>
                  <SelectItem value="optimistic">Optimistic</SelectItem>
                  <SelectItem value="pessimistic">Pessimistic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createBudget.isPending}>
                {createBudget.isPending ? "Creating..." : "Create Budget"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function BudgetTable({ title, rows, positiveIsGood }: { title: string; rows: BudgetVsActual[]; positiveIsGood: boolean }) {
  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30 bg-secondary/10">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} line items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Budget</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actual</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Variance</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Var %</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-48">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isGood = positiveIsGood ? row.variance >= 0 : row.variance >= 0;
              const progressPct = row.budgeted > 0 ? Math.min(100, (row.actual / row.budgeted) * 100) : 0;
              const progressColor = positiveIsGood
                ? (row.actual >= row.budgeted ? "bg-success" : "bg-warning")
                : (row.actual <= row.budgeted ? "bg-success" : "bg-destructive");
              return (
                <tr key={row.account_id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{row.account_name}</td>
                  <td className="px-5 py-3 text-right text-sm text-muted-foreground">{fmtCurrency(row.budgeted)}</td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-foreground">{fmtCurrency(row.actual)}</td>
                  <td className={cn("px-5 py-3 text-right text-sm font-medium", isGood ? "text-success" : "text-destructive")}>
                    <span className="flex items-center justify-end gap-1">
                      {row.variance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : row.variance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      {fmtCurrency(Math.abs(row.variance))}
                    </span>
                  </td>
                  <td className={cn("px-5 py-3 text-right text-xs font-medium", isGood ? "text-success" : "text-destructive")}>
                    {fmtPct(row.variance_pct)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(progressPct)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
