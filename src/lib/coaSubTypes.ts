import type { Account } from "@/integrations/supabase/types";

/** Feature 4 canonical COA sub-types (must match DB CHECK on `accounts.sub_type`). */
export const COA_SUB_TYPES_BY_TYPE = {
  asset: ["bank", "accounts_receivable", "other_current_asset", "fixed_asset", "other_asset"],
  liability: ["accounts_payable", "credit_card", "other_current_liability", "long_term_liability"],
  equity: [
    "owner_equity",
    "retained_earnings",
    "opening_balance_equity",
    "capital_stock",
    "additional_paid_in_capital",
    "distributions",
  ],
  revenue: ["sales", "other_income", "uncategorized_income"],
  expense: ["cogs", "payroll", "rent", "utilities", "other_expense", "uncategorized_expense"],
} as const;

export type CoaSubType =
  | (typeof COA_SUB_TYPES_BY_TYPE.asset)[number]
  | (typeof COA_SUB_TYPES_BY_TYPE.liability)[number]
  | (typeof COA_SUB_TYPES_BY_TYPE.equity)[number]
  | (typeof COA_SUB_TYPES_BY_TYPE.revenue)[number]
  | (typeof COA_SUB_TYPES_BY_TYPE.expense)[number];

export const COA_SUB_TYPE_LABELS: Record<CoaSubType, string> = {
  bank: "Bank",
  accounts_receivable: "Accounts Receivable",
  other_current_asset: "Other Current Asset",
  fixed_asset: "Fixed Asset",
  other_asset: "Other Asset",
  accounts_payable: "Accounts Payable",
  credit_card: "Credit Card",
  other_current_liability: "Other Current Liability",
  long_term_liability: "Long-term Liability",
  owner_equity: "Owner Equity",
  retained_earnings: "Retained Earnings",
  opening_balance_equity: "Opening Balance Equity",
  capital_stock: "Capital Stock",
  additional_paid_in_capital: "Additional Paid-In Capital",
  distributions: "Distributions / Dividends",
  sales: "Sales",
  other_income: "Other Income",
  uncategorized_income: "Uncategorized Income",
  cogs: "COGS",
  payroll: "Payroll",
  rent: "Rent",
  utilities: "Utilities",
  other_expense: "Other Expense",
  uncategorized_expense: "Uncategorized Expense",
};

export function coaSubTypesForAccountType(type: Account["type"]): readonly CoaSubType[] {
  return COA_SUB_TYPES_BY_TYPE[type];
}

export function labelCoaSubType(sub: string | null | undefined): string {
  if (!sub) return "—";
  return COA_SUB_TYPE_LABELS[sub as CoaSubType] ?? sub.replace(/_/g, " ");
}

export function formatAccountLabel(a: Pick<Account, "account_number" | "name">): string {
  const n = a.account_number?.trim();
  return n ? `${n} — ${a.name}` : a.name;
}
