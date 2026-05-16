import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { Contact, ContactType } from '@/integrations/supabase/types';

export type ContactFormInput = {
  org_id: string;
  contact_type: ContactType;
  display_name: string;
  legal_name?: string | null;
  billing_address?: Record<string, unknown> | null;
  shipping_address?: Record<string, unknown> | null;
  tax_id?: string | null;
  is_1099_eligible?: boolean;
  payment_terms_id?: string | null;
  default_income_account_id?: string | null;
  default_expense_account_id?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export function useContacts(orgId?: string, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['contacts', orgId, options?.includeInactive ?? false],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async (): Promise<Contact[]> => {
      if (!orgId) return [];
      let q = supabase.from('contacts').select('*').eq('org_id', orgId);
      if (!options?.includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q.order('display_name');
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactFormInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.rpc('create_contact', {
        p_org_id: input.org_id,
        p_contact_type: input.contact_type,
        p_display_name: input.display_name.trim(),
        p_legal_name: input.legal_name?.trim() || null,
        p_billing_address: input.billing_address ?? null,
        p_shipping_address: input.shipping_address ?? null,
        p_tax_id: input.tax_id?.trim() || null,
        p_is_1099_eligible: input.is_1099_eligible ?? false,
        p_payment_terms_id: input.payment_terms_id || null,
        p_default_income_account_id: input.default_income_account_id || null,
        p_default_expense_account_id: input.default_expense_account_id || null,
        p_email: input.email?.trim() || null,
        p_phone: input.phone?.trim() || null,
        p_notes: input.notes?.trim() || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts', vars.org_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      org_id,
      ...patch
    }: Partial<Contact> & { id: string; org_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('contacts')
        .update(patch as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts', vars.org_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useVendors1099Threshold(orgId?: string, year?: number) {
  const y = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['vendors_1099_threshold', orgId, y],
    enabled: !!orgId && isSupabaseConfigured,
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('vendors_1099_threshold', {
        p_org_id: orgId,
        p_year: y,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        contact_id: string | null;
        vendor_id: string;
        display_name: string;
        tax_id: string | null;
        ytd_1099_payments: number;
        threshold: number;
      }>;
    },
  });
}
