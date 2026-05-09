import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Account } from '@/integrations/supabase/types';

export function useChartOfAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<Account[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_number');
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useAccountTree() {
  const { data: accounts = [] } = useChartOfAccounts();
  const byType: Record<string, Account[]> = {};
  for (const acc of accounts) {
    if (!byType[acc.type]) byType[acc.type] = [];
    byType[acc.type].push(acc);
  }
  return byType;
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Account>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('accounts').insert(input as never).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
