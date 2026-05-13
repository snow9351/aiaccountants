import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { mergePlansWithStripePriceEnv, PRICING_PLAN_NAMES } from '@/lib/stripePlanPriceIds';

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_annually: number;
  max_companies: number;
  max_users: number;
  features: Record<string, boolean>;
  /** Set in DB for Stripe Checkout; checkout is disabled for that plan until present. */
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annually?: string | null;
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
  const priceIdEnv = import.meta.env.VITE_STRIPE_PLAN_PRICE_IDS ?? '';
  return useQuery({
    // Include env so React Query refetches after .env changes (staleTime is Infinity).
    queryKey: ['plans', priceIdEnv],
    queryFn: async (): Promise<Plan[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('plans')
        .select(
          'id, name, display_name, price_monthly, price_annually, max_companies, max_users, features, stripe_price_id_monthly, stripe_price_id_annually, is_active',
        )
        .eq('is_active', true)
        .in('name', [...PRICING_PLAN_NAMES])
        .order('price_monthly');
      if (error) throw error;
      const rows = data as Plan[];
      return mergePlansWithStripePriceEnv(rows, priceIdEnv || undefined);
    },
    // Plans change rarely in DB, but Infinity hid Supabase edits until a full tab reload.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSubscription(orgId?: string, queryEnabled = true) {
  return useQuery({
    queryKey: ['subscription', orgId, queryEnabled],
    queryFn: async (): Promise<Subscription | null> => {
      if (!isSupabaseConfigured) return null;
      const { data, error } = await supabase.from('subscriptions').select('*').eq('org_id', orgId!).eq('status', 'active').single();
      if (error) throw error;
      return data as Subscription;
    },
    enabled: !!orgId && queryEnabled,
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
