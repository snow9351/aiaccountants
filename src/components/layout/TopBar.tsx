import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Command, Plus, LogOut, Settings, Home, Menu, Briefcase, Shield, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { useMyFirm } from "@/hooks/useFirm";

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const navigate = useNavigate();
  const [showNewTx, setShowNewTx] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [txForm, setTxForm] = useState({ vendor: "", amount: "", description: "", type: "expense" });
  const { user, signOut } = useAuth();
  const { data: companies = [] } = useCompanies();
  const { activeOrgId } = useCompanyStore();
  const { data: firm } = useMyFirm();

  const activeCompany = companies.find((c) => c.id === activeOrgId) ?? companies[0];
  const activeRole = activeCompany?.role as string | undefined;
  const isReadOnly = activeRole === "read_only";

  // Listen for sidebar "New Transaction" button
  useEffect(() => {
    const handler = () => setShowNewTx(true);
    window.addEventListener('open-new-transaction', handler);
    return () => window.removeEventListener('open-new-transaction', handler);
  }, []);

  const notifications = [
    { id: 1, text: "Invoice #1048 paid by Acme Corp — $5,240.00", time: "2 min ago", unread: true },
    { id: 2, text: "AI flagged unusual AWS charge — $4,820 (3.2x average)", time: "1 hr ago", unread: true },
    { id: 3, text: "3 invoices overdue > 60 days — collection emails drafted", time: "3 hrs ago", unread: false },
    { id: 4, text: "Payroll processed — March cycle 2 ($24,800)", time: "1 day ago", unread: false },
  ];

  const handleCreateTx = () => {
    if (!txForm.vendor || !txForm.amount) {
      toast({ title: "Missing fields", description: "Vendor and amount are required.", variant: "destructive" });
      return;
    }
    toast({
      title: "Transaction recorded",
      description: `${txForm.type === "income" ? "+" : "-"}$${txForm.amount} from ${txForm.vendor} logged and auto-categorized by AI.`,
    });
    setShowNewTx(false);
    setTxForm({ vendor: "", amount: "", description: "", type: "expense" });
  };

  const handleLogout = () => {
    toast({ title: "Logged out", description: "You've been signed out of AI Accountants." });
    void signOut();
    navigate("/");
  };

  const roleBadge = (() => {
    switch (activeRole) {
      case "owner":
        return { label: "Owner", icon: Shield, className: "border-primary/30 bg-primary/10 text-primary" };
      case "accountant":
        return { label: "Accountant", icon: Briefcase, className: "border-success/30 bg-success/10 text-success" };
      case "bookkeeper":
        return { label: "Bookkeeper", icon: Users, className: "border-warning/30 bg-warning/10 text-warning" };
      case "read_only":
        return { label: "Read-only", icon: Eye, className: "border-border/60 bg-muted/40 text-muted-foreground" };
      default:
        return null;
    }
  })();

  const initials =
    (user?.user_metadata?.full_name ?? user?.email ?? "U")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card px-3 sm:px-6 shadow-sm gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onMenuToggle && (
            <button onClick={onMenuToggle} className="lg:hidden shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => (window as any).__openCommandPalette?.()}
            className="glass-subtle flex items-center gap-2 sm:gap-3 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground min-w-0 flex-1 sm:flex-initial"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Ask anything or search…</span>
            <span className="sm:hidden">Search…</span>
            <kbd className="ml-auto sm:ml-8 hidden sm:flex items-center gap-0.5 rounded-md border border-border/50 bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" /> K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {roleBadge && (
            <div
              className={`flex items-center gap-2 rounded-full border px-2.5 sm:px-3 py-1.5 text-xs font-medium ${roleBadge.className}`}
              title={`Role: ${roleBadge.label}${firm?.id ? " • Firm profile" : ""}`}
            >
              <roleBadge.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{roleBadge.label}</span>
              {firm?.id && <span className="rounded-full bg-background/40 px-2 py-0.5 text-[10px]">Firm</span>}
            </div>
          )}

          <Button
            size="sm"
            className="gap-2 rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={() => {
              if (isReadOnly) {
                toast({ title: "Read-only access", description: "You don't have permission to create transactions in this company.", variant: "destructive" });
                return;
              }
              setShowNewTx(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </Button>

          {/* Notifications */}
          <Popover open={showNotifications} onOpenChange={setShowNotifications}>
            <PopoverTrigger asChild>
              <button className="glass-subtle relative flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:border-primary/30">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="glass-card w-80 border-border/50 p-0" align="end">
              <div className="border-b border-border/30 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
              </div>
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-secondary/40 ${n.unread ? "bg-primary/5" : ""}`}>
                    {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{n.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground transition-all hover:opacity-90">
                {initials}
              </button>
            </PopoverTrigger>
            <PopoverContent className="glass-card w-56 border-border/50 p-2" align="end">
              <div className="border-b border-border/30 px-3 py-3 mb-1">
                <p className="text-sm font-semibold text-foreground">{user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roleBadge && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleBadge.className}`}>
                      <roleBadge.icon className="h-3 w-3" />
                      {roleBadge.label}
                    </span>
                  )}
                  {firm?.id && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Firm profile
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate("/settings")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Home className="h-4 w-4" /> Landing Page
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* New Transaction Dialog */}
      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setTxForm(p => ({ ...p, type: "expense" }))}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${txForm.type === "expense" ? "bg-accent/20 text-accent border border-accent/30" : "bg-secondary/40 text-muted-foreground border border-border/30"}`}
              >
                Expense
              </button>
              <button
                onClick={() => setTxForm(p => ({ ...p, type: "income" }))}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${txForm.type === "income" ? "bg-success/20 text-success border border-success/30" : "bg-secondary/40 text-muted-foreground border border-border/30"}`}
              >
                Income
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vendor / Source</label>
              <Input
                placeholder="e.g. Stripe, AWS, Acme Corp"
                value={txForm.vendor}
                onChange={e => setTxForm(p => ({ ...p, vendor: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Amount ($)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={txForm.amount}
                onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
              <Input
                placeholder="e.g. Cloud hosting - March"
                value={txForm.description}
                onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30"
              />
            </div>
            <Button onClick={handleCreateTx} className="w-full rounded-xl glow-primary">
              Record Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
