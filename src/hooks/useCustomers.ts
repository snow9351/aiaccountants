import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Customer } from '@/integrations/supabase/types';

/** Pass `{ orgId }` from `useOrgId()` so customers match the active company (invited accountants, multi-org owners). */
export function useCustomers(filters?: { orgId?: string }) {
  const orgId = filters?.orgId;
  const scoped = filters !== undefined;
  return useQuery({
    queryKey: ['customers', scoped ? orgId ?? '' : 'all'],
    enabled: !scoped || !!orgId,
    queryFn: async (): Promise<Customer[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('customers').select('*').eq('is_active', true).order('name');
      if (orgId) q = q.eq('org_id', orgId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Customer>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('customers').insert(input as Customer['org_id'] extends string ? typeof input : never).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
