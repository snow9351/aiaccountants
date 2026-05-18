import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { useMyFirm } from "@/hooks/useFirm";
import {
  getVisibleSections,
  getUtilitySection,
  NAV_UTILITY_SECTION,
  type NavItem,
  type NavSection,
  type NavVisibilityContext,
} from "@/config/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function useNavContext(): NavVisibilityContext {
  const { data: companies = [] } = useCompanies();
  const { activeOrgId } = useCompanyStore();
  const activeCompany = companies.find((c) => c.id === activeOrgId) ?? companies[0];
  const role = activeCompany?.role as string | undefined;
  return {
    isOwner: role === "owner",
    isAccountant: role === "accountant",
    isBookkeeper: role === "bookkeeper",
    isReadOnly: role === "read_only",
    hasFirm: false,
  };
}

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const seedCtx = { isOwner: true, isAccountant: true, isBookkeeper: false, isReadOnly: false, hasFirm: false };
    for (const s of getVisibleSections(seedCtx)) {
      if (s.collapsible) initial[s.id] = s.defaultOpen ?? false;
    }
    if (NAV_UTILITY_SECTION.collapsible) {
      initial[NAV_UTILITY_SECTION.id] = NAV_UTILITY_SECTION.defaultOpen ?? false;
    }
    return initial;
  });

  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: firm } = useMyFirm();
  const baseCtx = useNavContext();
  const ctx: NavVisibilityContext = { ...baseCtx, hasFirm: !!firm?.id };
  const sections = getVisibleSections(ctx);
  const utilitySection = getUtilitySection(ctx);
  const systemOpen = openSections[NAV_UTILITY_SECTION.id] ?? NAV_UTILITY_SECTION.defaultOpen ?? false;
  const systemActive = utilitySection?.items.some((i) => location.pathname === i.path) ?? false;

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logged out", description: "You've been signed out of AI Accountants." });
    navigate("/login", { replace: true });
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => onClose?.()}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary/10 text-primary font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")} />
        {!collapsed && <span className="animate-fade-in">{item.label}</span>}
      </NavLink>
    );
  };

  const renderSection = (section: NavSection & { items: NavItem[] }) => {
    const body = <div className="space-y-0.5">{section.items.map(renderNavItem)}</div>;

    if (!section.collapsible || collapsed) {
      return (
        <div key={section.id} className="space-y-0.5">
          {!collapsed && section.items.length > 0 && (
            <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 first:mt-1">
              {section.label}
            </p>
          )}
          {collapsed && section.id !== "overview" && <div className="my-2 border-t border-border/30" />}
          {body}
        </div>
      );
    }

    const isOpen = openSections[section.id] ?? section.defaultOpen ?? false;
    const sectionActive = section.items.some((i) => location.pathname === i.path);

    return (
      <Collapsible
        key={section.id}
        open={isOpen}
        onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, [section.id]: open }))}
      >
        <CollapsibleTrigger className="mt-4 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 hover:bg-secondary/50 first:mt-1">
          <span className={cn(sectionActive && "text-primary")}>{section.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pt-0.5">{section.items.map(renderNavItem)}</CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]",
        "max-lg:translate-x-[-100%]",
        mobileOpen && "max-lg:translate-x-0",
      )}
    >
      <NavLink
        to="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-border/50 px-4 transition-colors hover:bg-sidebar-accent/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-display text-base font-bold text-foreground">AI Accountants</h1>
          </div>
        )}
      </NavLink>

      <div className="px-3 pt-3">
        <CompanySwitcher collapsed={collapsed} />
      </div>

      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => {
            if (ctx.isReadOnly) {
              toast({
                title: "Read-only access",
                description: "You can't create transactions in this company.",
                variant: "destructive",
              });
              return;
            }
            window.dispatchEvent(new CustomEvent("open-new-transaction"));
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90",
            collapsed && "justify-center",
            ctx.isReadOnly && "opacity-60",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Quick entry</span>}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin">
        {sections.map(renderSection)}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border/50 px-3 py-3">
        {utilitySection && (
          <Collapsible
            open={systemOpen}
            onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, [NAV_UTILITY_SECTION.id]: open }))}
          >
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 transition-colors hover:bg-secondary/50",
                collapsed ? "justify-center" : "justify-between gap-2",
                systemActive && "text-primary",
              )}
              title={collapsed ? "System" : undefined}
            >
              {!collapsed && <span>System</span>}
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 transition-transform", systemOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-0.5">
              {utilitySection.items.map(renderNavItem)}
            </CollapsibleContent>
          </Collapsible>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/70 transition-all hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? "Log out" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-border/50 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
