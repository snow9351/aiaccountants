import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface PaymentTerm {
  id: string;
  org_id: string;
  name: string;
  days_due: number;
  discount_percent: number | null;
  discount_days: number | null;
  created_at: string;
}

export function usePaymentTerms(orgId?: string) {
  return useQuery({
    queryKey: ['payment_terms', orgId],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<PaymentTerm[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('payment_terms')
        .select('id, org_id, name, days_due, discount_percent, discount_days, created_at')
        .eq('org_id', orgId)
        .order('days_due');
      if (error) throw error;
      return (data ?? []) as PaymentTerm[];
    },
  });
}

export async function ensureDefaultPaymentTerms(orgId: string) {
  if (!isSupabaseConfigured) return;
  await supabase.rpc('seed_default_payment_terms', { p_org_id: orgId });
}
