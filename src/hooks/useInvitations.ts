import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  token: string;
}

const MOCK_INVITATIONS: Invitation[] = [
  { id: 'inv-1', org_id: 'mock', email: 'accountant@firm.com', role: 'accountant', status: 'pending', expires_at: new Date(Date.now() + 5 * 86400000).toISOString(), created_at: new Date().toISOString(), token: 'mock-token-1' },
];

export function useInvitations(orgId?: string) {
  return useQuery({
    queryKey: ['invitations', orgId],
    queryFn: async (): Promise<Invitation[]> => {
      if (!isSupabaseConfigured) return MOCK_INVITATIONS;
      const { data, error } = await supabase.from('invitations').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (error) return MOCK_INVITATIONS;
      return data as Invitation[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_INVITATIONS,
  });
}

export function useSendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ org_id, email, role, invited_by }: { org_id: string; email: string; role: string; invited_by: string }) => {
      if (!isSupabaseConfigured) return { id: crypto.randomUUID(), email, role, status: 'pending' };
      // Check for existing pending invite
      const { data: existing } = await supabase.from('invitations').select('id').eq('org_id', org_id).eq('email', email).eq('status', 'pending').single();
      if (existing) throw new Error('An invitation is already pending for this email.');
      const { data, error } = await supabase.from('invitations').insert({ org_id, email, role, invited_by }).select().single();
      if (error) throw error;
      // In production: send email via Supabase Edge Function / Resend
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['invitations', vars.org_id] }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, org_id }: { id: string; org_id: string }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['invitations', vars.org_id] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (token: string) => {
      if (!isSupabaseConfigured) return { success: true };
      const { data: inv, error } = await supabase.from('invitations').select('*').eq('token', token).eq('status', 'pending').gt('expires_at', new Date().toISOString()).single();
      if (error || !inv) throw new Error('Invalid or expired invitation link.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to accept an invitation.');
      if (user.email !== inv.email) throw new Error('This invitation was sent to a different email address.');
      // Create membership
      await supabase.from('company_memberships').insert({ org_id: inv.org_id, user_id: user.id, role: inv.role, invited_by: inv.invited_by });
      await supabase.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv.id);
      return { org_id: inv.org_id, role: inv.role };
    },
  });
}
