import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';

interface CompanyStore {
  activeOrgId: string;
  setActiveOrgId: (id: string) => void;
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set) => ({
      activeOrgId: '',
      setActiveOrgId: (id) => set({ activeOrgId: id }),
    }),
    { name: 'ai-accountants-org' }
  )
);

/** Returns the active org ID, auto-syncing from the user's companies on first load */
export function useOrgId(): string {
  const { activeOrgId, setActiveOrgId } = useCompanyStore();
  const { data: companies } = useCompanies();

  useEffect(() => {
    if (!activeOrgId && companies && companies.length > 0) {
      setActiveOrgId(companies[0].id);
    }
    // If stored orgId is no longer valid, reset to first company
    if (activeOrgId && companies && companies.length > 0 && !companies.find(c => c.id === activeOrgId)) {
      setActiveOrgId(companies[0].id);
    }
  }, [activeOrgId, companies, setActiveOrgId]);

  // Fallback for demo mode
  if (!activeOrgId && (!companies || companies.length === 0)) return 'mock';
  return activeOrgId || 'mock';
}

export interface Company {
  id: string;
  name: string;
  entity_type: string;
  accounting_method: string;
  fiscal_year_start: number;
  timezone: string;
  ein: string | null;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  logo_url: string | null;
  role?: string;
}

const MOCK_COMPANIES: Company[] = [
  { id: 'mock', name: 'Acme Technologies LLC', entity_type: 'llc', accounting_method: 'cash', fiscal_year_start: 1, timezone: 'America/New_York', ein: '12-3456789', plan: 'pro', subscription_status: 'trialing', trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(), logo_url: null, role: 'owner' },
];

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async (): Promise<Company[]> => {
      if (!isSupabaseConfigured || !user) return MOCK_COMPANIES;
      const { data, error } = await supabase.from('company_memberships').select('role, organizations(*)').eq('user_id', user.id);
      if (error) return MOCK_COMPANIES;
      return (data ?? []).map((m: any) => ({ ...m.organizations, role: m.role })) as Company[];
    },
    placeholderData: MOCK_COMPANIES,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; entity_type: string; accounting_method: string; ein?: string }) => {
      if (!isSupabaseConfigured) return { ...input, id: crypto.randomUUID() } as Company;
      // Create org
      const { data: org, error: orgErr } = await supabase.from('organizations').insert({ ...input, org_id: 'auto' }).select().single();
      if (orgErr) throw orgErr;
      // Create membership as owner
      await supabase.from('company_memberships').insert({ org_id: org.id, user_id: user!.id, role: 'owner', is_billing_owner: true });
      // Auto-generate COA
      await supabase.rpc('generate_default_coa', { p_org_id: org.id, p_entity_type: input.entity_type });
      return org as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }) => {
      if (!isSupabaseConfigured) return { id, ...updates } as Company;
      const { data, error } = await supabase.from('organizations').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useCompanyMembers(orgId?: string) {
  return useQuery({
    queryKey: ['company_members', orgId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase.from('company_memberships').select('*, users:user_id(email, user_metadata)').eq('org_id', orgId);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!orgId,
  });
}
