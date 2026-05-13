import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useCompanies';

export interface DashboardKPIs {
  revenue: number;
  revenueTrend: number;
  netProfit: number;
  netProfitTrend: number;
  expenses: number;
  expensesTrend: number;
  activeCustomers: number;
  customersTrend: number;
  cashBalance: number;
}

export interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export type CashFlowChartPoint = {
  month: string;
  income: number;
  expenses: number;
  forecast: number | null;
};

function padMonth(y: number, m0: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}`;
}

/** Rolling calendar months of income / expenses from bank_transactions (same source as Transactions page). */
export function buildCashFlowSeriesFromRows(
  rows: { date: string; amount: number; type: string }[],
  rollingMonths: number,
): CashFlowChartPoint[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = rollingMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(padMonth(d.getFullYear(), d.getMonth()));
  }

  const totals = new Map<string, { income: number; expenses: number }>();
  keys.forEach((k) => totals.set(k, { income: 0, expenses: 0 }));

  for (const t of rows) {
    const key = (t.date ?? '').slice(0, 7);
    const b = totals.get(key);
    if (!b) continue;
    if (t.type === 'transfer') continue;
    if (t.type === 'income') b.income += Math.max(0, Number(t.amount));
    else if (t.type === 'expense') b.expenses += Math.abs(Number(t.amount));
  }

  return keys.map((key) => {
    const d = new Date(key + '-01T12:00:00');
    const short = d.toLocaleString('default', { month: 'short' });
    const y = d.getFullYear();
    const repeatShort = keys.filter((k) => new Date(k + '-01T12:00:00').toLocaleString('default', { month: 'short' }) === short).length > 1;
    const label = repeatShort ? `${short} ${String(y).slice(-2)}` : short;
    const pair = totals.get(key)!;
    return { month: label, income: pair.income, expenses: pair.expenses, forecast: null };
  });
}

function summarizeTxMonth(
  rows: { amount: number; type: string }[],
): { revenue: number; expenses: number } {
  let revenue = 0;
  let expenses = 0;
  for (const t of rows) {
    if (t.type === 'transfer') continue;
    if (t.type === 'income') revenue += Math.max(0, Number(t.amount));
    else if (t.type === 'expense') expenses += Math.abs(Number(t.amount));
  }
  return { revenue, expenses };
}

function pctChange(prev: number, curr: number): number {
  if (prev <= 0 && curr <= 0) return 0;
  if (prev <= 0) return 100;
  return ((curr - prev) / prev) * 100;
}

export function useDashboardKPIs() {
  const orgId = useOrgId();

  return useQuery({
    queryKey: ['dashboard_kpis', orgId],
    enabled: isSupabaseConfigured && Boolean(orgId),
    queryFn: async (): Promise<DashboardKPIs> => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const monthStart = new Date(y, m, 1).toISOString().slice(0, 10);
      const prevMonthStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const prevMonthEnd = new Date(y, m, 0).toISOString().slice(0, 10);

      const [currTx, prevTx, customersRes, bankRes] = await Promise.all([
        supabase.from('bank_transactions').select('amount, type').eq('org_id', orgId).gte('date', monthStart),
        supabase
          .from('bank_transactions')
          .select('amount, type')
          .eq('org_id', orgId)
          .gte('date', prevMonthStart)
          .lte('date', prevMonthEnd),
        supabase.from('customers').select('id').eq('org_id', orgId).eq('is_active', true),
        supabase.from('bank_accounts').select('current_balance').eq('org_id', orgId).eq('account_type', 'checking'),
      ]);

      if (currTx.error) throw currTx.error;
      if (prevTx.error) throw prevTx.error;
      if (customersRes.error) throw customersRes.error;
      if (bankRes.error) throw bankRes.error;

      const cur = summarizeTxMonth(currTx.data ?? []);
      const prev = summarizeTxMonth(prevTx.data ?? []);

      const cashBalance = (bankRes.data ?? []).reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

      return {
        revenue: cur.revenue,
        revenueTrend: pctChange(prev.revenue, cur.revenue),
        expenses: cur.expenses,
        expensesTrend: pctChange(prev.expenses, cur.expenses),
        netProfit: cur.revenue - cur.expenses,
        netProfitTrend: pctChange(prev.revenue - prev.expenses, cur.revenue - cur.expenses),
        activeCustomers: (customersRes.data ?? []).length,
        customersTrend: 0,
        cashBalance,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useARAgingData() {
  const orgId = useOrgId();

  return useQuery({
    queryKey: ['ar_aging', orgId],
    enabled: isSupabaseConfigured && Boolean(orgId),
    queryFn: async (): Promise<ARAgingBucket[]> => {
      const today = new Date();
      const { data, error } = await supabase
        .from('invoices')
        .select('balance_due, due_date')
        .eq('org_id', orgId)
        .not('status', 'in', '("paid","cancelled","draft")')
        .gt('balance_due', 0);
      if (error) throw error;
      const buckets: ARAgingBucket[] = [
        { bucket: 'Current', amount: 0, count: 0 },
        { bucket: '1-30 days', amount: 0, count: 0 },
        { bucket: '31-60 days', amount: 0, count: 0 },
        { bucket: '61-90 days', amount: 0, count: 0 },
        { bucket: '90+ days', amount: 0, count: 0 },
      ];
      for (const inv of data ?? []) {
        const due = inv.due_date ? new Date(inv.due_date) : today;
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const idx = daysOverdue <= 0 ? 0 : daysOverdue <= 30 ? 1 : daysOverdue <= 60 ? 2 : daysOverdue <= 90 ? 3 : 4;
        buckets[idx].amount += Number(inv.balance_due ?? 0);
        buckets[idx].count += 1;
      }
      return buckets;
    },
  });
}

export function useCashFlowChartData() {
  const orgId = useOrgId();

  return useQuery({
    queryKey: ['cashflow_chart', orgId],
    enabled: isSupabaseConfigured && Boolean(orgId),
    queryFn: async (): Promise<CashFlowChartPoint[]> => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('date, amount, type')
        .eq('org_id', orgId)
        .gte('date', start)
        .order('date', { ascending: true });
      if (error) throw error;
      return buildCashFlowSeriesFromRows(data ?? [], 6);
    },
  });
}
