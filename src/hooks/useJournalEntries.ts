import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { JournalEntry, JournalEntryLine, JournalEntryStatus } from '@/integrations/supabase/types';

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
  total_debits: number;
  total_credits: number;
}

export function useJournalEntries(filters?: { status?: JournalEntryStatus }) {
  return useQuery({
    queryKey: ['journal_entries', filters],
    queryFn: async (): Promise<JournalEntryWithLines[]> => {
      if (!isSupabaseConfigured) return [];
      let q = supabase
        .from('journal_entries')
        .select('*, journal_entry_lines(*)')
        .order('date', { ascending: false });
      if (filters?.status !== undefined) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data as (JournalEntry & { journal_entry_lines: JournalEntryLine[] })[]).map(je => ({
        ...je,
        lines: je.journal_entry_lines,
        total_debits: je.journal_entry_lines.reduce((s, l) => s + l.debit, 0),
        total_credits: je.journal_entry_lines.reduce((s, l) => s + l.credit, 0),
      }));
    },
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entry,
      lines,
    }: {
      entry: Partial<JournalEntry>;
      lines: Partial<JournalEntryLine>[];
    }) => {
      // Validate accounting equation
      const totalDebits = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
      const totalCredits = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Debits (${totalDebits}) must equal credits (${totalCredits})`);
      }
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const entryPayload = { ...entry, status: 'draft' as JournalEntryStatus };
      const { data: je, error: jeError } = await supabase
        .from('journal_entries')
        .insert(entryPayload as never)
        .select()
        .single();
      if (jeError) throw jeError;
      const linesWithId = lines.map((l, i) => ({ ...l, journal_entry_id: je.id, line_number: i + 1, org_id: entry.org_id ?? null }));
      const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesWithId as never);
      if (linesError) throw linesError;
      return je as JournalEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal_entries'] }),
  });
}

export function usePostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase
        .from('journal_entries')
        .update({ is_posted: true, status: 'posted' as JournalEntryStatus })
        .eq('id', id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal_entries'] }),
  });
}

export function useVoidJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, void_reason, voided_by }: { id: string; void_reason: string; voided_by?: string | null }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { error } = await supabase
        .from('journal_entries')
        .update({
          is_voided: true,
          status: 'voided' as JournalEntryStatus,
          void_reason,
          voided_by: voided_by ?? null,
          voided_at: new Date().toISOString(),
        } as never)
        .eq('id', id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal_entries'] }),
  });
}
