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

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async (): Promise<Budget[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('budgets').select('*').order('fiscal_year', { ascending: false });
      if (error) throw error;
      return data as Budget[];
    },
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Budget>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
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
      if (!isSupabaseConfigured) return [];
      // TODO: replace with real budget vs actuals query when available.
      return [];
    },
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
