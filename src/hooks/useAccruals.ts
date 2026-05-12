import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface Accrual {
  id: string;
  org_id: string;
  type: 'expense' | 'revenue';
  description: string;
  vendor_or_customer: string;
  amount: number;
  account_id: string;
  account_name: string;
  period: string; // e.g. "2024-03"
  frequency: 'one_time' | 'monthly' | 'quarterly';
  status: 'draft' | 'posted' | 'reversed';
  journal_entry_id: string | null;
  reversal_entry_id: string | null;
  auto_reverse: boolean;
  created_at: string;
  posted_at: string | null;
}

export function useAccruals(orgId?: string) {
  return useQuery({
    queryKey: ['accruals', orgId],
    queryFn: async (): Promise<Accrual[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase.from('accruals').select('*').eq('org_id', orgId!).order('period', { ascending: false });
      if (error) throw error;
      return data as Accrual[];
    },
    enabled: !!orgId,
  });
}

export function useCreateAccrual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Accrual, 'id' | 'journal_entry_id' | 'reversal_entry_id' | 'created_at' | 'posted_at'>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('accruals').insert(input).select().single();
      if (error) throw error;
      return data as Accrual;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accruals'] }),
  });
}

export function usePostAccrual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('accruals').update({
        status: 'posted',
        posted_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accruals'] }),
  });
}

export function useReverseAccrual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('accruals').update({
        status: 'reversed',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accruals'] }),
  });
}
