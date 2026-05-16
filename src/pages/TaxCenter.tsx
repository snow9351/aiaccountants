import { AppLayout } from "@/components/layout/AppLayout";
import { Calculator, Calendar, FileText, CheckCircle, DollarSign, TrendingUp, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useOrgId } from "@/hooks/useCompanies";
import { useVendors1099Threshold } from "@/hooks/useContacts";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function TaxCenter() {
  const orgId = useOrgId();
  const currentYear = new Date().getFullYear();
  const { data: vendors1099 = [] } = useVendors1099Threshold(orgId, currentYear);

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
          <p className="mt-1 font-display text-2xl font-bold text-foreground">—</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid to Date</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">—</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">—</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">1099 Vendors</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{vendors1099.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">≥ $600 YTD ({currentYear})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Estimated Tax Payments */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <DollarSign className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Estimated Tax Payments</h2>
          </div>
          <div className="p-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Estimated tax payments aren’t configured yet.</p>
          </div>
        </div>

        {/* Tax Deadlines */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Upcoming Deadlines</h2>
          </div>
          <div className="p-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Tax deadlines aren’t configured yet.</p>
          </div>
        </div>

        {/* Schedule C */}
        <div className="glass-card rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Schedule C — Business Expenses</h2>
            </div>
            <p className="text-sm font-medium text-foreground">Total: —</p>
          </div>
          <div className="p-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Schedule C mapping isn’t configured yet. Add categories/tax mappings to generate this report.
            </p>
          </div>
        </div>

        {/* 1099 Vendor Report */}
        <div className="glass-card rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">1099-NEC Report — Contractors Paid ≥ $600</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {vendors1099.length} vendors
            </span>
          </div>
          {vendors1099.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Vendor</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax ID</th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid (YTD)</th>
                    <th className="px-5 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors1099.map((row) => (
                    <tr key={row.vendor_id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-foreground">{row.display_name}</p>
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{row.tax_id ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                        {fmtCurrency(Number(row.ytd_1099_payments))}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-medium",
                            row.tax_id ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          )}
                        >
                          {row.tax_id ? "Tax ID on file" : "Missing Tax ID"}
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
              <p className="text-sm text-muted-foreground">
                No 1099-eligible vendors at or above $600 YTD for {currentYear}. Payments are tracked when bills are marked paid.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
