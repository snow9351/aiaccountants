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

const MOCK_PLANS: Plan[] = [
  { id: '1', name: 'starter', display_name: 'Starter', price_monthly: 1900, price_annually: 19000, max_companies: 1, max_users: 2, features: { invoicing: true, expenses: true, banking: true, reports: true } },
  { id: '2', name: 'pro', display_name: 'Pro', price_monthly: 3900, price_annually: 39000, max_companies: 3, max_users: 5, features: { invoicing: true, expenses: true, banking: true, reports: true, payroll: true, projects: true, budgets: true, ai_categorization: true } },
  { id: '3', name: 'accountant', display_name: 'Accountant', price_monthly: 7900, price_annually: 79000, max_companies: 10, max_users: 15, features: { invoicing: true, expenses: true, banking: true, reports: true, payroll: true, projects: true, budgets: true, ai_categorization: true, firm_access: true, client_management: true } },
  { id: '4', name: 'firm', display_name: 'Firm', price_monthly: 14900, price_annually: 149000, max_companies: 99, max_users: 99, features: { invoicing: true, expenses: true, banking: true, reports: true, payroll: true, projects: true, budgets: true, ai_categorization: true, firm_access: true, client_management: true, white_label: true } },
];

const MOCK_SUB: Subscription = {
  id: 'sub-mock', plan: 'pro', status: 'trialing',
  current_period_end: new Date(Date.now() + 14 * 86400000).toISOString(),
  trial_end: new Date(Date.now() + 14 * 86400000).toISOString(),
  cancel_at_period_end: false, dunning_count: 0, dunning_grace_until: null,
  payment_method_last4: null, payment_method_brand: null,
};

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<Plan[]> => {
      if (!isSupabaseConfigured) return MOCK_PLANS;
      const { data, error } = await supabase.from('plans').select('*').eq('is_active', true).order('price_monthly');
      if (error) return MOCK_PLANS;
      return data as Plan[];
    },
    placeholderData: MOCK_PLANS,
    staleTime: Infinity,
  });
}

export function useSubscription(orgId?: string) {
  return useQuery({
    queryKey: ['subscription', orgId],
    queryFn: async (): Promise<Subscription | null> => {
      if (!isSupabaseConfigured) return MOCK_SUB;
      const { data, error } = await supabase.from('subscriptions').select('*').eq('org_id', orgId!).eq('status', 'active').single();
      if (error) return MOCK_SUB;
      return data as Subscription;
    },
    enabled: !!orgId,
    placeholderData: MOCK_SUB,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async ({ plan, billing_interval, org_id, user_id }: { plan: string; billing_interval: string; org_id: string; user_id: string }) => {
      if (!isSupabaseConfigured) {
        window.alert('Demo mode: Stripe not configured. In production, this redirects to Stripe Checkout.');
        return;
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
      if (!isSupabaseConfigured) { window.alert('Demo mode: Stripe portal not available.'); return; }
      const { data, error } = await supabase.functions.invoke('create-portal-session', { body: { org_id: orgId } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    },
  });
}
