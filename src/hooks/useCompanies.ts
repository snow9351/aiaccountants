import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { FiscalPeriod } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyStore } from '@/stores/companyStore';
import { useEffect } from 'react';

export { useCompanyStore } from '@/stores/companyStore';

/** Active org for data queries. Resolves from `my_companies` so we never query with a stale persisted id before the list loads. */
export function useOrgId(): string {
  const { activeOrgId, setActiveOrgId } = useCompanyStore();
  const { data: companies, isFetched } = useCompanies();
  const list = companies ?? [];

  const resolved = (() => {
    if (!isFetched) return "";
    if (list.length === 0) return "";
    if (activeOrgId && list.some((c) => c.id === activeOrgId)) return activeOrgId;
    return list[0]!.id;
  })();

  useEffect(() => {
    if (!isFetched || list.length === 0) return;
    const activeOk = Boolean(activeOrgId) && list.some((c) => c.id === activeOrgId);
    if (!activeOk) setActiveOrgId(list[0]!.id);
  }, [isFetched, list, activeOrgId, setActiveOrgId]);

  return resolved;
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
  /** When false, GL accounts may omit account numbers (company preference). */
  require_account_numbers?: boolean;
}

/** DB uses `tax_id`; UI uses `ein`. */
export function mapOrganizationRow(org: Record<string, unknown>, role?: string): Company {
  const taxId = org.tax_id;
  const legacyEin = org.ein;
  const id = String(org.id);
  const rawName = String(org.name ?? '').trim();
  const safeName = rawName || `Company ${id.slice(0, 8)}`;
  return {
    id,
    name: safeName,
    entity_type: (org.entity_type as string) ?? 'llc',
    accounting_method: (org.accounting_method as string) ?? 'cash',
    fiscal_year_start: typeof org.fiscal_year_start === 'number' ? org.fiscal_year_start : Number(org.fiscal_year_start ?? 1) || 1,
    timezone: (org.timezone as string) ?? 'America/New_York',
    ein: typeof legacyEin === 'string' ? legacyEin : typeof taxId === 'string' ? taxId : null,
    plan: String(org.plan ?? 'starter'),
    subscription_status: String(org.subscription_status ?? 'trialing'),
    trial_ends_at: typeof org.trial_ends_at === 'string' ? org.trial_ends_at : null,
    logo_url: typeof org.logo_url === 'string' ? org.logo_url : null,
    require_account_numbers:
      typeof org.require_account_numbers === 'boolean' ? org.require_account_numbers : true,
    role,
  };
}

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['companies', user?.id],
    enabled: Boolean(user?.id) && isSupabaseConfigured,
    queryFn: async (): Promise<Company[]> => {
      if (!isSupabaseConfigured || !user) return [];
      // Prefer single RPC to avoid PostgREST embed + RLS edge cases.
      const { data, error } = await supabase.rpc('my_companies');
      if (error) throw error;
      return (data ?? []).map((row) =>
        mapOrganizationRow(
          {
            id: row.id,
            name: row.name,
            entity_type: row.entity_type,
            accounting_method: row.accounting_method,
            fiscal_year_start: row.fiscal_year_start,
            timezone: row.timezone,
            tax_id: row.tax_id,
            plan: row.plan,
            subscription_status: row.subscription_status,
            trial_ends_at: row.trial_ends_at,
            logo_url: row.logo_url,
            require_account_numbers: row.require_account_numbers,
          },
          row.role
        )
      );
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      entity_type: string;
      accounting_method: string;
      industry?: string;
      fiscal_year_start?: number;
      timezone?: string;
      ein?: string;
    }) => {
      if (!isSupabaseConfigured) return { ...input, id: crypto.randomUUID() } as Company;
      if (!user) throw new Error('You must be signed in to create a company.');
      const { data: orgId, error } = await supabase.rpc('create_company', {
        p_legal_name: input.name.trim(),
        p_tax_id: input.ein?.trim() || null,
        p_entity_type: input.entity_type,
        p_accounting_method: input.accounting_method,
        p_industry: input.industry?.trim() || 'general',
        p_fiscal_year_start_month: input.fiscal_year_start ?? 1,
        p_timezone: input.timezone?.trim() || 'America/New_York',
      });
      if (error) throw error;

      // Refresh companies list and let UI select active org from refreshed data.
      await qc.invalidateQueries({ queryKey: ['companies'] });
      await qc.invalidateQueries({ queryKey: ['fiscal_periods'] });

      // Best-effort: if the org is visible via RLS, map it; otherwise return minimal.
      const { data: org, error: orgErr } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
      if (orgErr || !org) return { id: String(orgId), name: input.name.trim() } as Company;
      return mapOrganizationRow(org as Record<string, unknown>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['fiscal_periods'] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
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

export function useFiscalPeriods(orgId?: string) {
  return useQuery({
    queryKey: ['fiscal_periods', orgId],
    queryFn: async (): Promise<FiscalPeriod[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase
        .from('periods')
        .select('id, org_id, fiscal_year, period_number, period_start, period_end, status, created_at')
        .eq('org_id', orgId)
        .order('fiscal_year', { ascending: true })
        .order('period_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FiscalPeriod[];
    },
    enabled: !!orgId,
  });
}
