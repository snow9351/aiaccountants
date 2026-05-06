import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { BankAccount, BankTransaction } from '@/integrations/supabase/types';

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'acct-1', org_id: 'mock', account_name: 'Business Checking',
    account_number_masked: '****4521', bank_name: 'Chase Bank',
    account_type: 'checking', currency: 'USD', current_balance: 87420,
    gl_account_id: null, plaid_account_id: null,
    last_sync_at: new Date().toISOString(), sync_status: 'synced',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString(),
  },
  {
    id: 'acct-2', org_id: 'mock', account_name: 'Business Savings',
    account_number_masked: '****8834', bank_name: 'Chase Bank',
    account_type: 'savings', currency: 'USD', current_balance: 42000,
    gl_account_id: null, plaid_account_id: null,
    last_sync_at: new Date().toISOString(), sync_status: 'synced',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString(),
  },
  {
    id: 'acct-3', org_id: 'mock', account_name: 'Amex Business Card',
    account_number_masked: '****2009', bank_name: 'American Express',
    account_type: 'credit', currency: 'USD', current_balance: -4892,
    gl_account_id: null, plaid_account_id: null,
    last_sync_at: new Date().toISOString(), sync_status: 'synced',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString(),
  },
];

export const MOCK_RECONCILIATION_QUEUE: BankTransaction[] = [
  {
    id: 'r1', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-04-01', description: 'Acme Corp — Invoice 001',
    amount: 12400, type: 'income', category: 'Revenue',
    merchant: 'Acme Corp', balance_after: null, external_id: null,
    is_matched: false, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.95, ai_suggested_category: 'Revenue', is_pending: false,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'r2', org_id: 'mock', bank_account_id: 'acct-1',
    date: '2024-03-28', description: 'Unknown vendor #4829',
    amount: -385, type: 'expense', category: null,
    merchant: null, balance_after: null, external_id: null,
    is_matched: false, is_reconciled: false, matched_journal_entry_line_id: null,
    ai_confidence: 0.54, ai_suggested_category: null, is_pending: false,
    created_at: '2024-03-28T00:00:00Z', updated_at: '2024-03-28T00:00:00Z',
  },
];

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async (): Promise<BankAccount[]> => {
      if (!isSupabaseConfigured) return MOCK_BANK_ACCOUNTS;
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('is_active', true).order('account_name');
      if (error) return MOCK_BANK_ACCOUNTS;
      return data as BankAccount[];
    },
    placeholderData: MOCK_BANK_ACCOUNTS,
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BankAccount>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as BankAccount;
      }
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
      if (!isSupabaseConfigured) return MOCK_RECONCILIATION_QUEUE;
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('is_matched', false)
        .order('date', { ascending: false })
        .limit(50);
      if (error) return MOCK_RECONCILIATION_QUEUE;
      return data as BankTransaction[];
    },
    placeholderData: MOCK_RECONCILIATION_QUEUE,
  });
}
