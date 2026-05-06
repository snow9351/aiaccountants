import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Bill } from '@/integrations/supabase/types';

export const MOCK_BILLS: Bill[] = [
  {
    id: 'b1', org_id: 'mock', vendor_id: 'v1', bill_number: 'AWS-2024-04',
    status: 'received', bill_date: '2024-04-01', due_date: '2024-04-30',
    subtotal: 2840, tax_amount: 0, total: 2840, amount_paid: 0, balance_due: 2840,
    description: 'AWS infrastructure - April 2024', po_number: null,
    is_duplicate: false, journal_entry_id: null,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'b2', org_id: 'mock', vendor_id: 'v2', bill_number: 'WW-MAR-2024',
    status: 'paid', bill_date: '2024-03-01', due_date: '2024-03-01',
    subtotal: 1800, tax_amount: 0, total: 1800, amount_paid: 1800, balance_due: 0,
    description: 'WeWork office space - March 2024', po_number: null,
    is_duplicate: false, journal_entry_id: null,
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
  },
  {
    id: 'b3', org_id: 'mock', vendor_id: 'v3', bill_number: 'STRIPE-2024-03',
    status: 'approved', bill_date: '2024-03-31', due_date: '2024-04-15',
    subtotal: 892, tax_amount: 0, total: 892, amount_paid: 0, balance_due: 892,
    description: 'Stripe payment processing fees - March', po_number: null,
    is_duplicate: false, journal_entry_id: null,
    created_at: '2024-03-31T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
  },
  {
    id: 'b4', org_id: 'mock', vendor_id: 'v4', bill_number: 'JA-Q1-2024',
    status: 'overdue', bill_date: '2024-01-31', due_date: '2024-02-28',
    subtotal: 2400, tax_amount: 0, total: 2400, amount_paid: 0, balance_due: 2400,
    description: 'Q1 accounting services', po_number: null,
    is_duplicate: false, journal_entry_id: null,
    created_at: '2024-01-31T00:00:00Z', updated_at: '2024-01-31T00:00:00Z',
  },
];

export function useBills(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['bills', filters],
    queryFn: async (): Promise<Bill[]> => {
      if (!isSupabaseConfigured) {
        if (filters?.status) return MOCK_BILLS.filter(b => b.status === filters.status);
        return MOCK_BILLS;
      }
      let q = supabase.from('bills').select('*').order('due_date', { ascending: true });
      if (filters?.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) return MOCK_BILLS;
      return data as Bill[];
    },
    placeholderData: MOCK_BILLS,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Bill>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), balance_due: (input.total ?? 0) - (input.amount_paid ?? 0), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Bill;
      }
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
      if (!isSupabaseConfigured) return { id, status };
      const { error } = await supabase.from('bills').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}
