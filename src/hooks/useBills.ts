import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Bill, BillLineItem, BillPayment } from '@/integrations/supabase/types';

export type BillLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  account_id?: string | null;
};

export type CreateBillInput = {
  org_id: string;
  vendor_id: string;
  bill_number?: string | null;
  bill_date: string;
  due_date?: string;
  description?: string | null;
  receipt_url?: string | null;
  lines: BillLineInput[];
};

export function useBills(orgId?: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['bills', orgId ?? '', filters],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Bill[]> => {
      if (!orgId) return [];
      let q = supabase.from('bills').select('*').eq('org_id', orgId).order('due_date', { ascending: true });
      if (filters?.status) {
        const statuses = filters.status.split(',');
        q = q.in('status', statuses);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Bill[];
    },
  });
}

export function useBillDetail(billId?: string) {
  return useQuery({
    queryKey: ['bill', billId],
    enabled: !!billId && isSupabaseConfigured,
    queryFn: async () => {
      if (!billId) return null;
      const [billRes, linesRes, pmtsRes] = await Promise.all([
        supabase.from('bills').select('*').eq('id', billId).single(),
        supabase.from('bill_line_items').select('*').eq('bill_id', billId).order('line_number'),
        supabase.from('bill_payments').select('*').eq('bill_id', billId).order('payment_date', { ascending: false }),
      ]);
      if (billRes.error) throw billRes.error;
      if (linesRes.error) throw linesRes.error;
      if (pmtsRes.error) throw pmtsRes.error;
      return {
        bill: billRes.data as Bill,
        lines: (linesRes.data ?? []) as BillLineItem[],
        payments: (pmtsRes.data ?? []) as BillPayment[],
      };
    },
  });
}

export function useCreateBillWithLines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBillInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('create_bill_with_lines', {
        p_org_id: input.org_id,
        p_vendor_id: input.vendor_id,
        p_bill_number: input.bill_number ?? null,
        p_bill_date: input.bill_date,
        p_due_date: input.due_date ?? null,
        p_description: input.description ?? null,
        p_receipt_url: input.receipt_url ?? null,
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
      qc.invalidateQueries({ queryKey: ['bills', vars.org_id] });
    },
  });
}

/** Records a bill_payment row; status (partial/paid) updated via DB trigger. */
export function useRecordBillPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      paymentDate,
      amount,
      payment_method,
      reference,
      notes,
    }: {
      billId: string;
      orgId: string;
      paymentDate?: string;
      amount?: number;
      payment_method: string;
      reference?: string;
      notes?: string;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('record_bill_payment', {
        p_bill_id: billId,
        p_payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
        p_amount: amount ?? null,
        p_payment_method: payment_method,
        p_reference: reference ?? null,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['bills', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['bill', vars.billId] });
      qc.invalidateQueries({ queryKey: ['contacts', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['vendors', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['vendors_1099_threshold', vars.orgId] });
    },
  });
}

/** @deprecated Use useRecordBillPayment */
export const useMarkBillPaid = useRecordBillPayment;

export function useCreateBill() {
  return useCreateBillWithLines();
}
