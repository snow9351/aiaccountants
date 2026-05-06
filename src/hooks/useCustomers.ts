import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Customer } from '@/integrations/supabase/types';

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1', org_id: 'mock', name: 'Acme Corporation', email: 'billing@acme.com',
    phone: '555-0101', billing_address: null, payment_terms_id: null,
    credit_limit: 50000, payment_score: 95, total_revenue: 48500,
    ar_balance: 12400, industry: 'Technology', notes: null, is_active: true,
    created_at: '2024-01-15T00:00:00Z', updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: '2', org_id: 'mock', name: 'TechFlow Solutions', email: 'finance@techflow.io',
    phone: '555-0102', billing_address: null, payment_terms_id: null,
    credit_limit: 25000, payment_score: 72, total_revenue: 31200,
    ar_balance: 8750, industry: 'Software', notes: null, is_active: true,
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: '3', org_id: 'mock', name: 'Meridian Partners', email: 'accounts@meridian.com',
    phone: '555-0103', billing_address: null, payment_terms_id: null,
    credit_limit: 75000, payment_score: 88, total_revenue: 67800,
    ar_balance: 0, industry: 'Finance', notes: null, is_active: true,
    created_at: '2024-02-15T00:00:00Z', updated_at: '2024-02-15T00:00:00Z',
  },
  {
    id: '4', org_id: 'mock', name: 'Vertex Industries', email: 'ap@vertex.co',
    phone: '555-0104', billing_address: null, payment_terms_id: null,
    credit_limit: 20000, payment_score: 45, total_revenue: 19500,
    ar_balance: 15600, industry: 'Manufacturing', notes: null, is_active: true,
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z',
  },
  {
    id: '5', org_id: 'mock', name: 'CloudBase Inc', email: 'billing@cloudbase.dev',
    phone: '555-0105', billing_address: null, payment_terms_id: null,
    credit_limit: 30000, payment_score: 91, total_revenue: 24300,
    ar_balance: 3200, industry: 'Cloud Services', notes: null, is_active: true,
    created_at: '2024-03-15T00:00:00Z', updated_at: '2024-03-15T00:00:00Z',
  },
  {
    id: '6', org_id: 'mock', name: 'Nexus Retail Group', email: 'finance@nexusretail.com',
    phone: '555-0106', billing_address: null, payment_terms_id: null,
    credit_limit: 40000, payment_score: 63, total_revenue: 52100,
    ar_balance: 21900, industry: 'Retail', notes: null, is_active: true,
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
];

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async (): Promise<Customer[]> => {
      if (!isSupabaseConfigured) return MOCK_CUSTOMERS;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) return MOCK_CUSTOMERS;
      return data as Customer[];
    },
    placeholderData: MOCK_CUSTOMERS,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Customer>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Customer;
      }
      const { data, error } = await supabase.from('customers').insert(input as Customer['org_id'] extends string ? typeof input : never).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      if (!isSupabaseConfigured) {
        return { id, ...updates } as Customer;
      }
      const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export { MOCK_CUSTOMERS };
