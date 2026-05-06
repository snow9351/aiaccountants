import { Sparkles, AlertTriangle, TrendingUp, Clock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const insights = [
  {
    type: "warning" as const,
    icon: AlertTriangle,
    title: "3 invoices overdue > 60 days",
    description: "Acme Corp ($12,400), TechFlow ($8,200), Nova Inc ($3,100). AI has drafted follow-up emails.",
    action: "Review & Send",
    color: "warning",
    navigate: "/invoices",
  },
  {
    type: "insight" as const,
    icon: TrendingUp,
    title: "Revenue up 18% this quarter",
    description: "Driven by 4 new recurring contracts. Projected to exceed quarterly target by $22K.",
    action: "View Report",
    color: "success",
    navigate: "/reports",
  },
  {
    type: "anomaly" as const,
    icon: Sparkles,
    title: "Unusual vendor payment detected",
    description: "AWS charge of $4,820 — 3.2x higher than 90-day average. Possible billing spike.",
    action: "Investigate",
    color: "accent",
    navigate: "/transactions",
  },
  {
    type: "forecast" as const,
    icon: Clock,
    title: "Cash runway: 8.2 months",
    description: "Based on current burn rate of $34K/mo. Recommendation: accelerate AR collection.",
    action: "View Forecast",
    color: "info",
    navigate: "/insights",
  },
];

const colorMap = {
  warning: "text-warning bg-warning/10 border-warning/20",
  success: "text-success bg-success/10 border-success/20",
  accent: "text-accent bg-accent/10 border-accent/20",
  info: "text-info bg-info/10 border-info/20",
};

export function AIInsights() {
  const nav = useNavigate();

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">AI Insights</h3>
          <p className="text-xs text-muted-foreground">Proactive alerts powered by your data</p>
        </div>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-xl border border-border/30 bg-secondary/30 p-4 transition-all hover:bg-secondary/60"
          >
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", colorMap[insight.color as keyof typeof colorMap])}>
              <insight.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{insight.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.description}</p>
            </div>
            <button
              onClick={() => nav(insight.navigate)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
            >
              {insight.action}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
