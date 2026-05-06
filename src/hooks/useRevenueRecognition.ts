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

const MOCK_CONTRACTS: RevenueContract[] = [
  { id: 'rc-1', org_id: 'mock', customer_name: 'Acme Corp', contract_name: 'Annual SaaS License', total_value: 120000, recognized_to_date: 30000, deferred_revenue: 90000, start_date: '2024-01-01', end_date: '2024-12-31', recognition_method: 'straight_line', status: 'active', created_at: '2024-01-01T00:00:00Z' },
  { id: 'rc-2', org_id: 'mock', customer_name: 'TechStart Inc', contract_name: 'Implementation + Support', total_value: 75000, recognized_to_date: 45000, deferred_revenue: 30000, start_date: '2024-01-15', end_date: '2024-07-15', recognition_method: 'milestone', status: 'active', created_at: '2024-01-15T00:00:00Z' },
  { id: 'rc-3', org_id: 'mock', customer_name: 'Global Finance Ltd', contract_name: 'API Usage Contract', total_value: 50000, recognized_to_date: 18500, deferred_revenue: 31500, start_date: '2024-02-01', end_date: '2024-12-31', recognition_method: 'usage_based', status: 'active', created_at: '2024-02-01T00:00:00Z' },
  { id: 'rc-4', org_id: 'mock', customer_name: 'RetailMax', contract_name: 'One-Time Setup', total_value: 25000, recognized_to_date: 25000, deferred_revenue: 0, start_date: '2024-02-10', end_date: '2024-02-10', recognition_method: 'point_in_time', status: 'completed', created_at: '2024-02-10T00:00:00Z' },
];

const MOCK_SCHEDULES: RevenueSchedule[] = [
  { id: 'rs-1', contract_id: 'rc-1', period: '2024-01', amount: 10000, status: 'recognized', recognized_at: '2024-01-31T23:59:59Z', journal_entry_id: 'je-100' },
  { id: 'rs-2', contract_id: 'rc-1', period: '2024-02', amount: 10000, status: 'recognized', recognized_at: '2024-02-29T23:59:59Z', journal_entry_id: 'je-101' },
  { id: 'rs-3', contract_id: 'rc-1', period: '2024-03', amount: 10000, status: 'recognized', recognized_at: '2024-03-31T23:59:59Z', journal_entry_id: 'je-102' },
  { id: 'rs-4', contract_id: 'rc-1', period: '2024-04', amount: 10000, status: 'scheduled', recognized_at: null, journal_entry_id: null },
  { id: 'rs-5', contract_id: 'rc-1', period: '2024-05', amount: 10000, status: 'scheduled', recognized_at: null, journal_entry_id: null },
  { id: 'rs-6', contract_id: 'rc-1', period: '2024-06', amount: 10000, status: 'scheduled', recognized_at: null, journal_entry_id: null },
];

export function useRevenueContracts(orgId?: string) {
  return useQuery({
    queryKey: ['revenue_contracts', orgId],
    queryFn: async (): Promise<RevenueContract[]> => {
      if (!isSupabaseConfigured) return MOCK_CONTRACTS;
      const { data, error } = await supabase.from('revenue_contracts').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) return MOCK_CONTRACTS;
      return data as RevenueContract[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_CONTRACTS,
  });
}

export function useRevenueSchedule(contractId?: string) {
  return useQuery({
    queryKey: ['revenue_schedules', contractId],
    queryFn: async (): Promise<RevenueSchedule[]> => {
      if (!isSupabaseConfigured) return MOCK_SCHEDULES.filter(s => s.contract_id === contractId);
      const { data, error } = await supabase.from('revenue_schedules').select('*').eq('contract_id', contractId!).order('period');
      if (error) return MOCK_SCHEDULES.filter(s => s.contract_id === contractId);
      return data as RevenueSchedule[];
    },
    enabled: !!contractId,
  });
}

export function useCreateRevenueContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<RevenueContract, 'id' | 'recognized_to_date' | 'deferred_revenue' | 'created_at'>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), recognized_to_date: 0, deferred_revenue: input.total_value, created_at: new Date().toISOString() } as RevenueContract;
      }
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
      if (!isSupabaseConfigured) return;
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
