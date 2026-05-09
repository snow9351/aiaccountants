import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

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

export function useTeamMembers(orgId?: string) {
  return useQuery({
    queryKey: ['team_members', orgId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!isSupabaseConfigured) return [];
      if (!orgId) return [];
      const { data, error } = await supabase.from('company_memberships').select('*').eq('org_id', orgId).order('role');
      if (error) throw error;
      return data as TeamMember[];
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
  return useMutation({
    mutationFn: async (input: { org_id: string; email: string; name: string; role: TeamMember['role'] }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('invitations').insert({
        org_id: input.org_id,
        email: input.email,
        role: input.role,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team_members'] }),
  });
}
