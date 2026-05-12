import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface RevenueContract {
  id: string;
  org_id: string;
  customer_name: string;
  contract_name: string;
  total_value: number;
  recognized_to_date: number;
  deferred_revenue: number;
  start_date: string;
  end_date: string;
  recognition_method: 'straight_line' | 'milestone' | 'usage_based' | 'point_in_time';
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

export interface RevenueSchedule {
  id: string;
  contract_id: string;
  period: string; // e.g. "2024-03"
  amount: number;
  status: 'scheduled' | 'recognized' | 'adjusted';
  recognized_at: string | null;
  journal_entry_id: string | null;
}

export function useRevenueContracts(orgId?: string) {
  return useQuery({
    queryKey: ['revenue_contracts', orgId],
    queryFn: async (): Promise<RevenueContract[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase.from('revenue_contracts').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as RevenueContract[];
    },
    enabled: !!orgId,
  });
}

export function useRevenueSchedule(contractId?: string) {
  return useQuery({
    queryKey: ['revenue_schedules', contractId],
    queryFn: async (): Promise<RevenueSchedule[]> => {
      if (!isSupabaseConfigured || !contractId) return [];
      const { data, error } = await supabase.from('revenue_schedules').select('*').eq('contract_id', contractId!).order('period');
      if (error) throw error;
      return data as RevenueSchedule[];
    },
    enabled: !!contractId,
  });
}

export function useCreateRevenueContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<RevenueContract, 'id' | 'recognized_to_date' | 'deferred_revenue' | 'created_at'>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('revenue_contracts').insert({ ...input, recognized_to_date: 0, deferred_revenue: input.total_value }).select().single();
      if (error) throw error;
      return data as RevenueContract;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['revenue_contracts'] }),
  });
}

export function useRecognizeRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId }: { scheduleId: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('revenue_schedules').update({
        status: 'recognized',
        recognized_at: new Date().toISOString(),
      }).eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revenue_schedules'] });
      qc.invalidateQueries({ queryKey: ['revenue_contracts'] });
    },
  });
}
