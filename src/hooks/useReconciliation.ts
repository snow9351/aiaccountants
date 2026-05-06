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

const MOCK_PERIODS: ReconciliationPeriod[] = [
  { id: 'rp-1', org_id: 'mock', bank_account_id: 'ba-1', period_start: '2024-03-01', period_end: '2024-03-31', opening_balance: 187500, closing_balance: 213400, statement_balance: 213400, difference: 0, status: 'locked', locked_at: '2024-04-05T10:00:00Z', completed_at: '2024-04-05T10:00:00Z', notes: null },
  { id: 'rp-2', org_id: 'mock', bank_account_id: 'ba-1', period_start: '2024-04-01', period_end: '2024-04-30', opening_balance: 213400, closing_balance: 240200, statement_balance: 241000, difference: -800, status: 'in_progress', locked_at: null, completed_at: null, notes: 'Investigating $800 discrepancy — likely uncleared check #1042' },
];

export function useReconciliationPeriods(orgId?: string, bankAccountId?: string) {
  return useQuery({
    queryKey: ['reconciliation_periods', orgId, bankAccountId],
    queryFn: async (): Promise<ReconciliationPeriod[]> => {
      if (!isSupabaseConfigured) return MOCK_PERIODS;
      let q = supabase.from('reconciliation_periods').select('*').eq('org_id', orgId!).order('period_end', { ascending: false });
      if (bankAccountId) q = q.eq('bank_account_id', bankAccountId);
      const { data, error } = await q;
      if (error) return MOCK_PERIODS;
      return data as ReconciliationPeriod[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_PERIODS,
  });
}

export function useCreateReconciliationPeriod() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ReconciliationPeriod> & { org_id: string }) => {
      if (!isSupabaseConfigured) return { ...input, id: crypto.randomUUID(), status: 'in_progress', difference: 0 } as ReconciliationPeriod;
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
      if (!isSupabaseConfigured) return;
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
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('reconciliation_periods').update(updates).eq('id', id).neq('status', 'locked');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation_periods'] }),
  });
}
