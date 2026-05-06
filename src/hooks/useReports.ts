import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface PLData {
  period: string;
  revenue: number;
  expenses: number;
  net_income: number;
}

export interface ExpenseBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}

const MOCK_PL_DATA: PLData[] = [
  { period: 'Oct', revenue: 42000, expenses: 28000, net_income: 14000 },
  { period: 'Nov', revenue: 48000, expenses: 31000, net_income: 17000 },
  { period: 'Dec', revenue: 55000, expenses: 35000, net_income: 20000 },
  { period: 'Jan', revenue: 38000, expenses: 29000, net_income: 9000 },
  { period: 'Feb', revenue: 52000, expenses: 33000, net_income: 19000 },
  { period: 'Mar', revenue: 61000, expenses: 38000, net_income: 23000 },
];

const MOCK_EXPENSE_BREAKDOWN: ExpenseBreakdownItem[] = [
  { category: 'Payroll', amount: 22000, percentage: 42 },
  { category: 'Software & Subscriptions', amount: 8500, percentage: 16 },
  { category: 'Rent & Utilities', amount: 6200, percentage: 12 },
  { category: 'Marketing', amount: 5800, percentage: 11 },
  { category: 'Travel', amount: 4100, percentage: 8 },
  { category: 'Other', amount: 5800, percentage: 11 },
];

export function useProfitAndLoss(months = 6) {
  return useQuery({
    queryKey: ['pl_summary', months],
    queryFn: async (): Promise<PLData[]> => {
      if (!isSupabaseConfigured) return MOCK_PL_DATA;
      const { data, error } = await supabase
        .from('pl_summary' as never)
        .select('*')
        .order('period', { ascending: true })
        .limit(months);
      if (error) return MOCK_PL_DATA;
      return (data as PLData[]).map(row => ({
        period: new Date(row.period).toLocaleString('default', { month: 'short' }),
        revenue: row.revenue,
        expenses: row.expenses,
        net_income: row.net_income,
      }));
    },
    placeholderData: MOCK_PL_DATA,
  });
}

export function useExpenseBreakdown() {
  return useQuery({
    queryKey: ['expense_breakdown'],
    queryFn: async (): Promise<ExpenseBreakdownItem[]> => {
      if (!isSupabaseConfigured) return MOCK_EXPENSE_BREAKDOWN;
      const { data, error } = await supabase
        .from('expenses')
        .select('category, amount')
        .not('category', 'is', null);
      if (error) return MOCK_EXPENSE_BREAKDOWN;
      const totals: Record<string, number> = {};
      (data as { category: string; amount: number }[]).forEach(e => {
        totals[e.category] = (totals[e.category] ?? 0) + e.amount;
      });
      const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(totals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: Math.round((amount / grand) * 100),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);
    },
    placeholderData: MOCK_EXPENSE_BREAKDOWN,
  });
}

export function useCashFlow() {
  return useQuery({
    queryKey: ['cash_flow'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return MOCK_PL_DATA;
      return MOCK_PL_DATA;
    },
    placeholderData: MOCK_PL_DATA,
  });
}

export function useBalanceSheet() {
  return useQuery({
    queryKey: ['balance_sheet'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return {
        total_assets: 129420,
        total_liabilities: 42150,
        total_equity: 87270,
      };
      const { data, error } = await supabase
        .from('balance_sheet' as never)
        .select('*');
      if (error) return { total_assets: 0, total_liabilities: 0, total_equity: 0 };
      type BSRow = { type: string; balance: number };
      const rows = data as BSRow[];
      const total_assets = rows.filter(r => r.type === 'asset').reduce((s, r) => s + r.balance, 0);
      const total_liabilities = rows.filter(r => r.type === 'liability').reduce((s, r) => s + r.balance, 0);
      const total_equity = rows.filter(r => r.type === 'equity').reduce((s, r) => s + r.balance, 0);
      return { total_assets, total_liabilities, total_equity };
    },
  });
}
