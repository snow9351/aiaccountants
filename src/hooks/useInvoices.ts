import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Invoice, InvoiceLineItem, InvoicePayment } from '@/integrations/supabase/types';

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  account_id?: string | null;
};

export type CreateInvoiceInput = {
  org_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date?: string;
  notes?: string | null;
  discount_type?: 'none' | 'percent' | 'flat';
  discount_value?: number;
  lines: InvoiceLineInput[];
};

export function useInvoices(orgId?: string, filters?: { status?: string; customer_id?: string }) {
  return useQuery({
    queryKey: ['invoices', orgId ?? '', filters],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Invoice[]> => {
      if (!orgId) return [];
      let q = supabase.from('invoices').select('*').eq('org_id', orgId).order('issue_date', { ascending: false });
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

export function useInvoiceDetail(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: !!invoiceId && isSupabaseConfigured,
    queryFn: async () => {
      if (!invoiceId) return null;
      const [invRes, linesRes, pmtsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', invoiceId).single(),
        supabase.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('line_number'),
        supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('payment_date', { ascending: false }),
      ]);
      if (invRes.error) throw invRes.error;
      if (linesRes.error) throw linesRes.error;
      if (pmtsRes.error) throw pmtsRes.error;
      return {
        invoice: invRes.data as Invoice,
        lines: (linesRes.data ?? []) as InvoiceLineItem[],
        payments: (pmtsRes.data ?? []) as InvoicePayment[],
      };
    },
  });
}

export function useInvoiceSummary(orgId?: string) {
  const { data: invoices = [] } = useInvoices(orgId);
  return {
    outstanding: invoices
      .filter((i) => ['sent', 'viewed', 'partial'].includes(i.status))
      .reduce((s, i) => s + i.balance_due, 0),
    overdue: invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.balance_due, 0),
    paidThisMonth: invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + i.total, 0),
    draftCount: invoices.filter((i) => i.status === 'draft').length,
  };
}

export function useCreateInvoiceWithLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('create_invoice_with_lines', {
        p_org_id: input.org_id,
        p_customer_id: input.customer_id,
        p_invoice_number: input.invoice_number,
        p_issue_date: input.issue_date,
        p_due_date: input.due_date ?? null,
        p_notes: input.notes ?? null,
        p_discount_type: input.discount_type ?? 'none',
        p_discount_value: input.discount_value ?? 0,
        p_lines: input.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          account_id: l.account_id ?? null,
        })),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices', vars.org_id] });
    },
  });
}

export function useTransitionInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
      orgId,
    }: {
      invoiceId: string;
      status: Invoice['status'];
      orgId: string;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('transition_invoice_status', {
        p_invoice_id: invoiceId,
        p_new_status: status,
      });
      if (error) throw error;
      return { invoice: data as Invoice, orgId };
    },
    onSuccess: ({ orgId, invoice }) => {
      qc.invalidateQueries({ queryKey: ['invoices', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      qc.invalidateQueries({ queryKey: ['audit_log'] });
    },
  });
}

export function useRecordInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      orgId,
      amount,
      payment_method,
      payment_date,
      reference,
      notes,
    }: {
      invoiceId: string;
      orgId: string;
      amount?: number;
      payment_method: string;
      payment_date?: string;
      reference?: string;
      notes?: string;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('record_invoice_payment', {
        p_invoice_id: invoiceId,
        p_payment_date: payment_date ?? new Date().toISOString().slice(0, 10),
        p_amount: amount ?? null,
        p_payment_method: payment_method,
        p_reference: reference ?? null,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return { paymentId: data as string, invoiceId, orgId };
    },
    onSuccess: ({ invoiceId, orgId }) => {
      qc.invalidateQueries({ queryKey: ['invoices', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['audit_log'] });
    },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, orgId }: { invoiceId: string; orgId: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: { invoice_id: invoiceId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return { ...(data as { payment_link_url?: string; email_sent?: boolean }), orgId, invoiceId };
    },
    onSuccess: ({ orgId, invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices', orgId] });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}
