import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyFirm() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my_firm', user?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !user) return null;
      const { data, error } = await supabase.from('firms').select('*').eq('owner_id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && isSupabaseConfigured,
  });
}

/** One row per owner; idempotent if a firm already exists (returns existing id). */
export function useEnsureMyAccountingFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; ein?: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('ensure_my_accounting_firm', {
        p_ein: input.ein?.trim() || null,
        p_name: input.name.trim(),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my_firm'] });
    },
  });
}

/** Flow A: accountant-owned firm creates a client company (org) linked via managed_by_firm_id */
export function useCreateClientCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      entity_type: string;
      accounting_method: string;
      tax_id?: string;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('create_client_company_for_firm', {
        p_name: input.name.trim(),
        p_entity_type: input.entity_type,
        p_accounting_method: input.accounting_method,
        p_tax_id: input.tax_id?.trim() || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['my_firm'] });
    },
  });
}
