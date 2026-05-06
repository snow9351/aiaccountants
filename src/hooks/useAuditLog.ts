import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { AuditEvent } from '@/integrations/supabase/types';

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'ae-1', org_id: 'mock', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-id', actor_type: 'user', actor_name: 'jordan@connectcash.ai',
    action: 'update', target_table: 'invoices', target_id: 'inv-1',
    target_description: 'Updated invoice INV-2024-001 status to sent',
    old_value: { status: 'draft' }, new_value: { status: 'sent' },
    ai_confidence: null, is_flagged: false, ip_address: '192.168.1.1',
  },
  {
    id: 'ae-2', org_id: 'mock', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    actor_id: null, actor_type: 'ai', actor_name: 'ConnectCash AI',
    action: 'ai_apply', target_table: 'expenses', target_id: 'exp-1',
    target_description: 'Auto-categorized AWS expense as "Software & Subscriptions" (97% confidence)',
    old_value: { category: null }, new_value: { category: 'Software & Subscriptions' },
    ai_confidence: 0.97, is_flagged: false, ip_address: null,
  },
  {
    id: 'ae-3', org_id: 'mock', timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-id', actor_type: 'user', actor_name: 'jordan@connectcash.ai',
    action: 'create', target_table: 'customers', target_id: 'cust-1',
    target_description: 'Created customer: Acme Corporation',
    old_value: null, new_value: { name: 'Acme Corporation', email: 'billing@acme.com' },
    ai_confidence: null, is_flagged: false, ip_address: '192.168.1.1',
  },
  {
    id: 'ae-4', org_id: 'mock', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actor_id: null, actor_type: 'ai', actor_name: 'ConnectCash AI',
    action: 'ai_suggest', target_table: 'expenses', target_id: 'exp-2',
    target_description: 'Anomaly: AWS charge 47% above 3-month average — flagged for review',
    old_value: null, new_value: { anomaly_score: 0.87, type: 'unusual_amount' },
    ai_confidence: 0.87, is_flagged: true, ip_address: null,
  },
  {
    id: 'ae-5', org_id: 'mock', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-id', actor_type: 'user', actor_name: 'jordan@connectcash.ai',
    action: 'create', target_table: 'invoices', target_id: 'inv-5',
    target_description: 'Created invoice INV-2024-005 for CloudBase Inc ($3,456)',
    old_value: null, new_value: { invoice_number: 'INV-2024-005', total: 3456 },
    ai_confidence: null, is_flagged: false, ip_address: '192.168.1.1',
  },
  {
    id: 'ae-6', org_id: 'mock', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    actor_id: null, actor_type: 'system', actor_name: 'System',
    action: 'ai_apply', target_table: 'bank_transactions', target_id: null,
    target_description: 'Bank sync completed: 12 new transactions imported from Chase ****4521',
    old_value: null, new_value: { transaction_count: 12, bank_account: 'Chase ****4521' },
    ai_confidence: null, is_flagged: false, ip_address: null,
  },
  {
    id: 'ae-7', org_id: 'mock', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-id', actor_type: 'user', actor_name: 'jordan@connectcash.ai',
    action: 'update', target_table: 'invoices', target_id: 'inv-3',
    target_description: 'Recorded payment for INV-2024-003: $24,600 from Meridian Partners',
    old_value: { amount_paid: 0, status: 'sent' }, new_value: { amount_paid: 24600, status: 'paid' },
    ai_confidence: null, is_flagged: false, ip_address: '192.168.1.1',
  },
];

export function useAuditLog(limit = 100) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('audit_log_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (payload) => {
        qc.setQueryData(['audit_log', limit], (old: AuditEvent[] = []) =>
          [payload.new as AuditEvent, ...old].slice(0, limit)
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, limit]);

  return useQuery({
    queryKey: ['audit_log', limit],
    queryFn: async (): Promise<AuditEvent[]> => {
      if (!isSupabaseConfigured) return MOCK_AUDIT_EVENTS;
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) return MOCK_AUDIT_EVENTS;
      return data as AuditEvent[];
    },
    placeholderData: MOCK_AUDIT_EVENTS,
  });
}
