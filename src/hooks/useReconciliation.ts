import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReconciliationPeriod {
  id: string;
  org_id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  statement_balance: number;
  difference: number;
  status: 'in_progress' | 'completed' | 'locked';
  locked_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export function useReconciliationPeriods(orgId?: string, bankAccountId?: string) {
  return useQuery({
    queryKey: ['reconciliation_periods', orgId, bankAccountId],
    queryFn: async (): Promise<ReconciliationPeriod[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('reconciliation_periods').select('*').eq('org_id', orgId!).order('period_end', { ascending: false });
      if (bankAccountId) q = q.eq('bank_account_id', bankAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ReconciliationPeriod[];
    },
    enabled: !!orgId,
  });
}

export function useCreateReconciliationPeriod() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ReconciliationPeriod> & { org_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('reconciliation_periods').insert({ ...input, created_by: user?.id }).select().single();
      if (error) throw error;
      return data as ReconciliationPeriod;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation_periods'] }),
  });
}

export function useLockReconciliation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('reconciliation_periods').update({
        status: 'locked',
        locked_by: user?.id,
        locked_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        notes,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation_periods'] }),
  });
}

export function useUpdateReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReconciliationPeriod> & { id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('reconciliation_periods').update(updates).eq('id', id).neq('status', 'locked');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation_periods'] }),
  });
}
