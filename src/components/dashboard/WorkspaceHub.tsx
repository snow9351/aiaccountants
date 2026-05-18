import { useNavigate } from "react-router-dom";
import {
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  Users,
  BarChart3,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const hubs = [
  {
    title: "Get paid",
    description: "Send invoices and track who owes you.",
    color: "border-primary/25 bg-primary/5 hover:border-primary/40",
    items: [
      { icon: FileText, label: "Invoices", path: "/invoices", hint: "Accounts receivable" },
    ],
  },
  {
    title: "Pay & spend",
    description: "Vendor bills (pay later) vs expenses (already paid).",
    color: "border-warning/25 bg-warning/5 hover:border-warning/40",
    items: [
      { icon: ShoppingCart, label: "Vendor bills", path: "/bills", hint: "You owe — A/P" },
      { icon: Receipt, label: "Expenses", path: "/expenses", hint: "Card or cash today" },
    ],
  },
  {
    title: "Bank & books",
    description: "Connect accounts and review the ledger.",
    color: "border-accent/25 bg-accent/5 hover:border-accent/40",
    items: [
      { icon: Wallet, label: "Banking", path: "/banking", hint: "Accounts" },
      { icon: BarChart3, label: "Reports", path: "/reports", hint: "Financial statements" },
      { icon: BookOpen, label: "Chart of accounts", path: "/accounts", hint: "COA" },
    ],
  },
  {
    title: "People",
    description: "Customers, vendors, payroll & 1099.",
    color: "border-border/50 bg-secondary/20 hover:border-border",
    items: [{ icon: Users, label: "Contacts", path: "/contacts", hint: "CRM + vendors" }],
  },
];

export function WorkspaceHub() {
  const navigate = useNavigate();

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Workspace</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump to the right area — bills and expenses are separate on purpose.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hubs.map((hub) => (
          <div
            key={hub.title}
            className={cn("rounded-xl border p-4 transition-colors", hub.color)}
          >
            <h4 className="text-sm font-semibold text-foreground">{hub.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{hub.description}</p>
            <ul className="mt-3 space-y-1.5">
              {hub.items.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-background/60"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{item.hint}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
