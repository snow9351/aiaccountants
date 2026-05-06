import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Invoice } from '@/integrations/supabase/types';

const MOCK_INVOICES: Invoice[] = [
  {
    id: '1', org_id: 'mock', invoice_number: 'INV-2024-001', customer_id: '1',
    status: 'sent', issue_date: '2024-03-01', due_date: '2024-03-31',
    subtotal: 12400, tax_amount: 0, total: 12400, amount_paid: 0, balance_due: 12400,
    notes: null, is_recurring: false, recurring_interval: null, journal_entry_id: null,
    sent_at: '2024-03-01T10:00:00Z', viewed_at: '2024-03-02T09:00:00Z',
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z',
  },
  {
    id: '2', org_id: 'mock', invoice_number: 'INV-2024-002', customer_id: '2',
    status: 'overdue', issue_date: '2024-02-01', due_date: '2024-03-01',
    subtotal: 8750, tax_amount: 0, total: 8750, amount_paid: 0, balance_due: 8750,
    notes: null, is_recurring: false, recurring_interval: null, journal_entry_id: null,
    sent_at: '2024-02-01T10:00:00Z', viewed_at: null,
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: '3', org_id: 'mock', invoice_number: 'INV-2024-003', customer_id: '3',
    status: 'paid', issue_date: '2024-01-15', due_date: '2024-02-14',
    subtotal: 24600, tax_amount: 0, total: 24600, amount_paid: 24600, balance_due: 0,
    notes: null, is_recurring: true, recurring_interval: 'monthly', journal_entry_id: null,
    sent_at: '2024-01-15T10:00:00Z', viewed_at: '2024-01-16T08:00:00Z',
    created_at: '2024-01-15T00:00:00Z', updated_at: '2024-02-10T00:00:00Z',
  },
  {
    id: '4', org_id: 'mock', invoice_number: 'INV-2024-004', customer_id: '4',
    status: 'overdue', issue_date: '2024-01-01', due_date: '2024-01-31',
    subtotal: 15600, tax_amount: 0, total: 15600, amount_paid: 0, balance_due: 15600,
    notes: 'Past due 60+ days', is_recurring: false, recurring_interval: null, journal_entry_id: null,
    sent_at: '2024-01-01T10:00:00Z', viewed_at: '2024-01-03T11:00:00Z',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '5', org_id: 'mock', invoice_number: 'INV-2024-005', customer_id: '5',
    status: 'draft', issue_date: '2024-04-01', due_date: '2024-05-01',
    subtotal: 3200, tax_amount: 256, total: 3456, amount_paid: 0, balance_due: 3456,
    notes: null, is_recurring: false, recurring_interval: null, journal_entry_id: null,
    sent_at: null, viewed_at: null,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
];

export function useInvoices(filters?: { status?: string; customer_id?: string }) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async (): Promise<Invoice[]> => {
      if (!isSupabaseConfigured) {
        if (filters?.status) {
          const statuses = filters.status.split(',');
          return MOCK_INVOICES.filter(i => statuses.includes(i.status));
        }
        return MOCK_INVOICES;
      }
      let q = supabase.from('invoices').select('*').order('issue_date', { ascending: false });
      if (filters?.status) {
        const statuses = filters.status.split(',');
        q = q.in('status', statuses);
      }
      if (filters?.customer_id) q = q.eq('customer_id', filters.customer_id);
      const { data, error } = await q;
      if (error) return MOCK_INVOICES;
      return data as Invoice[];
    },
    placeholderData: MOCK_INVOICES,
  });
}

export function useInvoiceSummary() {
  const { data: invoices = MOCK_INVOICES } = useInvoices();
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
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), balance_due: (input.total ?? 0) - (input.amount_paid ?? 0), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Invoice;
      }
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
      if (!isSupabaseConfigured) return { id, status };
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export { MOCK_INVOICES };
