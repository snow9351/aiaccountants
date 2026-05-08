import { cn } from "@/lib/utils";
import { useARAgingData } from "@/hooks/useDashboard";

const COLORS = ["bg-success", "bg-info", "bg-warning", "bg-accent", "bg-destructive"];

export function ARAging() {
  const { data: bucketsData = [], isPending } = useARAgingData();

  const buckets = bucketsData.map((b, i) => ({
    label: b.bucket,
    amount: b.amount,
    count: b.count,
    color: COLORS[i % COLORS.length]!,
  }));

  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const totalFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(total);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5">
        <h3 className="font-display text-lg font-semibold text-foreground">AR Aging</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isPending ? "Loading…" : `${totalFmt} total outstanding`}
        </p>
      </div>

      {/* Stacked bar */}
      <div className="mb-5 flex h-3 overflow-hidden rounded-full">
        {total <= 0 ? (
          <div className="h-full w-full bg-secondary/40" />
        ) : (
          buckets.map((b, i) => (
            <div
              key={i}
              className={cn("transition-all", b.color)}
              style={{ width: `${(b.amount / total) * 100}%` }}
            />
          ))
        )}
      </div>

      <div className="space-y-3">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", b.color)} />
              <span className="text-sm text-muted-foreground">{b.label}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                ${b.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground">{b.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
