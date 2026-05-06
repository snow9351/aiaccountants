import { AppLayout } from "@/components/layout/AppLayout";
import { Calculator, Calendar, FileText, AlertCircle, CheckCircle, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useVendors } from "@/hooks/useVendors";
import { useExpenses } from "@/hooks/useExpenses";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const ESTIMATED_TAX_PAYMENTS = [
  { quarter: "Q1 2024", due: "2024-04-15", amount: 8200, paid: true, paid_date: "2024-04-10" },
  { quarter: "Q2 2024", due: "2024-06-17", amount: 9100, paid: true, paid_date: "2024-06-12" },
  { quarter: "Q3 2024", due: "2024-09-16", amount: 8750, paid: false, paid_date: null },
  { quarter: "Q4 2024", due: "2025-01-15", amount: 9400, paid: false, paid_date: null },
];

const SCHEDULE_C_CATEGORIES = [
  { category: "Advertising & Marketing", code: "Line 8", amount: 11200 },
  { category: "Car & Truck Expenses", code: "Line 9", amount: 3400 },
  { category: "Contract Labor", code: "Line 11", amount: 48000 },
  { category: "Insurance", code: "Line 15", amount: 2800 },
  { category: "Office Expense", code: "Line 18", amount: 4200 },
  { category: "Rent & Lease", code: "Line 20a", amount: 21600 },
  { category: "Repairs & Maintenance", code: "Line 21", amount: 1100 },
  { category: "Taxes & Licenses", code: "Line 23", amount: 3200 },
  { category: "Travel & Entertainment", code: "Line 24", amount: 14800 },
  { category: "Utilities", code: "Line 25", amount: 2400 },
  { category: "Wages", code: "Line 26", amount: 112250 },
  { category: "Other Expenses", code: "Line 27", amount: 8900 },
];

const TAX_DEADLINES = [
  { label: "Q2 Estimated Tax", date: "Jun 17, 2025", daysLeft: 73, type: "payment" },
  { label: "1099-NEC Deadline (e-file)", date: "Apr 1, 2025", daysLeft: 0, type: "filing", done: true },
  { label: "S-Corp Tax Return (1120-S)", date: "Mar 15, 2025", daysLeft: 0, type: "filing", done: true },
  { label: "Q3 Estimated Tax", date: "Sep 16, 2025", daysLeft: 164, type: "payment" },
];

export default function TaxCenter() {
  const { data: vendors = [] } = useVendors();
  const { data: expenses = [] } = useExpenses();

  // 1099 vendors: paid > $600 (in demo, just use all 1099 vendors with mock amounts)
  const vendors1099 = vendors.filter(v => v.is_1099 && v.total_spend >= 600);
  const totalEstimated = ESTIMATED_TAX_PAYMENTS.reduce((s, p) => s + p.amount, 0);
  const totalPaid = ESTIMATED_TAX_PAYMENTS.filter(p => p.paid).reduce((s, p) => s + p.amount, 0);
  const totalScheduleC = SCHEDULE_C_CATEGORIES.reduce((s, c) => s + c.amount, 0);

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Tax Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Estimated taxes, 1099s, and Schedule C</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Est. Tax Owed (YTD)</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalEstimated)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid to Date</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(totalPaid)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(totalEstimated - totalPaid)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">1099 Vendors</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{vendors1099.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requiring forms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Estimated Tax Payments */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <DollarSign className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Estimated Tax Payments</h2>
          </div>
          <div className="divide-y divide-border/20">
            {ESTIMATED_TAX_PAYMENTS.map(payment => (
              <div key={payment.quarter} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{payment.quarter}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(payment.due).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-foreground">{fmtCurrency(payment.amount)}</p>
                  {payment.paid ? (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
                      <CheckCircle className="h-3 w-3" /> Paid {payment.paid_date ? new Date(payment.paid_date).toLocaleDateString() : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-medium text-warning">
                      <AlertCircle className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tax Deadlines */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Upcoming Deadlines</h2>
          </div>
          <div className="divide-y divide-border/20">
            {TAX_DEADLINES.map(deadline => (
              <div key={deadline.label} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{deadline.label}</p>
                  <p className="text-xs text-muted-foreground">{deadline.date}</p>
                </div>
                {"done" in deadline && deadline.done ? (
                  <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
                    <CheckCircle className="h-3 w-3" /> Filed
                  </span>
                ) : (
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-medium",
                    deadline.daysLeft <= 30 ? "bg-destructive/10 text-destructive" :
                    deadline.daysLeft <= 90 ? "bg-warning/10 text-warning" :
                    "bg-info/10 text-info"
                  )}>
                    {deadline.daysLeft}d left
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule C */}
        <div className="glass-card rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Schedule C — Business Expenses</h2>
            </div>
            <p className="text-sm font-medium text-foreground">Total: {fmtCurrency(totalScheduleC)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IRS Line</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE_C_CATEGORIES.map(cat => (
                  <tr key={cat.code} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{cat.category}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{cat.code}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-foreground">{fmtCurrency(cat.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1 rounded-full bg-secondary/50 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(cat.amount / totalScheduleC) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{((cat.amount / totalScheduleC) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1099 Vendor Report */}
        <div className="glass-card rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">1099-NEC Report — Contractors Paid ≥ $600</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{vendors1099.length} vendors</span>
          </div>
          {vendors1099.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Vendor</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax ID</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Paid (YTD)</th>
                    <th className="px-5 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors1099.map(vendor => (
                    <tr key={vendor.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-foreground">{vendor.name}</p>
                        {vendor.email && <p className="text-xs text-muted-foreground">{vendor.email}</p>}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{vendor.tax_id ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">{fmtCurrency(vendor.total_spend)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-medium",
                          vendor.tax_id ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        )}>
                          {vendor.tax_id ? "Tax ID on file" : "Missing Tax ID"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No 1099 vendors meeting the $600 threshold this year.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
