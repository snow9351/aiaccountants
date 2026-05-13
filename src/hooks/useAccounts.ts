import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Account } from '@/integrations/supabase/types';

export function useChartOfAccounts(orgId?: string, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['accounts', orgId, options?.includeInactive ?? false],
    queryFn: async (): Promise<Account[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      let q = supabase.from('accounts').select('*').eq('org_id', orgId);
      if (!options?.includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('account_number', { ascending: true, nullsFirst: true })
        .order('name');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!orgId,
  });
}

export function useAccountTree(orgId?: string, options?: { includeInactive?: boolean }) {
  const { data: accounts = [] } = useChartOfAccounts(orgId, options);
  const byType: Record<string, Account[]> = {};
  for (const acc of accounts) {
    if (!byType[acc.type]) byType[acc.type] = [];
    byType[acc.type].push(acc);
  }
  return byType;
}

function invalidateAccountsQueries(qc: ReturnType<typeof useQueryClient>, orgId?: string) {
  qc.invalidateQueries({ queryKey: ['accounts'] });
  if (orgId) qc.invalidateQueries({ queryKey: ['accounts', orgId] });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Account> & { org_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('accounts').insert(input as never).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: (_data, variables) => invalidateAccountsQueries(qc, variables.org_id),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Account> & { id: string; org_id?: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { id, org_id: _o, ...patch } = input;
      const { data, error } = await supabase.from('accounts').update(patch as never).eq('id', id).select().single();
      if (error) throw error;
      return data as Account;
    },
    onSuccess: (_data, variables) => invalidateAccountsQueries(qc, variables.org_id),
  });
}

export function useMergeAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { orgId: string; fromAccountId: string; toAccountId: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.rpc('merge_accounts', {
        p_org_id: args.orgId,
        p_from_account_id: args.fromAccountId,
        p_to_account_id: args.toAccountId,
      });
      if (error) throw error;
    },
    onSuccess: (_void, args) => invalidateAccountsQueries(qc, args.orgId),
  });
}
