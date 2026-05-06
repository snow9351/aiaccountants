import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SuggestionTypeEnum } from '@/integrations/supabase/types';

export interface UncategorizedTransaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  type: 'debit' | 'credit';
  categorization_status: string;
  suggested_account_id: string | null;
  ai_confidence: number | null;
  bank_account_id: string;
}

const MOCK_UNCATEGORIZED: UncategorizedTransaction[] = [
  { id: 'tx-u1', date: '2024-04-05', description: 'AMAZON WEB SERVICES', merchant_name: 'Amazon Web Services', amount: 284.50, type: 'debit', categorization_status: 'ai_suggested', suggested_account_id: 'acc-6400', ai_confidence: 0.97, bank_account_id: 'ba-1' },
  { id: 'tx-u2', date: '2024-04-04', description: 'WEWORK 222 BROADWAY', merchant_name: 'WeWork', amount: 1800, type: 'debit', categorization_status: 'ai_suggested', suggested_account_id: 'acc-6200', ai_confidence: 0.94, bank_account_id: 'ba-1' },
  { id: 'tx-u3', date: '2024-04-03', description: 'SHELL OIL 0123456', merchant_name: 'Shell', amount: 67.40, type: 'debit', categorization_status: 'unreviewed', suggested_account_id: null, ai_confidence: null, bank_account_id: 'ba-1' },
  { id: 'tx-u4', date: '2024-04-02', description: 'TRANSFER FROM ACME INC', merchant_name: null, amount: 12400, type: 'credit', categorization_status: 'ai_suggested', suggested_account_id: 'acc-1100', ai_confidence: 0.81, bank_account_id: 'ba-1' },
  { id: 'tx-u5', date: '2024-04-01', description: 'GOOGLE ADS 123456789', merchant_name: 'Google Ads', amount: 1150, type: 'debit', categorization_status: 'ai_suggested', suggested_account_id: 'acc-6500', ai_confidence: 0.96, bank_account_id: 'ba-1' },
];

export function useUncategorizedTransactions(orgId?: string) {
  return useQuery({
    queryKey: ['uncategorized_transactions', orgId],
    queryFn: async (): Promise<UncategorizedTransaction[]> => {
      if (!isSupabaseConfigured) return MOCK_UNCATEGORIZED;
      const { data, error } = await supabase.from('bank_transactions')
        .select('*')
        .eq('org_id', orgId!)
        .in('categorization_status', ['unreviewed', 'ai_suggested'])
        .order('date', { ascending: false })
        .limit(100);
      if (error) return MOCK_UNCATEGORIZED;
      return data as UncategorizedTransaction[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_UNCATEGORIZED,
    refetchInterval: 30000,
  });
}

export function useRunAICategorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ org_id, transaction_ids }: { org_id: string; transaction_ids?: string[] }) => {
      if (!isSupabaseConfigured) {
        await new Promise(r => setTimeout(r, 1500));
        return { categorized: MOCK_UNCATEGORIZED.filter(t => !t.suggested_account_id).length };
      }
      const { data, error } = await supabase.functions.invoke('ai-categorize', { body: { org_id, transaction_ids } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uncategorized_transactions'] }),
  });
}

export function useConfirmCategorization() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ transaction_id, account_id, was_override }: { transaction_id: string; account_id: string; was_override: boolean }) => {
      if (!isSupabaseConfigured) return;
      await supabase.from('bank_transactions').update({
        account_id,
        categorization_status: 'confirmed',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as never).eq('id', transaction_id);
      // Record AI suggestion as accepted and write review metadata
      await supabase.from('ai_transaction_suggestions').update({
        was_accepted: !was_override,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as never).eq('source_entity_id', transaction_id)
        .eq('suggestion_type', 'categorization' as SuggestionTypeEnum);
      // Record override signal for training
      if (was_override) {
        await supabase.from('ai_categorization_signals').update({ confirmed_account_id: account_id, was_overridden: true }).eq('transaction_id', transaction_id);
      } else {
        await supabase.from('ai_categorization_signals').update({ confirmed_account_id: account_id }).eq('transaction_id', transaction_id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uncategorized_transactions'] }),
  });
}

export function useBulkConfirm() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ transaction_ids, org_id }: { transaction_ids: string[]; org_id: string }) => {
      if (!isSupabaseConfigured) return { confirmed: transaction_ids.length };
      // Bulk confirm high-confidence AI suggestions
      const { error } = await supabase.from('bank_transactions').update({
        categorization_status: 'confirmed',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as never).in('id', transaction_ids).gte('ai_confidence', 0.9);
      if (error) throw error;
      return { confirmed: transaction_ids.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uncategorized_transactions'] }),
  });
}
