import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  ArrowLeftRight,
  Users,
  BarChart3,
  BookOpen,
  BookMarked,
  Building2,
  Target,
  FolderKanban,
  Calculator,
  TrendingUp,
  Repeat,
  Brain,
  Filter,
  Scale,
  CalendarCheck,
  UsersRound,
  CreditCard,
  Sparkles,
  Shield,
  Settings,
  Home,
} from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  hideForRoles?: Array<"bookkeeper" | "read_only">;
  showForRoles?: Array<"owner" | "accountant" | "bookkeeper" | "read_only">;
  visible?: (ctx: NavVisibilityContext) => boolean;
  /** Opens AI chat instead of navigating */
  action?: "ai-chat";
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export type NavVisibilityContext = {
  isOwner: boolean;
  isAccountant: boolean;
  isBookkeeper: boolean;
  isReadOnly: boolean;
  hasFirm: boolean;
};

/** Left sidebar only — AI tools live on the dashboard toolbar */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" }],
  },
  {
    id: "sales",
    label: "Get paid",
    items: [{ icon: FileText, label: "Invoices", path: "/invoices" }],
  },
  {
    id: "purchases",
    label: "Pay & spend",
    items: [
      { icon: ShoppingCart, label: "Vendor bills", path: "/bills" },
      { icon: Receipt, label: "Expenses", path: "/expenses" },
    ],
  },
  {
    id: "money",
    label: "Bank & activity",
    items: [
      { icon: Wallet, label: "Banking", path: "/banking" },
      { icon: ArrowLeftRight, label: "Transactions", path: "/transactions" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { icon: Users, label: "Contacts", path: "/contacts" },
      { icon: Building2, label: "Payroll", path: "/payroll", hideForRoles: ["read_only"] },
    ],
  },
  {
    id: "books",
    label: "Books & reports",
    items: [
      { icon: BarChart3, label: "Reports", path: "/reports" },
      { icon: BookOpen, label: "Chart of accounts", path: "/accounts" },
      { icon: BookMarked, label: "Journal entries", path: "/journal-entries" },
    ],
  },
  {
    id: "planning",
    label: "More",
    collapsible: true,
    defaultOpen: false,
    items: [
      { icon: Target, label: "Budgets", path: "/budgets", hideForRoles: ["bookkeeper", "read_only"] },
      { icon: FolderKanban, label: "Projects", path: "/projects", hideForRoles: ["bookkeeper", "read_only"] },
      { icon: Calculator, label: "Tax center", path: "/tax", hideForRoles: ["bookkeeper", "read_only"] },
      { icon: TrendingUp, label: "Revenue recognition", path: "/revenue-recognition", hideForRoles: ["bookkeeper", "read_only"] },
      { icon: Repeat, label: "Accruals", path: "/accruals", hideForRoles: ["bookkeeper", "read_only"] },
    ],
  },
];

/** Dashboard top bar — AI & close tools (not in sidebar) */
export const NAV_AI_ITEMS: NavItem[] = [
  { icon: Sparkles, label: "Ask AI", path: "#", action: "ai-chat" },
  { icon: Brain, label: "Categorization", path: "/categorization" },
  { icon: Filter, label: "Rules", path: "/categorization-rules" },
  { icon: Scale, label: "Reconciliation", path: "/reconciliation" },
  { icon: CalendarCheck, label: "Month-end close", path: "/month-end-close" },
  {
    icon: UsersRound,
    label: "Accountant portal",
    path: "/accountant-portal",
    visible: (ctx) => ctx.isAccountant || ctx.hasFirm,
  },
  {
    icon: CreditCard,
    label: "Plans",
    path: "/pricing",
    visible: (ctx) => ctx.isOwner || ctx.isAccountant,
  },
];

/** Sidebar footer group — collapsible */
export const NAV_UTILITY_SECTION: NavSection = {
  id: "utility",
  label: "System",
  collapsible: true,
  defaultOpen: false,
  items: [
    { icon: Sparkles, label: "AI insights", path: "/insights" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: Shield, label: "Audit log", path: "/audit" },
    { icon: Home, label: "Website", path: "/?public=1" },
  ],
};

export function filterNavItems(items: NavItem[], ctx: NavVisibilityContext): NavItem[] {
  return items.filter((item) => {
    if (item.visible && !item.visible(ctx)) return false;
    if (item.showForRoles && !item.showForRoles.some((r) => matchRole(ctx, r))) return false;
    if (item.hideForRoles?.includes("bookkeeper") && ctx.isBookkeeper) return false;
    if (item.hideForRoles?.includes("read_only") && ctx.isReadOnly) return false;
    return true;
  });
}

function matchRole(ctx: NavVisibilityContext, role: string): boolean {
  if (role === "owner") return ctx.isOwner;
  if (role === "accountant") return ctx.isAccountant;
  if (role === "bookkeeper") return ctx.isBookkeeper;
  if (role === "read_only") return ctx.isReadOnly;
  return false;
}

export function getVisibleSections(ctx: NavVisibilityContext): Array<NavSection & { items: NavItem[] }> {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: filterNavItems(section.items, ctx),
  })).filter((s) => s.items.length > 0);
}

export function getAiNavItems(ctx: NavVisibilityContext): NavItem[] {
  return filterNavItems(NAV_AI_ITEMS, ctx);
}

export function getUtilitySection(
  ctx: NavVisibilityContext,
): (NavSection & { items: NavItem[] }) | null {
  const items = filterNavItems(NAV_UTILITY_SECTION.items, ctx);
  if (items.length === 0) return null;
  return { ...NAV_UTILITY_SECTION, items };
}

export function getAllNavItems(ctx: NavVisibilityContext): NavItem[] {
  const main = getVisibleSections(ctx).flatMap((s) => s.items);
  const utility = getUtilitySection(ctx)?.items ?? [];
  return [...main, ...getAiNavItems(ctx), ...utility];
}
