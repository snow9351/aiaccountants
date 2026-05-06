import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Sparkles, AlertTriangle, TrendingUp, Clock, ChevronRight, Brain, DollarSign, Shield, BarChart3, X, Search, SendHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useAIAlerts, useDismissAlert } from "@/hooks/useAIInsights";
import { useNavigate } from "react-router-dom";
import type { AIAlert } from "@/integrations/supabase/types";

const typeIconMap: Record<string, React.ElementType> = {
  warning: AlertTriangle,
  anomaly: Shield,
  insight: TrendingUp,
  forecast: Clock,
  categorization: Brain,
  optimization: DollarSign,
  default: BarChart3,
};

const typeColorMap: Record<string, string> = {
  warning: "text-warning bg-warning/10 border-warning/20",
  anomaly: "text-destructive bg-destructive/10 border-destructive/20",
  insight: "text-success bg-success/10 border-success/20",
  forecast: "text-info bg-info/10 border-info/20",
  categorization: "text-accent bg-accent/10 border-accent/20",
  optimization: "text-primary bg-primary/10 border-primary/20",
  default: "text-muted-foreground bg-secondary/30 border-border/30",
};

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-secondary/50 text-muted-foreground",
};

const NL_EXAMPLES = [
  "What were my top 5 expenses last month?",
  "Show me revenue trend for the past 6 months",
  "Which customers have overdue invoices?",
  "What's my burn rate?",
  "Compare Q1 vs Q2 expenses by category",
];

const MOCK_RESPONSES: Record<string, string> = {
  "top": "Your top 5 expenses last month were: 1) Payroll ($22,000) 2) Cloud hosting ($4,200) 3) Office rent ($4,500) 4) Legal fees ($7,500) 5) Software subscriptions ($2,400). Total: $40,600.",
  "revenue": "Revenue trend (6 months): Oct $42K → Nov $48K → Dec $52K → Jan $45K → Feb $55K → Mar $61K. That's a 17.3% month-over-month growth rate with a strong upward trajectory.",
  "overdue": "3 customers have overdue invoices: 1) TechFlow Solutions — INV-2024-002 ($8,750, 31 days overdue) 2) Meridian Partners — INV-2024-003 ($5,200, 15 days overdue) 3) Vertex Industries — INV-2024-004 ($3,100, 7 days overdue). Total overdue: $17,050.",
  "burn": "Current monthly burn rate: $38,000. At your current cash balance of $241,000, you have approximately 6.3 months of runway. Revenue covers 160% of burn, so you're cash-flow positive.",
  "compare": "Q1 vs Q2 expense comparison: Payroll +5% ($66K → $69.3K), Software -8% ($7.2K → $6.6K), Rent 0% ($13.5K), Travel +22% ($3.6K → $4.4K). Overall Q2 expenses increased 3.2% vs Q1.",
};

export default function Insights() {
  const navigate = useNavigate();
  const { data: alerts = [] } = useAIAlerts();
  const dismissAlert = useDismissAlert();
  const [nlQuery, setNlQuery] = useState("");
  const [nlResponse, setNlResponse] = useState<string | null>(null);
  const [nlLoading, setNlLoading] = useState(false);

  const highCount = alerts.filter((a: AIAlert) => a.priority === "high").length;

  const handleNlQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    setNlResponse(null);
    // Simulate AI response (matches keywords from mock responses)
    await new Promise(r => setTimeout(r, 1200));
    const key = Object.keys(MOCK_RESPONSES).find(k => nlQuery.toLowerCase().includes(k));
    setNlResponse(key ? MOCK_RESPONSES[key] : `Based on your financial data: Your query "${nlQuery}" would be processed by the AI engine. Connect the Anthropic API key in .env to enable live NL-to-SQL queries against your ledger.`);
    setNlLoading(false);
  };

  return (
    <AppLayout>
      <CommandPalette />
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">AI Insights</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Proactive alerts from anomaly detection and forecasting models</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active insights</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{alerts.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{highCount} high priority</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forecast accuracy</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">MAPE 11.2%</p>
          <p className="mt-1 text-xs text-muted-foreground">Target: &lt; 15%</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI classification</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">94.2%</p>
          <p className="mt-1 text-xs text-muted-foreground">Accuracy (90-day rolling)</p>
        </div>
      </div>

      {/* NL Query */}
      <div className="mb-6 glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Ask anything about your finances</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNlQuery()}
              placeholder="e.g. What were my top 5 expenses last month?"
              className="w-full rounded-xl border border-border/50 bg-background/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>
          <button
            onClick={handleNlQuery}
            disabled={nlLoading || !nlQuery.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            {nlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {NL_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setNlQuery(ex); }}
              className="rounded-lg border border-border/30 bg-secondary/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
        {nlResponse && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed text-foreground">{nlResponse}</p>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display text-lg font-semibold text-foreground">Proactive Alerts</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{alerts.length}</span>
      </div>

      <div className="space-y-4">
        {alerts.map((alert: AIAlert) => {
          const IconComponent = typeIconMap[alert.type] ?? typeIconMap.default;
          const colorClass = typeColorMap[alert.type] ?? typeColorMap.default;
          return (
            <div
              key={alert.id}
              className="glass-card group rounded-2xl p-5 transition-all hover:scale-[1.005]"
            >
              <div className="flex items-start gap-4">
                <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", colorClass)}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-foreground">{alert.title}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", priorityColors[alert.priority] ?? priorityColors.low)}>
                      {alert.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{alert.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {alert.action_label && (
                    <button
                      onClick={() => alert.action_url && navigate(alert.action_url)}
                      className="flex items-center gap-1 rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
                    >
                      {alert.action_label}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => dismissAlert.mutate(alert.id)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">No active AI insights at the moment. Check back soon.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
