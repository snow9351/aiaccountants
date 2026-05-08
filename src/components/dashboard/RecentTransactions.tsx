import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Sparkles, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useOrgId } from "@/hooks/useCompanies";

function relativeLabel(isoDate: string): string {
  const parsed = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const txDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const diffDays = Math.round((startToday - txDay) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));

export function RecentTransactions() {
  const navigate = useNavigate();
  const orgId = useOrgId();
  const { data: rows = [], isLoading } = useTransactions({ limit: 6, orgId });

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Recent Transactions</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Same data as your Transactions page</p>
        </div>
        <button onClick={() => navigate("/transactions")} className="text-xs font-medium text-primary hover:underline">
          View All
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No transactions yet. Add some on Transactions.</div>
      ) : (
        <div className="space-y-1">
          {rows.map((tx) => {
            const vendor = tx.merchant?.trim() || "—";
            const isIncome = tx.type === "income";
            const isTransfer = tx.type === "transfer";
            const pct =
              typeof tx.ai_confidence === "number" && !Number.isNaN(tx.ai_confidence)
                ? Math.round(tx.ai_confidence * 100)
                : null;
            return (
              <div
                key={tx.id}
                onClick={() => navigate("/transactions")}
                className="group flex cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-all hover:bg-secondary/40"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isTransfer ? "bg-primary/10 text-primary" : isIncome ? "bg-success/10 text-success" : "bg-accent/10 text-accent",
                  )}
                >
                  {isTransfer ? (
                    <ArrowLeftRight className="h-4 w-4" />
                  ) : isIncome ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{vendor}</p>
                    {pct !== null && pct < 95 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        <Sparkles className="h-2.5 w-2.5" /> {pct}%
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      isIncome ? "text-success" : isTransfer ? "text-primary" : "text-foreground",
                    )}
                  >
                    {isIncome ? "+" : ""}
                    {fmtUsd(tx.amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{relativeLabel(tx.date)}</p>
                </div>
                <button type="button" className="opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
