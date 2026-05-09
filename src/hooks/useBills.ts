import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Bill } from '@/integrations/supabase/types';

export function useBills(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['bills', filters],
    queryFn: async (): Promise<Bill[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('bills').select('*').order('due_date', { ascending: true });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}

export function useUpdateBillStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Bill['status'] }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('bills').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}
