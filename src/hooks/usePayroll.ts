import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Employee, PayrollRun } from '@/integrations/supabase/types';

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1', org_id: 'mock', first_name: 'Sarah', last_name: 'Chen',
    email: 'sarah@company.com', phone: '555-1001', job_title: 'Senior Engineer',
    department: 'Engineering', hire_date: '2022-03-15', termination_date: null,
    status: 'active', employment_type: 'full_time', salary: 145000,
    salary_frequency: 'annual', overtime_multiplier: 1.5, address: null,
    created_at: '2022-03-15T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'emp-2', org_id: 'mock', first_name: 'Marcus', last_name: 'Johnson',
    email: 'marcus@company.com', phone: '555-1002', job_title: 'Product Manager',
    department: 'Product', hire_date: '2022-06-01', termination_date: null,
    status: 'active', employment_type: 'full_time', salary: 125000,
    salary_frequency: 'annual', overtime_multiplier: 1.5, address: null,
    created_at: '2022-06-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'emp-3', org_id: 'mock', first_name: 'Taylor', last_name: 'Brooks',
    email: 'taylor@company.com', phone: '555-1003', job_title: 'UI/UX Designer',
    department: 'Design', hire_date: '2023-01-15', termination_date: null,
    status: 'active', employment_type: 'full_time', salary: 98000,
    salary_frequency: 'annual', overtime_multiplier: 1.5, address: null,
    created_at: '2023-01-15T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'emp-4', org_id: 'mock', first_name: 'Alex', last_name: 'Rivera',
    email: 'alex@company.com', phone: '555-1004', job_title: 'Sales Manager',
    department: 'Sales', hire_date: '2023-04-01', termination_date: null,
    status: 'active', employment_type: 'full_time', salary: 85000,
    salary_frequency: 'annual', overtime_multiplier: 1.5, address: null,
    created_at: '2023-04-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
];

export const MOCK_PAYROLL_RUNS: PayrollRun[] = [
  {
    id: 'pr-1', org_id: 'mock', pay_period_start: '2024-03-01', pay_period_end: '2024-03-31',
    payroll_date: '2024-03-31', status: 'completed', total_gross: 37417,
    total_taxes: 8972, total_deductions: 3200, total_net: 25245, employee_count: 4,
    notes: null, created_by: null, processed_at: '2024-03-31T12:00:00Z',
    created_at: '2024-03-31T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
  },
  {
    id: 'pr-2', org_id: 'mock', pay_period_start: '2024-02-01', pay_period_end: '2024-02-29',
    payroll_date: '2024-02-29', status: 'completed', total_gross: 37417,
    total_taxes: 8972, total_deductions: 3200, total_net: 25245, employee_count: 4,
    notes: null, created_by: null, processed_at: '2024-02-29T12:00:00Z',
    created_at: '2024-02-29T00:00:00Z', updated_at: '2024-02-29T00:00:00Z',
  },
];

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async (): Promise<Employee[]> => {
      if (!isSupabaseConfigured) return MOCK_EMPLOYEES;
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('last_name');
      if (error) return MOCK_EMPLOYEES;
      return data as Employee[];
    },
    placeholderData: MOCK_EMPLOYEES,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Employee>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Employee;
      }
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
      if (!isSupabaseConfigured) return MOCK_PAYROLL_RUNS;
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('payroll_date', { ascending: false })
        .limit(12);
      if (error) return MOCK_PAYROLL_RUNS;
      return data as PayrollRun[];
    },
    placeholderData: MOCK_PAYROLL_RUNS,
  });
}

export function useRunPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PayrollRun>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), status: 'completed' as const, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as PayrollRun;
      }
      const { data, error } = await supabase.from('payroll_runs').insert({ ...input, status: 'draft' } as never).select().single();
      if (error) throw error;
      return data as PayrollRun;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll_runs'] }),
  });
}
