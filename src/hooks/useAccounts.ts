import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Account } from '@/integrations/supabase/types';

export const MOCK_ACCOUNTS: Account[] = [
  { id: 'acc-1000', org_id: 'mock', account_number: '1000', name: 'Cash', type: 'asset', sub_type: 'current', parent_id: null, description: null, is_active: true, is_system: true, normal_balance: 'debit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-1010', org_id: 'mock', account_number: '1010', name: 'Checking Account', type: 'asset', sub_type: 'current', parent_id: 'acc-1000', description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-1100', org_id: 'mock', account_number: '1100', name: 'Accounts Receivable', type: 'asset', sub_type: 'current', parent_id: null, description: null, is_active: true, is_system: true, normal_balance: 'debit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-2000', org_id: 'mock', account_number: '2000', name: 'Accounts Payable', type: 'liability', sub_type: 'current', parent_id: null, description: null, is_active: true, is_system: true, normal_balance: 'credit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-3100', org_id: 'mock', account_number: '3100', name: 'Retained Earnings', type: 'equity', sub_type: null, parent_id: null, description: null, is_active: true, is_system: true, normal_balance: 'credit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-4000', org_id: 'mock', account_number: '4000', name: 'Revenue', type: 'revenue', sub_type: null, parent_id: null, description: null, is_active: true, is_system: true, normal_balance: 'credit', tax_category: 'Schedule C: Line 1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-4200', org_id: 'mock', account_number: '4200', name: 'Service Revenue', type: 'revenue', sub_type: null, parent_id: 'acc-4000', description: null, is_active: true, is_system: false, normal_balance: 'credit', tax_category: 'Schedule C: Line 1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-6000', org_id: 'mock', account_number: '6000', name: 'Operating Expenses', type: 'expense', sub_type: null, parent_id: null, description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-6100', org_id: 'mock', account_number: '6100', name: 'Payroll & Wages', type: 'expense', sub_type: null, parent_id: 'acc-6000', description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: 'Schedule C: Line 26', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-6200', org_id: 'mock', account_number: '6200', name: 'Rent & Utilities', type: 'expense', sub_type: null, parent_id: 'acc-6000', description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: 'Schedule C: Line 20', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-6400', org_id: 'mock', account_number: '6400', name: 'Software & Subscriptions', type: 'expense', sub_type: null, parent_id: 'acc-6000', description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: 'Schedule C: Line 22', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'acc-6500', org_id: 'mock', account_number: '6500', name: 'Travel & Entertainment', type: 'expense', sub_type: null, parent_id: 'acc-6000', description: null, is_active: true, is_system: false, normal_balance: 'debit', tax_category: 'Schedule C: Line 24', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

export function useChartOfAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<Account[]> => {
      if (!isSupabaseConfigured) return MOCK_ACCOUNTS;
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_number');
      if (error) return MOCK_ACCOUNTS;
      return data as Account[];
    },
    placeholderData: MOCK_ACCOUNTS,
  });
}

export function useAccountTree() {
  const { data: accounts = MOCK_ACCOUNTS } = useChartOfAccounts();
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
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Account;
      }
      const { data, error } = await supabase.from('accounts').insert(input as never).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
