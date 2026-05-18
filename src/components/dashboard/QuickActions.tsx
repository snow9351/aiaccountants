import { FileText, ShoppingCart, Receipt, BookMarked, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const actions = [
  { icon: FileText, label: "New invoice", color: "primary", path: "/invoices?action=new" },
  { icon: ShoppingCart, label: "Vendor bill", color: "primary", path: "/bills" },
  { icon: Receipt, label: "Log expense", color: "accent", path: "/expenses" },
  { icon: BookMarked, label: "Journal entry", color: "accent", path: "/journal-entries" },
  { icon: Sparkles, label: "Ask AI", color: "primary", action: "ai-chat" as const },
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleAction = (action: (typeof actions)[number]) => {
    if ("path" in action && action.path) {
      navigate(action.path);
    } else if (action.action === "ai-chat") {
      const btn = document.querySelector("[data-ai-chat-trigger]") as HTMLButtonElement;
      btn?.click();
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-foreground">Quick actions</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleAction(action)}
            className={cn(
              "glass-subtle flex flex-col items-center gap-2 rounded-xl px-3 py-4 transition-all hover:scale-[1.02]",
              action.color === "primary"
                ? "hover:glow-primary hover:border-primary/30"
                : "hover:glow-accent hover:border-accent/30",
            )}
          >
            <action.icon
              className={cn("h-5 w-5", action.color === "primary" ? "text-primary" : "text-accent")}
            />
            <span className="text-xs font-medium text-foreground">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
