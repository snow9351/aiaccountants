import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'accountant' | 'bookkeeper' | 'read_only';
  status: 'active' | 'invited' | 'deactivated';
  last_active_at: string | null;
  invited_at: string;
}

export interface ClientRequest {
  id: string;
  org_id: string;
  title: string;
  description: string;
  requested_by: string;
  requested_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: 'question' | 'document_request' | 'review' | 'adjustment' | 'tax';
  created_at: string;
  resolved_at: string | null;
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: TeamMember['role'];
  expires_at: string;
  created_at: string;
  token: string;
}

function mapMembershipRow(
  m: {
    id: string;
    org_id: string;
    user_id: string;
    role: TeamMember['role'];
    joined_at: string;
  },
  profile?: { email?: string; full_name?: string | null } | null,
): TeamMember {
  const email = profile?.email ?? '';
  const name = (profile?.full_name && profile.full_name.trim()) || email || m.user_id.slice(0, 8);
  return {
    id: m.id,
    org_id: m.org_id,
    user_id: m.user_id,
    name,
    email,
    role: m.role,
    status: 'active',
    last_active_at: null,
    invited_at: m.joined_at,
  };
}

export function useTeamMembers(orgId?: string) {
  return useQuery({
    queryKey: ['team_members', orgId],
    queryFn: async (): Promise<TeamMember[]> => {
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
      const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => mapMembershipRow(r, map[r.user_id]));
    },
    enabled: !!orgId,
  });
}

export function usePendingInvitations(orgId?: string) {
  return useQuery({
    queryKey: ['pending_invitations', orgId],
    queryFn: async (): Promise<PendingInvitationRow[]> => {
      if (!isSupabaseConfigured || !orgId) return [];
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, expires_at, created_at, token')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingInvitationRow[];
    },
    enabled: !!orgId,
  });
}

export function useClientRequests(orgId?: string) {
  return useQuery({
    queryKey: ['client_requests', orgId],
    queryFn: async (): Promise<ClientRequest[]> => {
      if (!isSupabaseConfigured) return [];
      if (!orgId) return [];
      const { data, error } = await supabase.from('client_requests').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientRequest[];
    },
    enabled: !!orgId,
  });
}

export function useCreateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ClientRequest, 'id' | 'created_at' | 'resolved_at'>) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('client_requests').insert(input).select().single();
      if (error) throw error;
      return data as ClientRequest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client_requests'] }),
  });
}

export function useUpdateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientRequest> & { id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('client_requests').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client_requests'] }),
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      org_id: string;
      email: string;
      role: TeamMember['role'];
      firm_id?: string | null;
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      if (!user) throw new Error('You must be signed in to invite.');
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          org_id: input.org_id,
          firm_id: input.firm_id ?? null,
          invited_by: user.id,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as { id: string; token: string; email: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['pending_invitations'] });
    },
  });
}
