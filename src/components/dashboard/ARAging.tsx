import { cn } from "@/lib/utils";

const buckets = [
  { label: "Current", amount: 28400, percent: 42, color: "bg-success" },
  { label: "1-30 days", amount: 15200, percent: 22, color: "bg-info" },
  { label: "31-60 days", amount: 12600, percent: 18, color: "bg-warning" },
  { label: "61-90 days", amount: 8100, percent: 12, color: "bg-accent" },
  { label: "90+ days", amount: 3800, percent: 6, color: "bg-destructive" },
];

export function ARAging() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5">
        <h3 className="font-display text-lg font-semibold text-foreground">AR Aging</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">$68,100 total outstanding</p>
      </div>

      {/* Stacked bar */}
      <div className="mb-5 flex h-3 overflow-hidden rounded-full">
        {buckets.map((b, i) => (
          <div key={i} className={cn("transition-all", b.color)} style={{ width: `${b.percent}%` }} />
        ))}
      </div>

      <div className="space-y-3">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", b.color)} />
              <span className="text-sm text-muted-foreground">{b.label}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">${b.amount.toLocaleString()}</span>
              <span className="w-10 text-right text-xs text-muted-foreground">{b.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
