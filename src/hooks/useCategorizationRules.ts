import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface CategorizationRule {
  id: string;
  org_id: string;
  name: string;
  match_field: 'description' | 'vendor' | 'amount' | 'memo';
  match_type: 'contains' | 'starts_with' | 'exact' | 'regex' | 'greater_than' | 'less_than';
  match_value: string;
  target_account_id: string;
  target_account_name: string;
  priority: number;
  is_active: boolean;
  auto_apply: boolean;
  times_applied: number;
  created_at: string;
  last_applied_at: string | null;
}

export function useCategorizationRules(orgId?: string) {
  return useQuery({
    queryKey: ['categorization_rules', orgId],
    queryFn: async (): Promise<CategorizationRule[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('categorization_rules').select('*').eq('org_id', orgId!).order('priority');
      if (error) throw error;
      return data as CategorizationRule[];
    },
    enabled: !!orgId,
  });
}

export function useCreateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CategorizationRule, 'id' | 'times_applied' | 'created_at' | 'last_applied_at'>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('categorization_rules').insert(input).select().single();
      if (error) throw error;
      return data as CategorizationRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorization_rules'] }),
  });
}

export function useUpdateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CategorizationRule> & { id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('categorization_rules').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorization_rules'] }),
  });
}

export function useDeleteCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('categorization_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorization_rules'] }),
  });
}
