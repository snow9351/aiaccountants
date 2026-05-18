import type { Bill } from '@/integrations/supabase/types';

export type BillPaymentStatus = 'unpaid' | 'partial' | 'paid';

export function getBillPaymentStatus(bill: Pick<Bill, 'status' | 'amount_paid' | 'balance_due'>): BillPaymentStatus {
  if (bill.status === 'paid' || bill.balance_due <= 0) return 'paid';
  if (bill.amount_paid > 0 || bill.status === 'partial') return 'partial';
  return 'unpaid';
}

export const billPaymentStatusLabel: Record<BillPaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};
