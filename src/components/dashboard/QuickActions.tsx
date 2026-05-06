import { FileText, ArrowLeftRight, Receipt, Calculator, Sparkles, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const actions = [
  { icon: FileText, label: "Create Invoice", color: "primary", path: "/invoices" },
  { icon: ArrowLeftRight, label: "Record Payment", color: "accent", path: "/transactions" },
  { icon: Receipt, label: "Log Expense", color: "primary", path: "/expenses" },
  { icon: Calculator, label: "Journal Entry", color: "accent", path: "/journal-entries" },
  { icon: Sparkles, label: "Ask AI", color: "primary", action: "ai-chat" },
  { icon: Upload, label: "Scan Receipt", color: "accent", path: "/expenses" },
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleAction = (action: typeof actions[0]) => {
    if (action.path) {
      navigate(action.path);
    } else if (action.action === "ai-chat") {
      const btn = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
      btn?.click();
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => handleAction(action)}
            className={cn(
              "glass-subtle flex flex-col items-center gap-2 rounded-xl px-3 py-4 transition-all hover:scale-[1.03]",
              action.color === "primary" ? "hover:glow-primary hover:border-primary/30" : "hover:glow-accent hover:border-accent/30"
            )}
          >
            <action.icon className={cn(
              "h-5 w-5",
              action.color === "primary" ? "text-primary" : "text-accent"
            )} />
            <span className="text-xs font-medium text-muted-foreground">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
