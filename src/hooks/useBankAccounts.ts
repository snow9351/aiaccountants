import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { BankAccount, BankTransaction } from '@/integrations/supabase/types';

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async (): Promise<BankAccount[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('is_active', true).order('account_name');
      if (error) throw error;
      return data as BankAccount[];
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BankAccount>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('bank_accounts').insert(input as never).select().single();
      if (error) throw error;
      return data as BankAccount;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  });
}

export function useReconciliationQueue() {
  return useQuery({
    queryKey: ['reconciliation_queue'],
    queryFn: async (): Promise<BankTransaction[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('is_matched', false)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as BankTransaction[];
    },
  });
}
