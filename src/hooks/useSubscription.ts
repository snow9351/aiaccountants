import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_annually: number;
  max_companies: number;
  max_users: number;
  features: Record<string, boolean>;
}

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  dunning_count: number;
  dunning_grace_until: string | null;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<Plan[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase.from('plans').select('*').eq('is_active', true).order('price_monthly');
      if (error) throw error;
      return data as Plan[];
    },
    staleTime: Infinity,
  });
}

export function useSubscription(orgId?: string) {
  return useQuery({
    queryKey: ['subscription', orgId],
    queryFn: async (): Promise<Subscription | null> => {
      if (!isSupabaseConfigured) return null;
      const { data, error } = await supabase.from('subscriptions').select('*').eq('org_id', orgId!).eq('status', 'active').single();
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!orgId,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async ({ plan, billing_interval, org_id, user_id }: { plan: string; billing_interval: string; org_id: string; user_id: string }) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.');
      }
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan, billing_interval, org_id, user_id },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async (orgId: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.functions.invoke('create-portal-session', { body: { org_id: orgId } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    },
  });
}
