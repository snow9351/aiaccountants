import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Expense } from '@/integrations/supabase/types';

export const MOCK_EXPENSES: Expense[] = [
  {
    id: '1', org_id: 'mock', date: '2024-04-01', vendor_id: null,
    vendor_name: 'AWS', description: 'Cloud infrastructure - April',
    amount: 2840, account_id: null, category: 'Software & Subscriptions',
    status: 'auto_categorized', ai_confidence: 0.97, ai_suggested_category: 'Software & Subscriptions',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: '2', org_id: 'mock', date: '2024-03-28', vendor_id: null,
    vendor_name: 'Office Depot', description: 'Office supplies Q1',
    amount: 456, account_id: null, category: 'Office Supplies',
    status: 'approved', ai_confidence: 0.92, ai_suggested_category: 'Office Supplies',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-03-28T00:00:00Z', updated_at: '2024-03-28T00:00:00Z',
  },
  {
    id: '3', org_id: 'mock', date: '2024-03-25', vendor_id: null,
    vendor_name: 'Delta Airlines', description: 'Business travel - SF conference',
    amount: 1240, account_id: null, category: 'Travel & Entertainment',
    status: 'review', ai_confidence: 0.78, ai_suggested_category: 'Travel & Entertainment',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-03-25T00:00:00Z', updated_at: '2024-03-25T00:00:00Z',
  },
  {
    id: '4', org_id: 'mock', date: '2024-03-20', vendor_id: null,
    vendor_name: 'Stripe', description: 'Payment processing fees',
    amount: 892, account_id: null, category: 'Professional Services',
    status: 'auto_categorized', ai_confidence: 0.95, ai_suggested_category: 'Professional Services',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-03-20T00:00:00Z', updated_at: '2024-03-20T00:00:00Z',
  },
  {
    id: '5', org_id: 'mock', date: '2024-03-15', vendor_id: null,
    vendor_name: 'WeWork', description: 'Office coworking space - March',
    amount: 1800, account_id: null, category: 'Rent & Utilities',
    status: 'approved', ai_confidence: 0.99, ai_suggested_category: 'Rent & Utilities',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-03-15T00:00:00Z', updated_at: '2024-03-15T00:00:00Z',
  },
  {
    id: '6', org_id: 'mock', date: '2024-03-10', vendor_id: null,
    vendor_name: 'Unknown Vendor', description: 'Misc purchase - needs review',
    amount: 385, account_id: null, category: null,
    status: 'pending', ai_confidence: 0.52, ai_suggested_category: 'Other Expenses',
    receipt_url: null, bank_transaction_id: null, journal_entry_id: null,
    project_id: null, created_by: null,
    created_at: '2024-03-10T00:00:00Z', updated_at: '2024-03-10T00:00:00Z',
  },
];

export function useExpenses(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async (): Promise<Expense[]> => {
      if (!isSupabaseConfigured) {
        let results = MOCK_EXPENSES;
        if (filters?.status) results = results.filter(e => e.status === filters.status);
        if (filters?.category) results = results.filter(e => e.category === filters.category);
        return results;
      }
      let q = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.category) q = q.eq('category', filters.category);
      const { data, error } = await q;
      if (error) return MOCK_EXPENSES;
      return data as Expense[];
    },
    placeholderData: MOCK_EXPENSES,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Expense>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Expense;
      }
      const { data, error } = await supabase.from('expenses').insert(input as never).select().single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      if (!isSupabaseConfigured) return { id, ...updates } as Expense;
      const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async ({ file, userId }: { file: File; userId: string }) => {
      if (!isSupabaseConfigured) {
        return URL.createObjectURL(file);
      }
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(data.path);
      return publicUrl;
    },
  });
}
