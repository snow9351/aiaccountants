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

/** DB uses `tax_id`; UI uses `ein`. */
export function mapOrganizationRow(org: Record<string, unknown>, role?: string): Company {
  const taxId = org.tax_id;
  const legacyEin = org.ein;
  return {
    id: String(org.id),
    name: String(org.name ?? ''),
    entity_type: (org.entity_type as string) ?? 'llc',
    accounting_method: (org.accounting_method as string) ?? 'cash',
    fiscal_year_start: typeof org.fiscal_year_start === 'number' ? org.fiscal_year_start : Number(org.fiscal_year_start ?? 1) || 1,
    timezone: (org.timezone as string) ?? 'America/New_York',
    ein: typeof legacyEin === 'string' ? legacyEin : typeof taxId === 'string' ? taxId : null,
    plan: String(org.plan ?? 'starter'),
    subscription_status: String(org.subscription_status ?? 'trialing'),
    trial_ends_at: typeof org.trial_ends_at === 'string' ? org.trial_ends_at : null,
    logo_url: typeof org.logo_url === 'string' ? org.logo_url : null,
    role,
  };
}

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async (): Promise<Company[]> => {
      if (!isSupabaseConfigured || !user) return MOCK_COMPANIES;
      const { data, error } = await supabase.from('company_memberships').select('role, organizations(*)').eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((m: { role?: string; organizations: Record<string, unknown> }) =>
        mapOrganizationRow(m.organizations ?? {}, m.role),
      );
    },
    placeholderData: isSupabaseConfigured ? undefined : MOCK_COMPANIES,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; entity_type: string; accounting_method: string; ein?: string }) => {
      if (!isSupabaseConfigured) return { ...input, id: crypto.randomUUID() } as Company;
      if (!user) throw new Error('You must be signed in to create a company.');
      const ein = input.ein?.trim();
      const payload: Record<string, unknown> = {
        name: input.name.trim(),
        entity_type: input.entity_type,
        accounting_method: input.accounting_method,
        created_by: user.id,
      };
      if (ein) payload.tax_id = ein;

      const { data: org, error: orgErr } = await supabase.from('organizations').insert(payload as never).select().single();
      if (orgErr) throw orgErr;
      // Create membership as owner
      const { error: membershipErr } = await supabase
        .from('company_memberships')
        .insert({ org_id: org.id, user_id: user.id, role: 'owner', is_billing_owner: true });
      if (membershipErr) throw membershipErr;
      // Auto-generate COA
      const { error: coaErr } = await supabase.rpc('generate_default_coa', {
        p_org_id: org.id,
        p_entity_type: input.entity_type,
      });
      if (coaErr) throw coaErr;
      return mapOrganizationRow(org as Record<string, unknown>);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ein, ...updates }: Partial<Company> & { id: string }) => {
      if (!isSupabaseConfigured) return { id, ein, ...updates } as Company;
      const patch: Record<string, unknown> = { ...updates };
      if (ein !== undefined) patch.tax_id = ein;
      const { data, error } = await supabase.from('organizations').update(patch as never).eq('id', id).select().single();
      if (error) throw error;
      return mapOrganizationRow(data as Record<string, unknown>);
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
