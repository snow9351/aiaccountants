import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ShoppingCart,
  Plus,
  Search,
  MoreHorizontal,
  CreditCard,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import {
  useBills,
  useBillDetail,
  useCreateBillWithLines,
  useRecordBillPayment,
  type BillLineInput,
} from "@/hooks/useBills";
import { useContacts } from "@/hooks/useContacts";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { useUploadReceipt } from "@/hooks/useExpenses";
import { formatAccountLabel } from "@/lib/coaSubTypes";
import {
  getBillPaymentStatus,
  billPaymentStatusLabel,
  type BillPaymentStatus,
} from "@/lib/apPaymentStatus";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import type { Bill, Contact } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const paymentStatusStyle: Record<BillPaymentStatus, string> = {
  unpaid: "bg-warning/10 text-warning border-warning/20",
  partial: "bg-info/10 text-info border-info/20",
  paid: "bg-success/10 text-success border-success/20",
};

const filterTabs: { key: BillPaymentStatus | "all" | "overdue"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

const thBase = "px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground";
const tdBase = "px-5 py-4 text-sm";

const BILL_COLUMNS = [
  { id: "bill", label: "Bill #", th: `${thBase} text-left`, td: `${tdBase} text-left font-medium` },
  { id: "vendor", label: "Vendor", th: `${thBase} text-left`, td: `${tdBase} text-left` },
  { id: "bill_date", label: "Bill date", th: `${thBase} text-left`, td: `${tdBase} text-left text-muted-foreground whitespace-nowrap` },
  { id: "due", label: "Due date", th: `${thBase} text-left`, td: `${tdBase} text-left text-muted-foreground whitespace-nowrap` },
  { id: "payment", label: "Pay status", th: `${thBase} text-left`, td: `${tdBase} text-left` },
  { id: "total", label: "Total", th: `${thBase} text-right`, td: `${tdBase} text-right font-semibold tabular-nums whitespace-nowrap` },
  { id: "balance", label: "Balance due", th: `${thBase} text-right`, td: `${tdBase} text-right font-semibold tabular-nums whitespace-nowrap` },
  { id: "actions", label: "", th: `${thBase} text-right`, td: `${tdBase} text-right` },
] as const;

function emptyLine(): BillLineInput {
  return { description: "", quantity: 1, unit_price: 0, tax_rate: 0, account_id: null };
}

function vendorContacts(contacts: Contact[]) {
  return contacts.filter((c) => c.vendor_id && (c.contact_type === "vendor" || c.contact_type === "both"));
}

export default function Bills() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: bills = [], isLoading } = useBills(orgId);
  const { data: contacts = [] } = useContacts(orgId);
  const { data: accounts = [] } = useChartOfAccounts(orgId);
  const createBill = useCreateBillWithLines();
  const recordPayment = useRecordBillPayment();
  const uploadReceipt = useUploadReceipt();

  const vendors = useMemo(() => vendorContacts(contacts), [contacts]);
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.type === "expense" && a.is_active),
    [accounts],
  );

  const [activeTab, setActiveTab] = useState<(typeof filterTabs)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    vendor_id: "",
    bill_number: "",
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    description: "",
  });
  const [lines, setLines] = useState<BillLineInput[]>([emptyLine()]);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "check",
    reference: "",
    notes: "",
  });

  const { data: detail } = useBillDetail(detailId ?? undefined);

  const vendorMap = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of vendors) {
      if (c.vendor_id) m.set(c.vendor_id, c);
    }
    return m;
  }, [vendors]);

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      const ps = getBillPaymentStatus(b);
      const tabOk =
        activeTab === "all" ||
        (activeTab === "overdue" ? b.status === "overdue" : ps === activeTab);
      const q = search.toLowerCase();
      const vendor = vendorMap.get(b.vendor_id);
      const matchesSearch =
        !q ||
        (b.bill_number ?? "").toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q) ||
        (vendor?.display_name ?? "").toLowerCase().includes(q);
      return tabOk && matchesSearch;
    });
  }, [bills, activeTab, search, vendorMap]);

  const outstanding = bills
    .filter((b) => getBillPaymentStatus(b) !== "paid" && b.status !== "cancelled")
    .reduce((s, b) => s + b.balance_due, 0);
  const overdue = bills.filter((b) => b.status === "overdue").reduce((s, b) => s + b.balance_due, 0);
  const paidThisMonth = bills
    .filter((b) => b.status === "paid")
    .reduce((s, b) => s + b.amount_paid, 0);

  const previewTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const sub = l.quantity * l.unit_price;
      return sum + sub + sub * (l.tax_rate / 100);
    }, 0);
  }, [lines]);

  const applyVendorDefaultAccount = (vendorId: string) => {
    const contact = vendors.find((c) => c.vendor_id === vendorId);
    const defaultAcct = contact?.default_expense_account_id;
    if (!defaultAcct) return;
    setLines((rows) => rows.map((r) => ({ ...r, account_id: r.account_id ?? defaultAcct })));
  };

  const handleCreate = async () => {
    if (!orgId || !form.vendor_id || !form.due_date) {
      toast({ title: "Fill required fields", variant: "destructive" });
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && l.unit_price > 0);
    if (validLines.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt.mutateAsync({ file: receiptFile, orgId });
      }
      const id = await createBill.mutateAsync({
        org_id: orgId,
        vendor_id: form.vendor_id,
        bill_number: form.bill_number || null,
        bill_date: form.bill_date,
        due_date: form.due_date,
        description: form.description || null,
        receipt_url: receiptUrl,
        lines: validLines,
      });
      toast({ title: "Bill created", description: "Vendor bill recorded in A/P." });
      setShowNew(false);
      setReceiptFile(null);
      setLines([emptyLine()]);
      setDetailId(id);
    } catch (err) {
      toast({ title: "Failed to create bill", description: (err as Error).message, variant: "destructive" });
    }
  };

  const openPayment = (bill: Bill) => {
    setDetailId(bill.id);
    setPaymentForm({
      amount: String(bill.balance_due),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "check",
      reference: "",
      notes: "",
    });
    setShowPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!orgId || !detailId) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    try {
      await recordPayment.mutateAsync({
        billId: detailId,
        orgId,
        amount,
        paymentDate: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      });
      toast({ title: "Payment recorded" });
      setShowPayment(false);
    } catch (err) {
      toast({ title: "Payment failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Bills</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Vendor bills (A/P liability) · line items · partial payments
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New Bill
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding A/P</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(outstanding)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overdue</p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{fmtCurrency(overdue)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid (bills)</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(paidThisMonth)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              activeTab === tab.key
                ? "border-primary/30 bg-primary/20 text-primary"
                : "border-border/30 bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bills..."
            className="h-9 rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      <div className="glass-card overflow-x-auto rounded-2xl">
        <table className="w-full table-fixed">
          <colgroup>
            {BILL_COLUMNS.map((col) => (
              <col key={col.id} className="w-[12.5%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border/30">
              {BILL_COLUMNS.map((col, i) => (
                <th
                  key={col.id}
                  className={cn(col.th, i === 0 && "pl-6", i === BILL_COLUMNS.length - 1 && "pr-6")}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={BILL_COLUMNS.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Loading bills...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={BILL_COLUMNS.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No bills match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((bill) => {
                const ps = getBillPaymentStatus(bill);
                const contact = vendorMap.get(bill.vendor_id);
                return (
                  <tr
                    key={bill.id}
                    className="group cursor-pointer border-b border-border/20 transition-colors hover:bg-secondary/20"
                    onClick={() => setDetailId(bill.id)}
                  >
                    <td className={cn(BILL_COLUMNS[0].td, "pl-6")}>
                      <span className="block truncate" title={bill.bill_number ?? undefined}>
                        {bill.bill_number ?? "—"}
                      </span>
                    </td>
                    <td className={BILL_COLUMNS[1].td}>
                      <span className="block truncate" title={contact?.display_name}>
                        {contact?.display_name ?? "—"}
                      </span>
                    </td>
                    <td className={BILL_COLUMNS[2].td}>{fmtDate(bill.bill_date)}</td>
                    <td className={BILL_COLUMNS[3].td}>{fmtDate(bill.due_date)}</td>
                    <td className={BILL_COLUMNS[4].td}>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                          paymentStatusStyle[ps],
                        )}
                      >
                        {billPaymentStatusLabel[ps]}
                      </span>
                    </td>
                    <td className={BILL_COLUMNS[5].td}>{fmtCurrency(bill.total)}</td>
                    <td
                      className={cn(
                        BILL_COLUMNS[6].td,
                        bill.balance_due > 0 ? "text-warning" : "text-success",
                      )}
                    >
                      {fmtCurrency(bill.balance_due)}
                    </td>
                    <td className={cn(BILL_COLUMNS[7].td, "pr-6")} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl">
                          <DropdownMenuItem onClick={() => setDetailId(bill.id)}>View details</DropdownMenuItem>
                          {ps !== "paid" && bill.status !== "cancelled" && (
                            <DropdownMenuItem className="gap-2" onClick={() => openPayment(bill)}>
                              <CreditCard className="h-3.5 w-3.5" /> Record payment
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail */}
      <Dialog open={!!detailId && !showPayment} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.bill.bill_number ?? "Vendor bill"}</DialogTitle>
                <DialogDescription>
                  {vendorMap.get(detail.bill.vendor_id)?.display_name} · {billPaymentStatusLabel[getBillPaymentStatus(detail.bill)]} ·
                  Balance {fmtCurrency(detail.bill.balance_due)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                  <div>Bill date: {fmtDate(detail.bill.bill_date)}</div>
                  <div>Due: {fmtDate(detail.bill.due_date)}</div>
                </div>
                {detail.bill.description && <p>{detail.bill.description}</p>}
                {detail.bill.receipt_url && (
                  <p className="flex items-center gap-2 text-primary">
                    <Receipt className="h-4 w-4" /> Receipt attached
                  </p>
                )}
                <div className="rounded-xl border border-border/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((li) => (
                        <tr key={li.id} className="border-b border-border/20">
                          <td className="px-3 py-2">{li.description}</td>
                          <td className="px-3 py-2 text-right">{fmtCurrency(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail.payments.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium">Payments</p>
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                        <span>{fmtDate(p.payment_date)} · {p.payment_method}</span>
                        <span className="font-semibold">{fmtCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {getBillPaymentStatus(detail.bill) !== "paid" && detail.bill.status !== "cancelled" && (
                  <Button className="w-full rounded-xl" onClick={() => openPayment(detail.bill)}>
                    Record payment
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Check #, card last 4, or bank transfer reference</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(v) => setPaymentForm((f) => ({ ...f, payment_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Reference (check #, last 4, etc.)"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              rows={2}
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowPayment(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                Save payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create bill */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New vendor bill</DialogTitle>
            <DialogDescription>A/P liability until paid · vendor from contacts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Vendor *</Label>
              <Select
                value={form.vendor_id}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, vendor_id: v }));
                  applyVendorDefaultAccount(v);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((c) => (
                    <SelectItem key={c.vendor_id!} value={c.vendor_id!}>
                      {c.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bill</Label>
                <Input
                  value={form.bill_number}
                  onChange={(e) => setForm((f) => ({ ...f, bill_number: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bill date</Label>
                <Input
                  type="date"
                  value={form.bill_date}
                  onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due date *</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items (expense accounts)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((l) => [...l, emptyLine()])}>
                  <Plus className="h-3 w-3" /> Add line
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-border/40 p-3">
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, description: v } : r)));
                    }}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={line.quantity || ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, quantity: v } : r)));
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={line.unit_price || ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, unit_price: v } : r)));
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Tax %"
                      value={line.tax_rate || ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, tax_rate: v } : r)));
                      }}
                    />
                  </div>
                  <Select
                    value={line.account_id ?? ""}
                    onValueChange={(v) =>
                      setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, account_id: v || null } : r)))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Expense account *" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {formatAccountLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setLines((l) => l.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Receipt (PDF or image)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Textarea
              placeholder="Memo"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
            <p className="text-right text-sm font-medium">Estimated total: {fmtCurrency(previewTotal)}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleCreate}
                disabled={createBill.isPending || uploadReceipt.isPending}
              >
                {createBill.isPending ? "Saving..." : "Create bill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
