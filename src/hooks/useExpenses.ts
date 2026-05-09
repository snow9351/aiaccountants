import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Expense } from '@/integrations/supabase/types';

export function useExpenses(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async (): Promise<Expense[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('expenses').select('*').order('date', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.category) q = q.eq('category', filters.category);
      const { data, error } = await q;
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Expense>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
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
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
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
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
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
