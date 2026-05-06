import { ArrowUpRight, ArrowDownLeft, Sparkles, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const transactions = [
  { vendor: "Stripe", description: "Payment from Acme Corp", amount: "+$5,240.00", type: "income", category: "Revenue", confidence: 98, time: "2 min ago" },
  { vendor: "AWS", description: "Cloud hosting - March", amount: "-$1,280.00", type: "expense", category: "Infrastructure", confidence: 95, time: "1 hr ago" },
  { vendor: "Figma", description: "Team plan subscription", amount: "-$75.00", type: "expense", category: "Software", confidence: 99, time: "3 hrs ago" },
  { vendor: "Invoice #1042", description: "Payment from TechFlow", amount: "+$8,500.00", type: "income", category: "Revenue", confidence: 97, time: "5 hrs ago" },
  { vendor: "Gusto", description: "Payroll - March cycle 2", amount: "-$24,800.00", type: "expense", category: "Payroll", confidence: 100, time: "1 day ago" },
  { vendor: "Google Ads", description: "March campaign spend", amount: "-$2,150.00", type: "expense", category: "Marketing", confidence: 88, time: "1 day ago" },
];

export function RecentTransactions() {
  const navigate = useNavigate();

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Recent Transactions</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Auto-categorized by AI</p>
        </div>
        <button onClick={() => navigate("/transactions")} className="text-xs font-medium text-primary hover:underline">View All</button>
      </div>
      <div className="space-y-1">
        {transactions.map((tx, i) => (
          <div
            key={i}
            onClick={() => navigate("/transactions")}
            className="group flex cursor-pointer items-center gap-4 rounded-xl px-3 py-3 transition-all hover:bg-secondary/40"
          >
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              tx.type === "income" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
            )}>
              {tx.type === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{tx.vendor}</p>
                {tx.confidence < 95 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    <Sparkles className="h-2.5 w-2.5" /> {tx.confidence}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tx.description}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-semibold", tx.type === "income" ? "text-success" : "text-foreground")}>
                {tx.amount}
              </p>
              <p className="text-[10px] text-muted-foreground">{tx.time}</p>
            </div>
            <button className="opacity-0 transition-opacity group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
