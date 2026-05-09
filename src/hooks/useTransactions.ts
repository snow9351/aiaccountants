import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { BankTransaction } from '@/integrations/supabase/types';

export function useTransactions(filters?: { limit?: number; type?: string; is_matched?: boolean; orgId?: string }) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async (): Promise<BankTransaction[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('bank_transactions').select('*').order('date', { ascending: false });
      if (filters?.orgId) q = q.eq('org_id', filters.orgId);
      if (filters?.type) q = q.eq('type', filters.type);
      if (filters?.is_matched !== undefined) q = q.eq('is_matched', filters.is_matched);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as BankTransaction[];
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BankTransaction>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('bank_transactions').insert(input as never).select().single();
      if (error) throw error;
      return data as BankTransaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard_kpis'] });
      qc.invalidateQueries({ queryKey: ['cashflow_chart'] });
    },
  });
}

export function useMatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_matched, category, account_id }: { id: string; is_matched: boolean; category?: string; account_id?: string | null }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const payload: Record<string, unknown> = { is_matched, category: category ?? null };
      if (account_id !== undefined) payload.account_id = account_id;
      const { error } = await supabase.from('bank_transactions').update(payload as never).eq('id', id);
      if (error) throw error;
      return { id, is_matched, category };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
