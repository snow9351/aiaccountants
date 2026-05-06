import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { AIAlert, Anomaly } from '@/integrations/supabase/types';

export const MOCK_AI_ALERTS: AIAlert[] = [
  {
    id: '1', org_id: 'mock', type: 'anomaly', priority: 'high',
    title: 'Unusual AWS Charges Detected',
    description: 'Your AWS bill this month ($2,840) is 47% higher than your 3-month average ($1,932). This could indicate unused resources or a new service deployment.',
    action_label: 'Review Expenses', action_url: '/expenses',
    is_dismissed: false, dismissed_at: null, related_table: 'expenses', related_id: '1',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2', org_id: 'mock', type: 'warning', priority: 'high',
    title: '3 Invoices Overdue 30+ Days',
    description: 'Invoices from Vertex Industries ($15,600) and TechFlow Solutions ($8,750) are significantly overdue. Total at-risk AR: $24,350.',
    action_label: 'View Invoices', action_url: '/invoices',
    is_dismissed: false, dismissed_at: null, related_table: 'invoices', related_id: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3', org_id: 'mock', type: 'forecast', priority: 'medium',
    title: 'Cash Flow Positive for Q2',
    description: 'Based on current invoicing patterns and expense trends, your cash flow is projected to be +$18,400 for Q2 2024. You have 87 days of runway.',
    action_label: 'View Reports', action_url: '/reports',
    is_dismissed: false, dismissed_at: null, related_table: null, related_id: null,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4', org_id: 'mock', type: 'optimization', priority: 'medium',
    title: 'Potential Tax Deduction Opportunity',
    description: 'You have $4,100 in travel expenses this quarter that may qualify for tax deductions. Ensure receipts are attached and categorized correctly.',
    action_label: 'Review Expenses', action_url: '/expenses',
    is_dismissed: false, dismissed_at: null, related_table: null, related_id: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5', org_id: 'mock', type: 'insight', priority: 'low',
    title: 'Top Customer Concentration Risk',
    description: 'Meridian Partners accounts for 39% of your revenue. Consider diversifying your customer base to reduce concentration risk.',
    action_label: 'View Customers', action_url: '/customers',
    is_dismissed: false, dismissed_at: null, related_table: 'customers', related_id: '3',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6', org_id: 'mock', type: 'warning', priority: 'medium',
    title: '6 Transactions Need Categorization',
    description: 'AI confidence is below 70% for 6 recent transactions totaling $1,842. Manual review will improve future categorization accuracy.',
    action_label: 'Review Transactions', action_url: '/transactions',
    is_dismissed: false, dismissed_at: null, related_table: 'bank_transactions', related_id: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7', org_id: 'mock', type: 'insight', priority: 'low',
    title: 'Q1 Revenue Up 23% YoY',
    description: 'Great news — Q1 2024 revenue of $161,000 represents a 23% increase over Q1 2023. Net margin improved from 28% to 34%.',
    action_label: 'View Reports', action_url: '/reports',
    is_dismissed: false, dismissed_at: null, related_table: null, related_id: null,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_ANOMALIES: Anomaly[] = [
  {
    id: 'an1', org_id: 'mock', anomaly_type: 'unusual_amount',
    severity: 'high', description: 'AWS charge 47% above average',
    source_entity_id: '1', source_entity_type: 'expenses',
    anomaly_score: 0.87, was_reviewed: false, user_action: null,
    created_at: new Date().toISOString(),
  },
];

export function useAIAlerts(showDismissed = false) {
  return useQuery({
    queryKey: ['ai_alerts', showDismissed],
    queryFn: async (): Promise<AIAlert[]> => {
      if (!isSupabaseConfigured) {
        return showDismissed ? MOCK_AI_ALERTS : MOCK_AI_ALERTS.filter(a => !a.is_dismissed);
      }
      let q = supabase.from('ai_alerts').select('*').order('created_at', { ascending: false });
      if (!showDismissed) q = q.eq('is_dismissed', false);
      const { data, error } = await q;
      if (error) return MOCK_AI_ALERTS;
      return data as AIAlert[];
    },
    placeholderData: MOCK_AI_ALERTS,
    refetchInterval: 60000, // refresh every minute
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) return { id };
      const { error } = await supabase
        .from('ai_alerts')
        .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai_alerts'] }),
  });
}

export function useAnomalies() {
  return useQuery({
    queryKey: ['anomalies'],
    queryFn: async (): Promise<Anomaly[]> => {
      if (!isSupabaseConfigured) return MOCK_ANOMALIES;
      const { data, error } = await supabase
        .from('anomalies_detected')
        .select('*')
        .eq('was_reviewed', false)
        .order('created_at', { ascending: false });
      if (error) return MOCK_ANOMALIES;
      return data as Anomaly[];
    },
    placeholderData: MOCK_ANOMALIES,
  });
}
