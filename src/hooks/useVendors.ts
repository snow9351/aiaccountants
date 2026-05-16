import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Vendor } from '@/integrations/supabase/types';

export function useVendors(orgId?: string) {
  return useQuery({
    queryKey: ['vendors', orgId ?? ''],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Vendor[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Vendor[];
    },
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Vendor>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('vendors').insert(input as never).select().single();
      if (error) throw error;
      return data as Vendor;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });
}
