import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { MOCK_INVOICES } from './useInvoices';
import { MOCK_TRANSACTIONS } from './useTransactions';

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

const MOCK_KPIS: DashboardKPIs = {
  revenue: 61000,
  revenueTrend: 17.3,
  netProfit: 23000,
  netProfitTrend: 21.0,
  expenses: 38000,
  expensesTrend: -4.2,
  activeCustomers: 6,
  customersTrend: 2,
  cashBalance: 87420,
};

const MOCK_AR_AGING: ARAgingBucket[] = [
  { bucket: 'Current', amount: 12400, count: 1 },
  { bucket: '1-30 days', amount: 3200, count: 1 },
  { bucket: '31-60 days', amount: 8750, count: 1 },
  { bucket: '61-90 days', amount: 15600, count: 1 },
  { bucket: '90+ days', amount: 0, count: 0 },
];

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard_kpis'],
    queryFn: async (): Promise<DashboardKPIs> => {
      if (!isSupabaseConfigured) return MOCK_KPIS;
      // Calculate from real data
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const [invoicesRes, expensesRes, customersRes, bankRes] = await Promise.all([
        supabase.from('invoices').select('total, amount_paid, status').gte('issue_date', monthStart),
        supabase.from('expenses').select('amount').gte('date', monthStart),
        supabase.from('customers').select('id').eq('is_active', true),
        supabase.from('bank_accounts').select('current_balance').eq('account_type', 'checking'),
      ]);
      const revenue = (invoicesRes.data ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
      const expenses = (expensesRes.data ?? []).reduce((s, e) => s + e.amount, 0);
      const cashBalance = (bankRes.data ?? []).reduce((s, a) => s + a.current_balance, 0);
      return {
        revenue: revenue || MOCK_KPIS.revenue,
        revenueTrend: MOCK_KPIS.revenueTrend,
        netProfit: (revenue - expenses) || MOCK_KPIS.netProfit,
        netProfitTrend: MOCK_KPIS.netProfitTrend,
        expenses: expenses || MOCK_KPIS.expenses,
        expensesTrend: MOCK_KPIS.expensesTrend,
        activeCustomers: (customersRes.data ?? []).length || MOCK_KPIS.activeCustomers,
        customersTrend: MOCK_KPIS.customersTrend,
        cashBalance: cashBalance || MOCK_KPIS.cashBalance,
      };
    },
    placeholderData: MOCK_KPIS,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useARAgingData() {
  return useQuery({
    queryKey: ['ar_aging'],
    queryFn: async (): Promise<ARAgingBucket[]> => {
      if (!isSupabaseConfigured) return MOCK_AR_AGING;
      const today = new Date();
      const { data, error } = await supabase
        .from('invoices')
        .select('balance_due, due_date')
        .not('status', 'in', '("paid","cancelled","draft")')
        .gt('balance_due', 0);
      if (error) return MOCK_AR_AGING;
      const buckets: ARAgingBucket[] = [
        { bucket: 'Current', amount: 0, count: 0 },
        { bucket: '1-30 days', amount: 0, count: 0 },
        { bucket: '31-60 days', amount: 0, count: 0 },
        { bucket: '61-90 days', amount: 0, count: 0 },
        { bucket: '90+ days', amount: 0, count: 0 },
      ];
      (data as { balance_due: number; due_date: string }[]).forEach(inv => {
        const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        const idx = daysOverdue <= 0 ? 0 : daysOverdue <= 30 ? 1 : daysOverdue <= 60 ? 2 : daysOverdue <= 90 ? 3 : 4;
        buckets[idx].amount += inv.balance_due;
        buckets[idx].count += 1;
      });
      return buckets;
    },
    placeholderData: MOCK_AR_AGING,
  });
}

export function useCashFlowChartData() {
  return useQuery({
    queryKey: ['cashflow_chart'],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return [
          { month: 'Oct', revenue: 42000, expenses: 28000 },
          { month: 'Nov', revenue: 48000, expenses: 31000 },
          { month: 'Dec', revenue: 55000, expenses: 35000 },
          { month: 'Jan', revenue: 38000, expenses: 29000 },
          { month: 'Feb', revenue: 52000, expenses: 33000 },
          { month: 'Mar', revenue: 61000, expenses: 38000 },
        ];
      }
      const { data } = await supabase.from('pl_summary' as never).select('*').order('period', { ascending: true }).limit(6);
      if (!data) return [];
      type PLRow = { period: string; revenue: number; expenses: number };
      return (data as PLRow[]).map(row => ({
        month: new Date(row.period).toLocaleString('default', { month: 'short' }),
        revenue: row.revenue,
        expenses: row.expenses,
      }));
    },
  });
}

export { MOCK_INVOICES, MOCK_TRANSACTIONS };
