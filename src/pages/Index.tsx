import { DollarSign, TrendingUp, Receipt, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ARAging } from "@/components/dashboard/ARAging";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AiToolBar } from "@/components/dashboard/AiToolBar";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardKPIs } from "@/hooks/useDashboard";

const Index = () => {
  const { user } = useAuth();
  const { data: kpis, isPending: kpisPending } = useDashboardKPIs();

  const displayName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Jordan';

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  return (
    <AppLayout>
      <CommandPalette />

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {greeting}, <span className="text-gradient">{displayName}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's your financial overview for {dateStr}
        </p>
      </div>

      <AiToolBar />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Revenue"
          value={kpisPending || !kpis ? "…" : fmtCurrency(kpis.revenue)}
          change={kpisPending || !kpis ? "…" : `${kpis.revenueTrend >= 0 ? "+" : ""}${kpis.revenueTrend.toFixed(1)}%`}
          trend={kpis && kpis.revenueTrend >= 0 ? "up" : "down"}
          icon={DollarSign}
        />
        <KPICard
          title="Net Profit"
          value={kpisPending || !kpis ? "…" : fmtCurrency(kpis.netProfit)}
          change={kpisPending || !kpis ? "…" : `${kpis.netProfitTrend >= 0 ? "+" : ""}${kpis.netProfitTrend.toFixed(1)}%`}
          trend={kpis && kpis.netProfitTrend >= 0 ? "up" : "down"}
          icon={TrendingUp}
          glowColor="accent"
        />
        <KPICard
          title="Expenses"
          value={kpisPending || !kpis ? "…" : fmtCurrency(kpis.expenses)}
          change={kpisPending || !kpis ? "…" : `${kpis.expensesTrend >= 0 ? "+" : ""}${kpis.expensesTrend.toFixed(1)}%`}
          trend={kpis && kpis.expensesTrend <= 0 ? "up" : "down"}
          icon={Receipt}
        />
        <KPICard
          title="Customers"
          value={kpisPending || !kpis ? "…" : String(kpis.activeCustomers)}
          change={kpisPending || !kpis ? "…" : `${kpis.customersTrend >= 0 ? "+" : ""}${kpis.customersTrend}`}
          trend="up"
          icon={Users}
          glowColor="accent"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - 2 cols */}
        <div className="space-y-6 lg:col-span-2">
          <CashFlowChart />
          <RecentTransactions />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <QuickActions />
          <ARAging />
        </div>
      </div>

      {/* AI Insights - Full width */}
      <div className="mt-6">
        <AIInsights />
      </div>
    </AppLayout>
  );
};

export default Index;
