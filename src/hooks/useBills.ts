import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Bill } from '@/integrations/supabase/types';

export function useBills(orgId?: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['bills', orgId ?? '', filters],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Bill[]> => {
      if (!orgId) return [];
      let q = supabase.from('bills').select('*').eq('org_id', orgId).order('due_date', { ascending: true });
      if (filters?.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as Bill[];
    },
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Bill>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('bills').insert(input as never).select().single();
      if (error) throw error;
      return data as Bill;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bills', data.org_id] });
    },
  });
}

export function useUpdateBillStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, org_id }: { id: string; status: Bill['status']; org_id?: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('bills').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status, org_id };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['bills', vars.org_id ?? ''] });
    },
  });
}

/** Records a bill_payment row and marks the bill paid (updates 1099 YTD via DB trigger). */
export function useMarkBillPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      paymentDate,
      amount,
    }: {
      billId: string;
      orgId: string;
      paymentDate?: string;
      amount?: number;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('record_bill_payment', {
        p_bill_id: billId,
        p_payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
        p_amount: amount ?? null,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['bills', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['contacts', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['vendors', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['vendors_1099_threshold', vars.orgId] });
    },
  });
}
