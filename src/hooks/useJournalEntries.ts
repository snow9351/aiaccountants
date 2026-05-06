import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import type { JournalEntry, JournalEntryLine, JournalEntryStatus } from '@/integrations/supabase/types';

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
  total_debits: number;
  total_credits: number;
}

export const MOCK_JOURNAL_ENTRIES: JournalEntryWithLines[] = [
  {
    id: 'je-1', org_id: 'mock', entry_number: 'JE-2024-001', date: '2024-04-01',
    description: 'Acme Corp invoice payment received', reference: 'INV-2024-001',
    is_posted: true, status: 'posted', is_voided: false, period_closed: false,
    voided_by: null, voided_at: null, void_reason: null,
    created_by: null, prev_hash: null, entry_hash: 'abc123',
    created_at: '2024-04-01T10:00:00Z', updated_at: '2024-04-01T10:00:00Z',
    lines: [
      { id: 'jel-1a', journal_entry_id: 'je-1', account_id: 'acc-1010', debit: 12400, credit: 0, description: 'Cash received', line_number: 1, org_id: 'mock', is_voided: false, created_at: '2024-04-01T10:00:00Z', updated_at: null },
      { id: 'jel-1b', journal_entry_id: 'je-1', account_id: 'acc-1100', debit: 0, credit: 12400, description: 'AR cleared', line_number: 2, org_id: 'mock', is_voided: false, created_at: '2024-04-01T10:00:00Z', updated_at: null },
    ],
    total_debits: 12400, total_credits: 12400,
  },
  {
    id: 'je-2', org_id: 'mock', entry_number: 'JE-2024-002', date: '2024-04-01',
    description: 'AWS infrastructure charge', reference: 'AWS-2024-04',
    is_posted: true, status: 'posted', is_voided: false, period_closed: false,
    voided_by: null, voided_at: null, void_reason: null,
    created_by: null, prev_hash: 'abc123', entry_hash: 'def456',
    created_at: '2024-04-01T00:00:00Z', updated_at: '2024-04-01T00:00:00Z',
    lines: [
      { id: 'jel-2a', journal_entry_id: 'je-2', account_id: 'acc-6400', debit: 2840, credit: 0, description: 'Software subscription', line_number: 1, org_id: 'mock', is_voided: false, created_at: '2024-04-01T00:00:00Z', updated_at: null },
      { id: 'jel-2b', journal_entry_id: 'je-2', account_id: 'acc-2000', debit: 0, credit: 2840, description: 'AP - AWS', line_number: 2, org_id: 'mock', is_voided: false, created_at: '2024-04-01T00:00:00Z', updated_at: null },
    ],
    total_debits: 2840, total_credits: 2840,
  },
  {
    id: 'je-3', org_id: 'mock', entry_number: 'JE-2024-003', date: '2024-03-31',
    description: 'WeWork office space - March', reference: 'WW-MAR-2024',
    is_posted: false, status: 'draft', is_voided: false, period_closed: false,
    voided_by: null, voided_at: null, void_reason: null,
    created_by: null, prev_hash: 'def456', entry_hash: null,
    created_at: '2024-03-31T00:00:00Z', updated_at: '2024-03-31T00:00:00Z',
    lines: [
      { id: 'jel-3a', journal_entry_id: 'je-3', account_id: 'acc-6200', debit: 1800, credit: 0, description: 'Office rent', line_number: 1, org_id: 'mock', is_voided: false, created_at: '2024-03-31T00:00:00Z', updated_at: null },
      { id: 'jel-3b', journal_entry_id: 'je-3', account_id: 'acc-2000', debit: 0, credit: 1800, description: 'AP - WeWork', line_number: 2, org_id: 'mock', is_voided: false, created_at: '2024-03-31T00:00:00Z', updated_at: null },
    ],
    total_debits: 1800, total_credits: 1800,
  },
];

export function useJournalEntries(filters?: { status?: JournalEntryStatus }) {
  return useQuery({
    queryKey: ['journal_entries', filters],
    queryFn: async (): Promise<JournalEntryWithLines[]> => {
      if (!isSupabaseConfigured) {
        if (filters?.status !== undefined) {
          return MOCK_JOURNAL_ENTRIES.filter(je => je.status === filters.status);
        }
        return MOCK_JOURNAL_ENTRIES;
      }
      let q = supabase
        .from('journal_entries')
        .select('*, journal_entry_lines(*)')
        .order('date', { ascending: false });
      if (filters?.status !== undefined) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) return MOCK_JOURNAL_ENTRIES;
      return (data as (JournalEntry & { journal_entry_lines: JournalEntryLine[] })[]).map(je => ({
        ...je,
        lines: je.journal_entry_lines,
        total_debits: je.journal_entry_lines.reduce((s, l) => s + l.debit, 0),
        total_credits: je.journal_entry_lines.reduce((s, l) => s + l.credit, 0),
      }));
    },
    placeholderData: MOCK_JOURNAL_ENTRIES,
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
      if (!isSupabaseConfigured) {
        const id = crypto.randomUUID();
        return {
          ...entry,
          id,
          status: 'draft' as JournalEntryStatus,
          is_voided: false,
          period_closed: false,
          lines: lines.map((l, i) => ({ ...l, id: crypto.randomUUID(), journal_entry_id: id, line_number: i + 1, org_id: entry.org_id ?? null, is_voided: false, created_at: new Date().toISOString(), updated_at: null })) as JournalEntryLine[],
          total_debits: totalDebits,
          total_credits: totalCredits,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as JournalEntryWithLines;
      }
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
      if (!isSupabaseConfigured) return { id };
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
      if (!isSupabaseConfigured) return { id };
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
