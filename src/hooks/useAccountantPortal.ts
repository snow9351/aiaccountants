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

const MOCK_MEMBERS: TeamMember[] = [
  { id: 'tm-1', org_id: 'mock', user_id: 'u-1', name: 'Jordan Davis', email: 'jordan@example.com', role: 'owner', status: 'active', last_active_at: '2024-04-05T16:30:00Z', invited_at: '2024-01-01T00:00:00Z' },
  { id: 'tm-2', org_id: 'mock', user_id: 'u-2', name: 'Sarah Chen, CPA', email: 'sarah@cpafirm.com', role: 'accountant', status: 'active', last_active_at: '2024-04-04T14:00:00Z', invited_at: '2024-01-15T10:00:00Z' },
  { id: 'tm-3', org_id: 'mock', user_id: 'u-3', name: 'Mike Rodriguez', email: 'mike@example.com', role: 'bookkeeper', status: 'active', last_active_at: '2024-04-05T11:00:00Z', invited_at: '2024-02-01T09:00:00Z' },
  { id: 'tm-4', org_id: 'mock', user_id: 'u-4', name: 'Alex Kim', email: 'alex@investor.vc', role: 'read_only', status: 'active', last_active_at: '2024-03-28T10:00:00Z', invited_at: '2024-03-01T08:00:00Z' },
  { id: 'tm-5', org_id: 'mock', user_id: 'u-5', name: 'Lisa Park', email: 'lisa@bookkeeping.co', role: 'bookkeeper', status: 'invited', last_active_at: null, invited_at: '2024-04-03T09:00:00Z' },
];

const MOCK_REQUESTS: ClientRequest[] = [
  { id: 'req-1', org_id: 'mock', title: 'Q1 tax documents needed', description: 'Please provide W-2s and 1099s for Q1 filing.', requested_by: 'u-2', requested_by_name: 'Sarah Chen, CPA', assigned_to: 'u-1', assigned_to_name: 'Jordan Davis', status: 'in_progress', priority: 'high', category: 'document_request', created_at: '2024-04-01T10:00:00Z', resolved_at: null },
  { id: 'req-2', org_id: 'mock', title: 'Unusual $15K expense on 3/15', description: 'Need clarification on the large payment to "TechVend Solutions" on March 15.', requested_by: 'u-2', requested_by_name: 'Sarah Chen, CPA', assigned_to: 'u-1', assigned_to_name: 'Jordan Davis', status: 'open', priority: 'medium', category: 'question', created_at: '2024-04-03T14:00:00Z', resolved_at: null },
  { id: 'req-3', org_id: 'mock', title: 'Review February journal entries', description: 'Two adjusting entries look incorrect. Please review JE-045 and JE-047.', requested_by: 'u-2', requested_by_name: 'Sarah Chen, CPA', assigned_to: 'u-3', assigned_to_name: 'Mike Rodriguez', status: 'open', priority: 'medium', category: 'review', created_at: '2024-04-02T09:00:00Z', resolved_at: null },
  { id: 'req-4', org_id: 'mock', title: 'Reclassify software subscriptions', description: 'Move Figma, Notion, and Slack from "Office Supplies" to "Software & SaaS".', requested_by: 'u-2', requested_by_name: 'Sarah Chen, CPA', assigned_to: 'u-3', assigned_to_name: 'Mike Rodriguez', status: 'resolved', priority: 'low', category: 'adjustment', created_at: '2024-03-28T11:00:00Z', resolved_at: '2024-03-30T16:00:00Z' },
  { id: 'req-5', org_id: 'mock', title: 'Estimated tax payment Q1', description: 'Confirm estimated tax payment amount for Q1 and send reminder.', requested_by: 'u-2', requested_by_name: 'Sarah Chen, CPA', assigned_to: 'u-1', assigned_to_name: 'Jordan Davis', status: 'resolved', priority: 'high', category: 'tax', created_at: '2024-03-20T08:00:00Z', resolved_at: '2024-03-25T17:00:00Z' },
];

export function useTeamMembers(orgId?: string) {
  return useQuery({
    queryKey: ['team_members', orgId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!isSupabaseConfigured) return MOCK_MEMBERS;
      const { data, error } = await supabase.from('company_memberships').select('*').eq('org_id', orgId!).order('role');
      if (error) return MOCK_MEMBERS;
      return data as TeamMember[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_MEMBERS,
  });
}

export function useClientRequests(orgId?: string) {
  return useQuery({
    queryKey: ['client_requests', orgId],
    queryFn: async (): Promise<ClientRequest[]> => {
      if (!isSupabaseConfigured) return MOCK_REQUESTS;
      const { data, error } = await supabase.from('client_requests').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) return MOCK_REQUESTS;
      return data as ClientRequest[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_REQUESTS,
  });
}

export function useCreateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ClientRequest, 'id' | 'created_at' | 'resolved_at'>) => {
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString(), resolved_at: null } as ClientRequest;
      }
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
      if (!isSupabaseConfigured) return;
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
      if (!isSupabaseConfigured) {
        return { ...input, id: crypto.randomUUID(), user_id: '', status: 'invited' as const, last_active_at: null, invited_at: new Date().toISOString() } as TeamMember;
      }
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
