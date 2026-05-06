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

const MOCK_ACCRUALS: Accrual[] = [
  { id: 'ac-1', org_id: 'mock', type: 'expense', description: 'March rent accrual', vendor_or_customer: 'Regus Office Space', amount: 4500, account_id: 'acc-rent', account_name: 'Rent Expense', period: '2024-03', frequency: 'monthly', status: 'posted', journal_entry_id: 'je-200', reversal_entry_id: 'je-201', auto_reverse: true, created_at: '2024-03-28T10:00:00Z', posted_at: '2024-03-31T23:59:59Z' },
  { id: 'ac-2', org_id: 'mock', type: 'expense', description: 'Legal retainer accrual', vendor_or_customer: 'Wilson & Associates', amount: 7500, account_id: 'acc-legal', account_name: 'Legal & Professional', period: '2024-03', frequency: 'monthly', status: 'posted', journal_entry_id: 'je-202', reversal_entry_id: null, auto_reverse: true, created_at: '2024-03-28T10:00:00Z', posted_at: '2024-03-31T23:59:59Z' },
  { id: 'ac-3', org_id: 'mock', type: 'revenue', description: 'Unbilled consulting hours', vendor_or_customer: 'Acme Corp', amount: 12000, account_id: 'acc-consulting', account_name: 'Consulting Revenue', period: '2024-03', frequency: 'one_time', status: 'posted', journal_entry_id: 'je-203', reversal_entry_id: null, auto_reverse: false, created_at: '2024-03-29T14:00:00Z', posted_at: '2024-03-31T23:59:59Z' },
  { id: 'ac-4', org_id: 'mock', type: 'expense', description: 'April rent accrual', vendor_or_customer: 'Regus Office Space', amount: 4500, account_id: 'acc-rent', account_name: 'Rent Expense', period: '2024-04', frequency: 'monthly', status: 'draft', journal_entry_id: null, reversal_entry_id: null, auto_reverse: true, created_at: '2024-04-01T10:00:00Z', posted_at: null },
  { id: 'ac-5', org_id: 'mock', type: 'expense', description: 'Q1 insurance premium', vendor_or_customer: 'Hartford Insurance', amount: 3200, account_id: 'acc-insurance', account_name: 'Insurance Expense', period: '2024-04', frequency: 'quarterly', status: 'draft', journal_entry_id: null, reversal_entry_id: null, auto_reverse: true, created_at: '2024-04-01T10:00:00Z', posted_at: null },
];

export function useAccruals(orgId?: string) {
  return useQuery({
    queryKey: ['accruals', orgId],
    queryFn: async (): Promise<Accrual[]> => {
      if (!isSupabaseConfigured) return MOCK_ACCRUALS;
      const { data, error } = await supabase.from('accruals').select('*').eq('org_id', orgId!).order('period', { ascending: false });
      if (error) return MOCK_ACCRUALS;
      return data as Accrual[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_ACCRUALS,
  });
}

export function useCreateAccrual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Accrual, 'id' | 'journal_entry_id' | 'reversal_entry_id' | 'created_at' | 'posted_at'>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), journal_entry_id: null, reversal_entry_id: null, created_at: new Date().toISOString(), posted_at: null } as Accrual;
      }
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
      if (!isSupabaseConfigured) return;
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
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('accruals').update({
        status: 'reversed',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accruals'] }),
  });
}
