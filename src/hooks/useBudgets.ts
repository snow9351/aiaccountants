import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Budget, BudgetLine } from '@/integrations/supabase/types';

export interface BudgetVsActual {
  account_id: string;
  account_name: string;
  account_type: string;
  period_label: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
}

export const MOCK_BUDGETS: Budget[] = [
  {
    id: 'bud-1', org_id: 'mock', name: 'FY2024 Operating Budget',
    fiscal_year: 2024, period_type: 'monthly', scenario: 'expected',
    status: 'active', created_by: null, approved_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
];

export const MOCK_BUDGET_VS_ACTUALS: BudgetVsActual[] = [
  { account_id: 'a1', account_name: 'Revenue', account_type: 'revenue', period_label: 'Q1 2024', budgeted: 150000, actual: 161000, variance: 11000, variance_pct: 7.3 },
  { account_id: 'a2', account_name: 'Payroll & Wages', account_type: 'expense', period_label: 'Q1 2024', budgeted: 110000, actual: 112250, variance: -2250, variance_pct: -2.0 },
  { account_id: 'a3', account_name: 'Software & Subscriptions', account_type: 'expense', period_label: 'Q1 2024', budgeted: 22000, actual: 25500, variance: -3500, variance_pct: -15.9 },
  { account_id: 'a4', account_name: 'Rent & Utilities', account_type: 'expense', period_label: 'Q1 2024', budgeted: 18000, actual: 18600, variance: -600, variance_pct: -3.3 },
  { account_id: 'a5', account_name: 'Marketing & Advertising', account_type: 'expense', period_label: 'Q1 2024', budgeted: 15000, actual: 11200, variance: 3800, variance_pct: 25.3 },
  { account_id: 'a6', account_name: 'Travel & Entertainment', account_type: 'expense', period_label: 'Q1 2024', budgeted: 12000, actual: 14800, variance: -2800, variance_pct: -23.3 },
];

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async (): Promise<Budget[]> => {
      if (!isSupabaseConfigured) return MOCK_BUDGETS;
      const { data, error } = await supabase.from('budgets').select('*').order('fiscal_year', { ascending: false });
      if (error) return MOCK_BUDGETS;
      return data as Budget[];
    },
    placeholderData: MOCK_BUDGETS,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Budget>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Budget;
      }
      const { data, error } = await supabase.from('budgets').insert(input as never).select().single();
      if (error) throw error;
      return data as Budget;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useBudgetVsActuals(budgetId?: string) {
  return useQuery({
    queryKey: ['budget_vs_actuals', budgetId],
    queryFn: async (): Promise<BudgetVsActual[]> => {
      if (!isSupabaseConfigured) return MOCK_BUDGET_VS_ACTUALS;
      // In production this would join budget_lines + journal_entry_lines aggregated
      return MOCK_BUDGET_VS_ACTUALS;
    },
    placeholderData: MOCK_BUDGET_VS_ACTUALS,
  });
}

export function useBudgetLines(budgetId: string) {
  return useQuery({
    queryKey: ['budget_lines', budgetId],
    queryFn: async (): Promise<BudgetLine[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('budget_lines')
        .select('*')
        .eq('budget_id', budgetId);
      if (error) return [];
      return data as BudgetLine[];
    },
  });
}
