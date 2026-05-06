import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  CheckCircle,
  DollarSign,
  FileText,
  Plus,
  Receipt,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useExpenses, useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import { useOrgId } from "@/hooks/useCompanies";
import type { Expense } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/*  Status styling                                                     */
/* ------------------------------------------------------------------ */

const statusConfig: Record<
  Expense["status"],
  { label: string; color: string; icon: typeof Sparkles }
> = {
  pending: {
    label: "Pending",
    color: "text-warning bg-warning/10 border-warning/20",
    icon: FileText,
  },
  auto_categorized: {
    label: "Auto-categorized",
    color: "text-primary bg-primary/10 border-primary/20",
    icon: Sparkles,
  },
  review: {
    label: "Review",
    color: "text-warning bg-warning/10 border-warning/20",
    icon: Sparkles,
  },
  approved: {
    label: "Approved",
    color: "text-success bg-success/10 border-success/20",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "text-destructive bg-destructive/10 border-destructive/20",
    icon: XCircle,
  },
};

const filterTabs: { key: string | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "pending", label: "Pending" },
  { key: "auto_categorized", label: "Auto-categorized" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const CATEGORIES = [
  "Software & Subscriptions",
  "Office Supplies",
  "Travel & Entertainment",
  "Professional Services",
  "Rent & Utilities",
  "Payroll",
  "Marketing",
  "Infrastructure",
  "Other Expenses",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function confidenceBar(confidence: number | null) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? "bg-success" : pct >= 75 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary/60">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Expenses() {
  const orgId = useOrgId();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    vendor_name: "",
    description: "",
    amount: "",
    category: CATEGORIES[0],
  });

  // Queries
  const queryFilter = activeTab ? { status: activeTab } : undefined;
  const { data: expenses = [], isLoading } = useExpenses(queryFilter);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  // Client-side search
  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        (e.vendor_name ?? "").toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  // Stats computed from ALL expenses (unfiltered) so cards stay stable across tabs
  const { data: allForStats = [] } = useExpenses();

  const totalExpenses = allForStats.reduce((s, e) => s + e.amount, 0);
  const pendingCount = allForStats.filter(
    (e) => e.status === "pending" || e.status === "review"
  ).length;
  const autoCategorizedCount = allForStats.filter(
    (e) => e.status === "auto_categorized"
  ).length;
  const avgConfidence =
    allForStats.length > 0
      ? allForStats.reduce((s, e) => s + (e.ai_confidence ?? 0), 0) / allForStats.length
      : 0;

  const summaryCards = [
    {
      label: "Total expenses",
      value: fmtCurrency(totalExpenses),
      sub: `${allForStats.length} expenses`,
      color: "text-foreground",
      icon: DollarSign,
    },
    {
      label: "Pending review",
      value: String(pendingCount),
      sub: "Need attention",
      color: "text-warning",
      icon: FileText,
    },
    {
      label: "Auto-categorized",
      value: String(autoCategorizedCount),
      sub: "By AI engine",
      color: "text-primary",
      icon: Sparkles,
    },
    {
      label: "Avg AI confidence",
      value: `${Math.round(avgConfidence * 100)}%`,
      sub: "Across all expenses",
      color: avgConfidence >= 0.9 ? "text-success" : avgConfidence >= 0.75 ? "text-warning" : "text-destructive",
      icon: Sparkles,
    },
  ];

  /* ---- handlers ---- */

  const handleCreate = () => {
    if (!form.vendor_name || !form.amount) {
      toast({ title: "Missing fields", description: "Vendor and amount are required.", variant: "destructive" });
      return;
    }
    createExpense.mutate(
      {
        org_id: orgId,
        date: form.date,
        vendor_name: form.vendor_name,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        status: "pending" as const,
        ai_confidence: null,
        ai_suggested_category: null,
        receipt_url: null,
      },
      {
        onSuccess: () => {
          setShowNew(false);
          setForm({
            date: new Date().toISOString().slice(0, 10),
            vendor_name: "",
            description: "",
            amount: "",
            category: CATEGORIES[0],
          });
          toast({ title: "Expense logged", description: `${form.vendor_name} - $${form.amount}` });
        },
      }
    );
  };

  const handleApprove = (exp: Expense) => {
    updateExpense.mutate(
      { id: exp.id, status: "approved" },
      { onSuccess: () => toast({ title: "Expense approved", description: `${exp.vendor_name} - ${fmtCurrency(exp.amount)}` }) }
    );
  };

  const handleReject = (exp: Expense) => {
    updateExpense.mutate(
      { id: exp.id, status: "rejected" },
      { onSuccess: () => toast({ title: "Expense rejected", description: `${exp.vendor_name} - ${fmtCurrency(exp.amount)}` }) }
    );
  };

  /* ---- render ---- */

  return (
    <AppLayout>
      <CommandPalette />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-categorized with receipt matching
          </p>
        </div>
        <Button size="sm" className="gap-2 rounded-xl glow-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Log Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((s, i) => (
          <div key={i} className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <p className={cn("mt-1 font-display text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key ?? "all"}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              activeTab === tab.key
                ? "border-primary/30 bg-primary/20 text-primary"
                : "border-border/30 bg-secondary/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by vendor or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      {/* Expense table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Vendor
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Category
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-5 py-3.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Receipt
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    Loading expenses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    {search ? "No expenses match your search." : "No expenses found."}
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => {
                  const sc = statusConfig[exp.status];
                  const StatusIcon = sc.icon;
                  const isPendingLike =
                    exp.status === "pending" ||
                    exp.status === "review" ||
                    exp.status === "auto_categorized";

                  return (
                    <tr
                      key={exp.id}
                      className="group border-b border-border/20 transition-colors hover:bg-secondary/20"
                    >
                      {/* Date */}
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {fmtDate(exp.date)}
                      </td>

                      {/* Vendor + description */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {exp.vendor_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">{exp.description}</p>
                      </td>

                      {/* Category badge */}
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground">
                          {exp.category ?? "Uncategorized"}
                        </span>
                      </td>

                      {/* Status badge + confidence */}
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                            sc.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {sc.label}
                        </span>
                        <div className="mt-1">{confidenceBar(exp.ai_confidence)}</div>
                      </td>

                      {/* Receipt icon */}
                      <td className="px-5 py-4 text-center">
                        {exp.receipt_url ? (
                          <Receipt className="mx-auto h-4 w-4 text-success" />
                        ) : (
                          <Upload className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 text-right text-sm font-semibold text-foreground">
                        -{fmtCurrency(exp.amount)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4">
                        {isPendingLike && (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => handleApprove(exp)}
                              className="rounded-lg p-1.5 text-success transition-colors hover:bg-success/10"
                              title="Approve"
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleReject(exp)}
                              className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                              title="Reject"
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Log Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vendor</label>
              <Input
                placeholder="e.g. AWS, Figma, WeWork"
                value={form.vendor_name}
                onChange={(e) => setForm((p) => ({ ...p, vendor_name: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
              <Input
                placeholder="What was this expense for?"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Amount ($)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm((p) => ({ ...p, category: cat }))}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                      form.category === cat
                        ? "border-primary/30 bg-primary/20 text-primary"
                        : "border-border/30 bg-secondary/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createExpense.isPending}
              className="w-full rounded-xl glow-primary"
            >
              {createExpense.isPending ? "Creating..." : "Log Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
