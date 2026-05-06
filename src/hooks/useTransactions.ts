import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { BankTransaction } from '@/integrations/supabase/types';

export const MOCK_TRANSACTIONS: BankTransaction[] = [
  {
    id: '1', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-04-01', description: 'Acme Corp — Invoice payment',
    amount: 12400, type: 'income', category: 'Revenue',
    merchant: 'Acme Corp', balance_after: 87400, external_id: null,
    is_matched: true, is_reconciled: true, matched_journal_entry_line_id: null,
    ai_confidence: 0.98, ai_suggested_category: 'Revenue', is_pending: false,
    created_at: '2024-04-01T10:00:00Z', updated_at: '2024-04-01T10:00:00Z',
  },
  {
    id: '2', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-04-01', description: 'AWS — Monthly infrastructure',
    amount: -2840, type: 'expense', category: 'Software & Subscriptions',
    merchant: 'Amazon Web Services', balance_after: 84560, external_id: null,
    is_matched: true, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.97, ai_suggested_category: 'Software & Subscriptions', is_pending: false,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: '3', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-31', description: 'WeWork — Office space March',
    amount: -1800, type: 'expense', category: 'Rent & Utilities',
    merchant: 'WeWork', balance_after: 87400, external_id: null,
    is_matched: true, is_reconciled: true, matched_journal_entry_line_id: null,
    ai_confidence: 0.99, ai_suggested_category: 'Rent & Utilities', is_pending: false,
    created_at: '2024-03-31T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
  },
  {
    id: '4', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-29', description: 'TechFlow Solutions — partial payment',
    amount: 4375, type: 'income', category: 'Revenue',
    merchant: 'TechFlow Solutions', balance_after: 89200, external_id: null,
    is_matched: false, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.85, ai_suggested_category: 'Revenue', is_pending: false,
    created_at: '2024-03-29T00:00:00Z', updated_at: '2024-03-29T00:00:00Z',
  },
  {
    id: '5', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-28', description: 'Unknown charge #48291',
    amount: -385, type: 'expense', category: null,
    merchant: null, balance_after: 84825, external_id: null,
    is_matched: false, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.52, ai_suggested_category: 'Other Expenses', is_pending: false,
    created_at: '2024-03-28T00:00:00Z', updated_at: '2024-03-28T00:00:00Z',
  },
  {
    id: '6', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-25', description: 'Delta Airlines — business travel',
    amount: -1240, type: 'expense', category: 'Travel & Entertainment',
    merchant: 'Delta Air Lines', balance_after: 85210, external_id: null,
    is_matched: true, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.91, ai_suggested_category: 'Travel & Entertainment', is_pending: false,
    created_at: '2024-03-25T00:00:00Z', updated_at: '2024-03-25T00:00:00Z',
  },
  {
    id: '7', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-22', description: 'Meridian Partners — Invoice 003',
    amount: 24600, type: 'income', category: 'Revenue',
    merchant: 'Meridian Partners', balance_after: 86450, external_id: null,
    is_matched: true, is_reconciled: true, matched_journal_entry_line_id: null,
    ai_confidence: 0.99, ai_suggested_category: 'Revenue', is_pending: false,
    created_at: '2024-03-22T00:00:00Z', updated_at: '2024-03-22T00:00:00Z',
  },
  {
    id: '8', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-20', description: 'Stripe — payment processing',
    amount: -892, type: 'expense', category: 'Professional Services',
    merchant: 'Stripe', balance_after: 61850, external_id: null,
    is_matched: true, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.95, ai_suggested_category: 'Professional Services', is_pending: false,
    created_at: '2024-03-20T00:00:00Z', updated_at: '2024-03-20T00:00:00Z',
  },
];

export function useTransactions(filters?: { limit?: number; type?: string; is_matched?: boolean }) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async (): Promise<BankTransaction[]> => {
      if (!isSupabaseConfigured) {
        let results = MOCK_TRANSACTIONS;
        if (filters?.type) results = results.filter(t => t.type === filters.type);
        if (filters?.is_matched !== undefined) results = results.filter(t => t.is_matched === filters.is_matched);
        if (filters?.limit) results = results.slice(0, filters.limit);
        return results;
      }
      let q = supabase.from('bank_transactions').select('*').order('date', { ascending: false });
      if (filters?.type) q = q.eq('type', filters.type);
      if (filters?.is_matched !== undefined) q = q.eq('is_matched', filters.is_matched);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) return MOCK_TRANSACTIONS;
      return data as BankTransaction[];
    },
    placeholderData: MOCK_TRANSACTIONS,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BankTransaction>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as BankTransaction;
      }
      const { data, error } = await supabase.from('bank_transactions').insert(input as never).select().single();
      if (error) throw error;
      return data as BankTransaction;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useMatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_matched, category, account_id }: { id: string; is_matched: boolean; category?: string; account_id?: string | null }) => {
      if (!isSupabaseConfigured) return { id, is_matched, category };
      const payload: Record<string, unknown> = { is_matched, category: category ?? null };
      if (account_id !== undefined) payload.account_id = account_id;
      const { error } = await supabase.from('bank_transactions').update(payload as never).eq('id', id);
      if (error) throw error;
      return { id, is_matched, category };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
