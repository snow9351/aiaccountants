import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Invoice } from '@/integrations/supabase/types';

export function useInvoices(filters?: { status?: string; customer_id?: string }) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async (): Promise<Invoice[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('invoices').select('*').order('issue_date', { ascending: false });
      if (filters?.status) {
        const statuses = filters.status.split(',');
        q = q.in('status', statuses);
      }
      if (filters?.customer_id) q = q.eq('customer_id', filters.customer_id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoiceSummary() {
  const { data: invoices = [] } = useInvoices();
  return {
    outstanding: invoices.filter(i => ['sent', 'viewed', 'partial'].includes(i.status))
      .reduce((s, i) => s + i.balance_due, 0),
    overdue: invoices.filter(i => i.status === 'overdue')
      .reduce((s, i) => s + i.balance_due, 0),
    paidThisMonth: invoices.filter(i => i.status === 'paid')
      .reduce((s, i) => s + i.total, 0),
    draftCount: invoices.filter(i => i.status === 'draft').length,
  };
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Partial<Invoice>, 'balance_due'>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('invoices').insert(input as never).select().single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice['status'] }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
