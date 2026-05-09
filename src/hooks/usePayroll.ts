import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Employee, PayrollRun } from '@/integrations/supabase/types';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async (): Promise<Employee[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Employee>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('employees').insert(input as never).select().single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['payroll_runs'],
    queryFn: async (): Promise<PayrollRun[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('payroll_date', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as PayrollRun[];
    },
  });
}

export function useRunPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PayrollRun>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('payroll_runs').insert({ ...input, status: 'draft' } as never).select().single();
      if (error) throw error;
      return data as PayrollRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll_runs'] }),
  });
}
