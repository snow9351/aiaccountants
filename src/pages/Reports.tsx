import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, FileText, Download, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  useProfitAndLoss,
  useExpenseBreakdown,
  useCashFlow,
  useBalanceSheet,
} from "@/hooks/useReports";

const PIE_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const tabs = [
  { key: "pl", label: "P&L", icon: TrendingUp },
  { key: "balance", label: "Balance Sheet", icon: BarChart3 },
  { key: "expenses", label: "Expense Breakdown", icon: PieChartIcon },
  { key: "cashflow", label: "Cash Flow", icon: FileText },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

const tooltipStyle = {
  background: "hsl(228, 20%, 12%)",
  border: "1px solid hsla(228, 15%, 30%, 0.3)",
  borderRadius: 12,
  color: "hsl(210, 40%, 98%)",
};

const axisTickStyle = { fill: "hsl(215, 20%, 55%)", fontSize: 12 };

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PLTab() {
  const { data: plData, isLoading } = useProfitAndLoss();

  if (isLoading || !plData) return <LoadingState />;
  if (plData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No report data yet. Import transactions to generate reports.</p>
      </div>
    );
  }

  const totalRevenue = plData.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = plData.reduce((s, d) => s + d.expenses, 0);
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-400">{fmtCurrency(totalRevenue)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Expenses</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-400">{fmtCurrency(totalExpenses)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Income</p>
          <p className={cn("mt-1 font-display text-2xl font-bold", netIncome >= 0 ? "text-indigo-400" : "text-red-400")}>
            {fmtCurrency(netIncome)}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Profit & Loss Trend</h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={plData}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsla(228, 15%, 25%, 0.5)" />
            <XAxis dataKey="period" tick={axisTickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmtCurrency(value)} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#gradRevenue)"
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#gradExpenses)"
              animationDuration={1200}
              animationBegin={300}
            />
            <Area
              type="monotone"
              dataKey="net_income"
              stroke="#6366F1"
              strokeWidth={2}
              fill="none"
              strokeDasharray="5 5"
              animationDuration={1200}
              animationBegin={600}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Revenue
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Expenses
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-6 rounded-full border-t-2 border-dashed border-indigo-500" /> Net Income
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceSheetTab() {
  const { data: bs, isLoading } = useBalanceSheet();

  if (isLoading || !bs) return <LoadingState />;

  const total = bs.total_assets || 1;
  const assetsPercent = Math.round((bs.total_assets / total) * 100);
  const liabilitiesPercent = Math.round((bs.total_liabilities / total) * 100);
  const equityPercent = Math.round((bs.total_equity / total) * 100);

  const items = [
    { label: "Total Assets", value: bs.total_assets, percent: assetsPercent, color: "#10B981", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Total Liabilities", value: bs.total_liabilities, percent: liabilitiesPercent, color: "#EF4444", bgClass: "bg-red-500/10 border-red-500/20" },
    { label: "Total Equity", value: bs.total_equity, percent: equityPercent, color: "#6366F1", bgClass: "bg-indigo-500/10 border-indigo-500/20" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className={cn("glass-card rounded-2xl border p-6", item.bgClass)}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-foreground">{fmtCurrency(item.value)}</p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary/50">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${item.percent}%`, backgroundColor: item.color }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.percent}% of total assets</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Balance Overview</h3>
        <div className="flex h-8 w-full overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-center text-xs font-medium text-white transition-all duration-1000"
            style={{ width: `${assetsPercent}%`, backgroundColor: "#10B981" }}
          >
            Assets
          </div>
          <div
            className="flex items-center justify-center text-xs font-medium text-white transition-all duration-1000"
            style={{ width: `${liabilitiesPercent}%`, backgroundColor: "#EF4444" }}
          >
            Liabilities
          </div>
          <div
            className="flex items-center justify-center text-xs font-medium text-white transition-all duration-1000"
            style={{ width: `${equityPercent}%`, backgroundColor: "#6366F1" }}
          >
            Equity
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-secondary/20 p-4">
          <p className="text-sm text-muted-foreground">
            Assets = Liabilities + Equity
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-foreground">
            {fmtCurrency(bs.total_assets)} = {fmtCurrency(bs.total_liabilities)} + {fmtCurrency(bs.total_equity)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpenseBreakdownTab() {
  const { data: expenses, isLoading } = useExpenseBreakdown();

  if (isLoading || !expenses) return <LoadingState />;
  if (expenses.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No expenses found yet.</p>
      </div>
    );
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Expense Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenses}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="amount"
                nameKey="category"
                animationDuration={1200}
                animationBegin={0}
              >
                {expenses.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => fmtCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 text-center">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="font-display text-2xl font-bold text-foreground">{fmtCurrency(totalAmount)}</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Category Breakdown</h3>
          <div className="space-y-4">
            {expenses.map((item, i) => (
              <div key={item.category} className="group">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{fmtCurrency(item.amount)}</span>
                    <span className="min-w-[3rem] text-right text-xs text-muted-foreground">{item.percentage}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CashFlowTab() {
  const { data: cashData, isLoading } = useCashFlow();

  if (isLoading || !cashData) return <LoadingState />;
  if (cashData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No cash flow data yet.</p>
      </div>
    );
  }

  const totalInflow = cashData.reduce((s, d) => s + d.revenue, 0);
  const totalOutflow = cashData.reduce((s, d) => s + d.expenses, 0);
  const netCashFlow = totalInflow - totalOutflow;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cash Inflow</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-400">{fmtCurrency(totalInflow)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cash Outflow</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-400">{fmtCurrency(totalOutflow)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Cash Flow</p>
          <p className={cn("mt-1 font-display text-2xl font-bold", netCashFlow >= 0 ? "text-indigo-400" : "text-red-400")}>
            {fmtCurrency(netCashFlow)}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Cash Flow Trend</h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={cashData}>
            <defs>
              <linearGradient id="gradInflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOutflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsla(228, 15%, 25%, 0.5)" />
            <XAxis dataKey="period" tick={axisTickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmtCurrency(value)} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Inflow"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#gradInflow)"
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Outflow"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#gradOutflow)"
              animationDuration={1200}
              animationBegin={300}
            />
            <Area
              type="monotone"
              dataKey="net_income"
              name="Net"
              stroke="#6366F1"
              strokeWidth={2}
              fill="none"
              strokeDasharray="5 5"
              animationDuration={1200}
              animationBegin={600}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Inflow
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Outflow
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-6 rounded-full border-t-2 border-dashed border-indigo-500" /> Net
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabKey>("pl");

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Financial reports powered by real-time data</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-secondary/20 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "pl" && <PLTab />}
      {activeTab === "balance" && <BalanceSheetTab />}
      {activeTab === "expenses" && <ExpenseBreakdownTab />}
      {activeTab === "cashflow" && <CashFlowTab />}
    </AppLayout>
  );
}
