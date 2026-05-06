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

const MOCK_RULES: CategorizationRule[] = [
  { id: 'cr-1', org_id: 'mock', name: 'AWS Charges', match_field: 'description', match_type: 'contains', match_value: 'AMAZON WEB SERVICES', target_account_id: 'acc-hosting', target_account_name: 'Cloud Hosting', priority: 1, is_active: true, auto_apply: true, times_applied: 47, created_at: '2024-01-15T10:00:00Z', last_applied_at: '2024-04-01T08:30:00Z' },
  { id: 'cr-2', org_id: 'mock', name: 'Stripe Payouts', match_field: 'description', match_type: 'starts_with', match_value: 'STRIPE PAYOUT', target_account_id: 'acc-revenue', target_account_name: 'Service Revenue', priority: 2, is_active: true, auto_apply: true, times_applied: 12, created_at: '2024-01-20T14:00:00Z', last_applied_at: '2024-03-28T16:00:00Z' },
  { id: 'cr-3', org_id: 'mock', name: 'Office Supplies', match_field: 'vendor', match_type: 'contains', match_value: 'STAPLES', target_account_id: 'acc-supplies', target_account_name: 'Office Supplies', priority: 3, is_active: true, auto_apply: false, times_applied: 8, created_at: '2024-02-01T09:00:00Z', last_applied_at: '2024-03-15T11:00:00Z' },
  { id: 'cr-4', org_id: 'mock', name: 'Large Purchases Review', match_field: 'amount', match_type: 'greater_than', match_value: '5000', target_account_id: 'acc-capex', target_account_name: 'Capital Expenditure', priority: 10, is_active: true, auto_apply: false, times_applied: 3, created_at: '2024-02-10T10:00:00Z', last_applied_at: '2024-03-20T14:00:00Z' },
  { id: 'cr-5', org_id: 'mock', name: 'Uber/Lyft Travel', match_field: 'description', match_type: 'regex', match_value: '(UBER|LYFT)', target_account_id: 'acc-travel', target_account_name: 'Travel & Transport', priority: 4, is_active: true, auto_apply: true, times_applied: 22, created_at: '2024-02-15T11:00:00Z', last_applied_at: '2024-04-02T09:15:00Z' },
  { id: 'cr-6', org_id: 'mock', name: 'Gusto Payroll', match_field: 'description', match_type: 'contains', match_value: 'GUSTO', target_account_id: 'acc-payroll', target_account_name: 'Payroll Expense', priority: 1, is_active: false, auto_apply: true, times_applied: 6, created_at: '2024-03-01T10:00:00Z', last_applied_at: '2024-03-01T10:00:00Z' },
];

export function useCategorizationRules(orgId?: string) {
  return useQuery({
    queryKey: ['categorization_rules', orgId],
    queryFn: async (): Promise<CategorizationRule[]> => {
      if (!isSupabaseConfigured) return MOCK_RULES;
      const { data, error } = await supabase.from('categorization_rules').select('*').eq('org_id', orgId!).order('priority');
      if (error) return MOCK_RULES;
      return data as CategorizationRule[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_RULES,
  });
}

export function useCreateCategorizationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CategorizationRule, 'id' | 'times_applied' | 'created_at' | 'last_applied_at'>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), times_applied: 0, created_at: new Date().toISOString(), last_applied_at: null } as CategorizationRule;
      }
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
      if (!isSupabaseConfigured) return;
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
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('categorization_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorization_rules'] }),
  });
}
