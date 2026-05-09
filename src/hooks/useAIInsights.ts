import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { AIAlert, Anomaly } from '@/integrations/supabase/types';

export function useAIAlerts(showDismissed = false) {
  return useQuery({
    queryKey: ['ai_alerts', showDismissed],
    queryFn: async (): Promise<AIAlert[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase.from('ai_alerts').select('*').order('created_at', { ascending: false });
      if (!showDismissed) q = q.eq('is_dismissed', false);
      const { data, error } = await q;
      if (error) throw error;
      return data as AIAlert[];
    },
    refetchInterval: 60000, // refresh every minute
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
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
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('anomalies_detected')
        .select('*')
        .eq('was_reviewed', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Anomaly[];
    },
  });
}
