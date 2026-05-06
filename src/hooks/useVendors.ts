import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Vendor } from '@/integrations/supabase/types';

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1', org_id: 'mock', name: 'Amazon Web Services', email: 'aws-billing@amazon.com',
    phone: null, address: null, tax_id: '91-1591016', payment_terms_id: null,
    preferred_payment_method: 'credit_card', total_spend: 34080, ap_balance: 2840,
    reliability_score: 99, is_1099: false, is_active: true, notes: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'v2', org_id: 'mock', name: 'WeWork', email: 'billing@wework.com',
    phone: '555-2001', address: null, tax_id: '47-1183757', payment_terms_id: null,
    preferred_payment_method: 'bank_transfer', total_spend: 21600, ap_balance: 1800,
    reliability_score: 95, is_1099: false, is_active: true, notes: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'v3', org_id: 'mock', name: 'Stripe Inc', email: 'billing@stripe.com',
    phone: null, address: null, tax_id: '26-3427113', payment_terms_id: null,
    preferred_payment_method: 'credit_card', total_spend: 10704, ap_balance: 892,
    reliability_score: 99, is_1099: false, is_active: true, notes: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'v4', org_id: 'mock', name: 'Johnson & Associates CPA', email: 'billing@jassoc.com',
    phone: '555-2004', address: null, tax_id: '55-1234567', payment_terms_id: null,
    preferred_payment_method: 'bank_transfer', total_spend: 9600, ap_balance: 0,
    reliability_score: 97, is_1099: true, is_active: true, notes: 'Annual tax prep & quarterly review',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
  {
    id: 'v5', org_id: 'mock', name: 'Delta Airlines', email: null,
    phone: null, address: null, tax_id: '58-0218548', payment_terms_id: null,
    preferred_payment_method: 'credit_card', total_spend: 14880, ap_balance: 0,
    reliability_score: 88, is_1099: false, is_active: true, notes: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
  },
];

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async (): Promise<Vendor[]> => {
      if (!isSupabaseConfigured) return MOCK_VENDORS;
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) return MOCK_VENDORS;
      return data as Vendor[];
    },
    placeholderData: MOCK_VENDORS,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Vendor>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Vendor;
      }
      const { data, error } = await supabase.from('vendors').insert(input as never).select().single();
      if (error) throw error;
      return data as Vendor;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });
}
