import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Expense } from '@/integrations/supabase/types';

export type CreateExpenseInput = {
  org_id: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  date: string;
  description: string;
  amount: number;
  account_id: string;
  payment_date?: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  receipt_url?: string | null;
};

export function useExpenses(orgId?: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['expenses', orgId ?? '', filters],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Expense[]> => {
      if (!orgId) return [];
      let q = supabase.from('expenses').select('*').eq('org_id', orgId).order('date', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpenseEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('create_expense_entry', {
        p_org_id: input.org_id,
        p_vendor_id: input.vendor_id ?? null,
        p_vendor_name: input.vendor_name ?? null,
        p_date: input.date,
        p_description: input.description,
        p_amount: input.amount,
        p_account_id: input.account_id,
        p_payment_date: input.payment_date ?? input.date,
        p_payment_method: input.payment_method ?? null,
        p_payment_reference: input.payment_reference ?? null,
        p_receipt_url: input.receipt_url ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['expenses', vars.org_id] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, org_id, ...updates }: Partial<Expense> & { id: string; org_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('expenses').update(updates as never).eq('id', id).select().single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['expenses', data.org_id] });
    },
  });
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async ({ file, orgId }: { file: File; orgId: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${orgId}/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from('receipts').upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      return data.path;
    },
  });
}

export async function getReceiptSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured || !storagePath) return null;
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** @deprecated Use useCreateExpenseEntry */
export function useCreateExpense() {
  return useCreateExpenseEntry();
}
