import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  ArrowLeftRight,
  Receipt,
  Calculator,
  BarChart3,
  Users,
  Sparkles,
  Settings,
  Search,
  LayoutDashboard,
  Wallet,
  Building2,
  Shield,
  BookOpen,
  BookMarked,
  Store,
  ShoppingCart,
  Target,
  FolderKanban,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Expose open function globally so TopBar can trigger it
  useEffect(() => {
    (window as any).__openCommandPalette = () => setOpen(true);
    return () => { delete (window as any).__openCommandPalette; };
  }, []);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Ask anything… e.g. 'create invoice for Acme $5,000'" />
      <CommandList>
        <CommandEmpty>No results. Try asking in natural language.</CommandEmpty>
        <CommandGroup heading="AI Actions">
          <CommandItem className="gap-3" onSelect={() => runAction(() => {
            // Open AI Chat
            const btn = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
            btn?.click();
          })}>
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Ask AI a question about your finances</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/insights"))}>
            <BarChart3 className="h-4 w-4 text-info" />
            <span>Generate custom report</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/invoices?action=new"))}>
            <FileText className="h-4 w-4" />
            <span>Create Invoice</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/transactions"))}>
            <ArrowLeftRight className="h-4 w-4" />
            <span>Record Payment</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/expenses"))}>
            <Receipt className="h-4 w-4" />
            <span>Log Expense</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/dashboard"))}>
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/transactions"))}>
            <Search className="h-4 w-4" />
            <span>Transactions</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/invoices"))}>
            <FileText className="h-4 w-4" />
            <span>Invoices</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/expenses"))}>
            <Receipt className="h-4 w-4" />
            <span>Expenses</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/customers"))}>
            <Users className="h-4 w-4" />
            <span>Customers</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/banking"))}>
            <Wallet className="h-4 w-4" />
            <span>Banking</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/payroll"))}>
            <Building2 className="h-4 w-4" />
            <span>Payroll</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/reports"))}>
            <BarChart3 className="h-4 w-4" />
            <span>Reports</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/audit"))}>
            <Shield className="h-4 w-4" />
            <span>Audit Log</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/settings"))}>
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Accounting">
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/accounts"))}>
            <BookOpen className="h-4 w-4" />
            <span>Chart of Accounts</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/journal-entries"))}>
            <BookMarked className="h-4 w-4" />
            <span>Journal Entries</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/vendors"))}>
            <Store className="h-4 w-4" />
            <span>Vendors</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/bills"))}>
            <ShoppingCart className="h-4 w-4" />
            <span>Bills</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Advanced">
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/budgets"))}>
            <Target className="h-4 w-4" />
            <span>Budgets</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/projects"))}>
            <FolderKanban className="h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/tax"))}>
            <Calculator className="h-4 w-4" />
            <span>Tax Center</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
