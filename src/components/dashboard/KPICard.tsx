import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
  glowColor?: "primary" | "accent";
}

export function KPICard({ title, value, change, trend, icon: Icon, glowColor = "primary" }: KPICardProps) {
  return (
    <div className={cn(
      "glass-card group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]",
      glowColor === "primary" ? "hover:glow-primary" : "hover:glow-accent"
    )}>
      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
        glowColor === "primary" ? "bg-primary" : "bg-accent"
      )} />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
          <div className="mt-2 flex items-center gap-1.5">
            {trend === "up" ? (
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={cn("text-xs font-medium", trend === "up" ? "text-success" : "text-destructive")}>
              {change}
            </span>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          glowColor === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
