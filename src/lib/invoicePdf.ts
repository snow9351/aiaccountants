import type { Invoice, InvoiceLineItem, Customer } from '@/integrations/supabase/types';

export type InvoicePdfInput = {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Pick<Customer, 'name' | 'email' | 'billing_address'> | null;
  orgName: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export async function downloadInvoicePdf(input: InvoicePdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();
  const { invoice, lines, customer, orgName } = input;

  doc.setFontSize(18);
  doc.text(orgName, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('INVOICE', 14, 28);
  doc.setTextColor(0);

  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoice_number}`, 14, 38);
  doc.text(`Issue date: ${invoice.issue_date}`, 14, 44);
  doc.text(`Due date: ${invoice.due_date}`, 14, 50);
  doc.text(`Status: ${invoice.status}`, 14, 56);

  doc.text('Bill to:', 120, 38);
  doc.text(customer?.name ?? 'Customer', 120, 44);
  if (customer?.email) doc.text(customer.email, 120, 50);

  const tableBody = lines.map((li) => [
    li.description,
    String(li.quantity),
    fmt(li.unit_price),
    `${li.tax_rate}%`,
    fmt(li.quantity * li.unit_price),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    startY: 64,
    head: [['Description', 'Qty', 'Unit price', 'Tax', 'Amount']],
    body: tableBody.length ? tableBody : [['—', '—', '—', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = ((doc as any).lastAutoTable?.finalY ?? 100) + 10;

  let y = finalY;
  doc.text(`Subtotal: ${fmt(invoice.subtotal)}`, 140, y);
  y += 6;
  const discountType = invoice.discount_type ?? 'none';
  const discountValue = invoice.discount_value ?? 0;
  if (discountType !== 'none' && discountValue > 0) {
    const label =
      discountType === 'percent'
        ? `Discount (${discountValue}%):`
        : 'Discount:';
    const disc =
      discountType === 'percent'
        ? invoice.subtotal * (discountValue / 100)
        : discountValue;
    doc.text(`${label} -${fmt(disc)}`, 140, y);
    y += 6;
  }
  doc.text(`Tax: ${fmt(invoice.tax_amount)}`, 140, y);
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text(`Total: ${fmt(invoice.total)}`, 140, y);
  doc.text(`Balance due: ${fmt(invoice.balance_due)}`, 140, y + 6);
  doc.setFont(undefined, 'normal');

  if (invoice.notes) {
    doc.setFontSize(9);
    doc.text(`Notes: ${invoice.notes}`, 14, y + 16, { maxWidth: 180 });
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
