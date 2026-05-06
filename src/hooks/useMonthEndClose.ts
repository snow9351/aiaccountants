import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface CloseChecklist {
  id: string;
  org_id: string;
  period: string; // e.g. "2024-03"
  status: 'open' | 'in_review' | 'closed';
  started_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
}

export interface CloseTask {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  category: 'bank' | 'receivables' | 'payables' | 'payroll' | 'accruals' | 'review';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
}

const DEFAULT_TASKS: Omit<CloseTask, 'id' | 'checklist_id' | 'completed_at' | 'completed_by' | 'assigned_to'>[] = [
  { title: 'Reconcile all bank accounts', description: 'Verify all bank accounts are reconciled and statements match.', category: 'bank', status: 'pending', sort_order: 1 },
  { title: 'Review uncleared transactions', description: 'Investigate any outstanding uncleared checks or deposits.', category: 'bank', status: 'pending', sort_order: 2 },
  { title: 'Send overdue invoice reminders', description: 'Follow up on all invoices past due date.', category: 'receivables', status: 'pending', sort_order: 3 },
  { title: 'Write off uncollectible receivables', description: 'Identify and write off bad debts for the period.', category: 'receivables', status: 'pending', sort_order: 4 },
  { title: 'Review and approve pending bills', description: 'Ensure all vendor bills are entered and approved.', category: 'payables', status: 'pending', sort_order: 5 },
  { title: 'Verify vendor statement balances', description: 'Cross-check vendor statements with AP aging.', category: 'payables', status: 'pending', sort_order: 6 },
  { title: 'Process payroll for the period', description: 'Run payroll and verify all entries posted correctly.', category: 'payroll', status: 'pending', sort_order: 7 },
  { title: 'Post payroll tax liabilities', description: 'Record employer payroll tax obligations.', category: 'payroll', status: 'pending', sort_order: 8 },
  { title: 'Record prepaid expense amortization', description: 'Post monthly amortization for prepaid expenses.', category: 'accruals', status: 'pending', sort_order: 9 },
  { title: 'Accrue unbilled revenue', description: 'Record revenue earned but not yet invoiced.', category: 'accruals', status: 'pending', sort_order: 10 },
  { title: 'Accrue outstanding expenses', description: 'Record expenses incurred but not yet billed.', category: 'accruals', status: 'pending', sort_order: 11 },
  { title: 'Record depreciation entries', description: 'Post monthly depreciation for fixed assets.', category: 'accruals', status: 'pending', sort_order: 12 },
  { title: 'Review trial balance', description: 'Verify debits equal credits and accounts are reasonable.', category: 'review', status: 'pending', sort_order: 13 },
  { title: 'Run P&L and balance sheet', description: 'Generate and review financial statements for accuracy.', category: 'review', status: 'pending', sort_order: 14 },
  { title: 'Review intercompany balances', description: 'Verify intercompany accounts net to zero.', category: 'review', status: 'pending', sort_order: 15 },
  { title: 'Final review and sign-off', description: 'Controller/CFO reviews and approves the close.', category: 'review', status: 'pending', sort_order: 16 },
];

const MOCK_CHECKLISTS: CloseChecklist[] = [
  { id: 'cl-1', org_id: 'mock', period: '2024-02', status: 'closed', started_at: '2024-03-01T09:00:00Z', closed_at: '2024-03-05T17:00:00Z', closed_by: 'user-1', notes: 'Clean close, no adjustments needed.' },
  { id: 'cl-2', org_id: 'mock', period: '2024-03', status: 'in_review', started_at: '2024-04-01T09:00:00Z', closed_at: null, closed_by: null, notes: null },
];

const MOCK_TASKS: CloseTask[] = DEFAULT_TASKS.map((t, i) => ({
  ...t,
  id: `ct-${i + 1}`,
  checklist_id: 'cl-2',
  assigned_to: null,
  completed_at: i < 8 ? '2024-04-03T12:00:00Z' : null,
  completed_by: i < 8 ? 'user-1' : null,
  status: i < 8 ? 'completed' as const : 'pending' as const,
}));

export function useCloseChecklists(orgId?: string) {
  return useQuery({
    queryKey: ['close_checklists', orgId],
    queryFn: async (): Promise<CloseChecklist[]> => {
      if (!isSupabaseConfigured) return MOCK_CHECKLISTS;
      const { data, error } = await supabase.from('close_checklists').select('*').eq('org_id', orgId!).order('period', { ascending: false });
      if (error) return MOCK_CHECKLISTS;
      return data as CloseChecklist[];
    },
    enabled: !!orgId,
    placeholderData: MOCK_CHECKLISTS,
  });
}

export function useCloseTasks(checklistId?: string) {
  return useQuery({
    queryKey: ['close_tasks', checklistId],
    queryFn: async (): Promise<CloseTask[]> => {
      if (!isSupabaseConfigured) return MOCK_TASKS.filter(t => t.checklist_id === checklistId);
      const { data, error } = await supabase.from('close_tasks').select('*').eq('checklist_id', checklistId!).order('sort_order');
      if (error) return MOCK_TASKS.filter(t => t.checklist_id === checklistId);
      return data as CloseTask[];
    },
    enabled: !!checklistId,
    placeholderData: MOCK_TASKS,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { org_id: string; period: string }) => {
      if (!isSupabaseConfigured) {
        const checklist: CloseChecklist = { id: crypto.randomUUID(), ...input, status: 'open', started_at: new Date().toISOString(), closed_at: null, closed_by: null, notes: null };
        return checklist;
      }
      const { data, error } = await supabase.from('close_checklists').insert({ ...input, status: 'open', started_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      // Create default tasks
      const tasks = DEFAULT_TASKS.map(t => ({ ...t, checklist_id: data.id }));
      await supabase.from('close_tasks').insert(tasks);
      return data as CloseChecklist;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['close_checklists'] }),
  });
}

export function useUpdateCloseTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CloseTask> & { id: string }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('close_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['close_tasks'] });
    },
  });
}

export function useCloseMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from('close_checklists').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        notes,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['close_checklists'] }),
  });
}

export { DEFAULT_TASKS };
