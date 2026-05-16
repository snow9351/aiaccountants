import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ArrowLeftRight,
  BarChart3,
  Users,
  Wallet,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Zap,
  Receipt,
  Building2,
  Shield,
  Home,
  LogOut,
  Plus,
  BookOpen,
  ShoppingCart,
  BookMarked,
  Target,
  FolderKanban,
  Calculator,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { useMyFirm } from "@/hooks/useFirm";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ArrowLeftRight, label: "Transactions", path: "/transactions" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Users, label: "Contacts", path: "/contacts" },
  { icon: Wallet, label: "Banking", path: "/banking" },
  { icon: Building2, label: "Payroll", path: "/payroll" },
];

const accountingItems = [
  { icon: BookOpen, label: "Chart of Accounts", path: "/accounts" },
  { icon: BookMarked, label: "Journal Entries", path: "/journal-entries" },
  { icon: ShoppingCart, label: "Bills", path: "/bills" },
];

const advancedItems = [
  { icon: Target, label: "Budgets", path: "/budgets" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Calculator, label: "Tax Center", path: "/tax" },
  { icon: TrendingUp, label: "Revenue Recognition", path: "/revenue-recognition" },
  { icon: Repeat, label: "Accruals", path: "/accruals" },
];

import { Brain, Scale, CreditCard, CalendarCheck, Filter, TrendingUp, Repeat, UsersRound } from "lucide-react";

const aiItems = [
  { icon: Brain, label: "AI Categorization", path: "/categorization" },
  { icon: Filter, label: "Categorization Rules", path: "/categorization-rules" },
  { icon: Scale, label: "Reconciliation", path: "/reconciliation" },
  { icon: CalendarCheck, label: "Month-End Close", path: "/month-end-close" },
  { icon: UsersRound, label: "Accountant Portal", path: "/accountant-portal" },
  { icon: CreditCard, label: "Pricing & Plans", path: "/pricing" },
];

const bottomItems = [
  { icon: Sparkles, label: "AI Insights", path: "/insights" },
  { icon: Shield, label: "Audit Log", path: "/audit" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: companies = [] } = useCompanies();
  const { activeOrgId } = useCompanyStore();
  const { data: firm } = useMyFirm();

  const activeCompany = companies.find((c) => c.id === activeOrgId) ?? companies[0];
  const activeRole = activeCompany?.role as string | undefined;
  const isOwner = activeRole === "owner";
  const isAccountant = activeRole === "accountant";
  const isBookkeeper = activeRole === "bookkeeper";
  const isReadOnly = activeRole === "read_only";
  const hasFirm = !!firm?.id;

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "You've been signed out of AI Accountants." });
    navigate("/login", { replace: true });
  };

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const displayEmail = user?.email ?? '';

  const renderNavItem = (item: { icon: React.ElementType; label: string; path: string }) => {
    const isActive = location.pathname === item.path;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => onClose?.()}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "glass-card text-primary glow-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")} />
        {!collapsed && <span className="animate-fade-in">{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]",
        "max-lg:translate-x-[-100%]",
        mobileOpen && "max-lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <NavLink to="/" className="flex h-16 items-center gap-3 border-b border-border/50 px-4 transition-colors hover:bg-sidebar-accent/50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 glow-primary">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-display text-base font-bold text-foreground">AI Accountants</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-primary">AI</p>
          </div>
        )}
      </NavLink>

      {/* Company switcher */}
      <div className="px-3 pt-3 pb-0">
        <CompanySwitcher collapsed={collapsed} />
      </div>

      {/* New Transaction quick button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => {
            if (isReadOnly) {
              toast({ title: "Read-only access", description: "You don't have permission to create transactions in this company.", variant: "destructive" });
              return;
            }
            const event = new CustomEvent('open-new-transaction');
            window.dispatchEvent(event);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 glow-primary",
            collapsed && "justify-center",
            isReadOnly && "opacity-60"
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="animate-fade-in">New Transaction</span>}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin">
        {navItems.map(renderNavItem)}

        {/* Accounting section */}
        {!collapsed && (
          <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Accounting
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-border/30" />}
        {accountingItems.map(renderNavItem)}

        {/* Advanced section */}
        {!collapsed && (
          <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Advanced
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-border/30" />}
        {/* Bookkeepers/read-only should not see advanced/admin-heavy features by default */}
        {!isBookkeeper && !isReadOnly && advancedItems.map(renderNavItem)}

        {/* AI & Billing section */}
        {!collapsed && (
          <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            AI & Billing
          </p>
        )}
        {collapsed && <div className="my-2 border-t border-border/30" />}
        {aiItems
          .filter((item) => {
            if (item.path === "/accountant-portal") return isAccountant || hasFirm;
            if (item.path === "/pricing") return isOwner || isAccountant;
            return true;
          })
          .map(renderNavItem)}
      </nav>

      {/* Bottom nav */}
      <div className="space-y-0.5 border-t border-border/50 px-3 py-3">
        {bottomItems.map(renderNavItem)}

        <button
          onClick={() => navigate("/")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground"
        >
          <Home className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="animate-fade-in">Home</span>}
        </button>

        {/* User info */}
        {!collapsed && (
          <div className="mt-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/70 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="animate-fade-in">Log out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-border/50 text-muted-foreground transition-colors hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
