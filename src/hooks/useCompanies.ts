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

  return activeOrgId;
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
      if (!isSupabaseConfigured || !user) return [];
      const { data, error } = await supabase.from('company_memberships').select('role, organizations(*)').eq('user_id', user.id);
      if (error) throw error;
      return (data ?? [])
        .filter((m: { organizations?: { id?: string } | null }) => {
          const o = m.organizations;
          return o && typeof o === 'object' && typeof (o as { id?: string }).id === 'string';
        })
        .map((m: { role?: string; organizations: Record<string, unknown> }) =>
          mapOrganizationRow(m.organizations ?? {}, m.role),
        );
    },
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

/** Rows shaped for Settings team tab: membership + nested `users` for display. */
export interface CompanyMemberRow {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  users: { email: string; user_metadata?: { full_name?: string } };
}

/**
 * Team list for an org. Uses two queries (memberships then public.users) because
 * PostgREST embed `users:user_id` is unreliable when user_id FK targets auth.users,
 * and so we do not swallow errors (empty list + demo fallback hid real failures).
 */
export function useCompanyMembers(orgId?: string) {
  return useQuery({
    queryKey: ['company_members', orgId],
    queryFn: async (): Promise<CompanyMemberRow[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data: rows, error } = await supabase
        .from('company_memberships')
        .select('id, org_id, user_id, role, joined_at')
        .eq('org_id', orgId);
      if (error) throw error;
      if (!rows?.length) return [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles, error: pErr } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', ids);
      if (pErr) throw pErr;
      const byId = Object.fromEntries((profiles ?? []).map((p: { id: string; email: string; full_name: string | null }) => [p.id, p]));
      return rows.map((r: { id: string; org_id: string; user_id: string; role: string }) => {
        const p = byId[r.user_id];
        const email = p?.email ?? 'Unknown';
        const fullName = (p?.full_name && String(p.full_name).trim()) || null;
        return {
          id: r.id,
          org_id: r.org_id,
          user_id: r.user_id,
          role: r.role,
          users: {
            email,
            user_metadata: fullName ? { full_name: fullName } : {},
          },
        };
      });
    },
    enabled: !!orgId,
  });
}
