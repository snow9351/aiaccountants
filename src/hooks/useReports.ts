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

export function useProfitAndLoss(months = 6) {
  return useQuery({
    queryKey: ['pl_summary', months],
    queryFn: async (): Promise<PLData[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('pl_summary' as never)
        .select('*')
        .order('period', { ascending: true })
        .limit(months);
      if (error) throw error;
      return (data as PLData[]).map(row => ({
        period: new Date(row.period).toLocaleString('default', { month: 'short' }),
        revenue: row.revenue,
        expenses: row.expenses,
        net_income: row.net_income,
      }));
    },
  });
}

export function useExpenseBreakdown() {
  return useQuery({
    queryKey: ['expense_breakdown'],
    queryFn: async (): Promise<ExpenseBreakdownItem[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('category, amount')
        .not('category', 'is', null);
      if (error) throw error;
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
  });
}

export function useCashFlow() {
  return useQuery({
    queryKey: ['cash_flow'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return [];
      // TODO: replace with real cashflow view/query when available.
      return [];
    },
  });
}

export function useBalanceSheet() {
  return useQuery({
    queryKey: ['balance_sheet'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return { total_assets: 0, total_liabilities: 0, total_equity: 0 };
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
