import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Plus, Send, Clock, CheckCircle, AlertCircle, Eye, Ban,
  MoreHorizontal, FileText, DollarSign, CalendarClock, Receipt,
  Download, CreditCard, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useInvoices,
  useInvoiceSummary,
  useInvoiceDetail,
  useCreateInvoiceWithLines,
  useTransitionInvoiceStatus,
  useRecordInvoicePayment,
  useSendInvoice,
  type InvoiceLineInput,
} from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useOrgId, useCompanies } from "@/hooks/useCompanies";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { formatAccountLabel } from "@/lib/coaSubTypes";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice, InvoiceLineItem } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type InvoiceStatus = Invoice["status"];

const statusConfig: Record<
  InvoiceStatus,
  { icon: typeof Send; color: string; label: string }
> = {
  draft:     { icon: Clock,       color: "text-muted-foreground bg-secondary/50 border-border/30",        label: "Draft" },
  sent:      { icon: Send,        color: "text-primary bg-primary/10 border-primary/20",                  label: "Sent" },
  viewed:    { icon: Eye,         color: "text-info bg-info/10 border-info/20",                           label: "Viewed" },
  partial:   { icon: DollarSign,  color: "text-warning bg-warning/10 border-warning/20",                  label: "Partial" },
  paid:      { icon: CheckCircle, color: "text-success bg-success/10 border-success/20",                  label: "Paid" },
  overdue:   { icon: AlertCircle, color: "text-destructive bg-destructive/10 border-destructive/20",      label: "Overdue" },
  cancelled: { icon: Ban,         color: "text-muted-foreground bg-muted/50 border-border/30",            label: "Cancelled" },
  voided:    { icon: Ban,         color: "text-muted-foreground bg-muted/50 border-border/30",            label: "Voided" },
};

const filterTabs: { value: InvoiceStatus | null; label: string }[] = [
  { value: null,      label: "All" },
  { value: "draft",   label: "Draft" },
  { value: "sent",    label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "paid",    label: "Paid" },
];

const emptyLine = (): InvoiceLineInput => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  account_id: null,
});

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "wire", label: "Wire" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "stripe", label: "Stripe" },
];

export default function Invoices() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: companies = [] } = useCompanies();
  const orgName = companies.find((c) => c.id === orgId)?.name ?? "Company";

  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    notes: "",
    discount_type: "none" as "none" | "percent" | "flat",
    discount_value: "",
  });
  const [lines, setLines] = useState<InvoiceLineInput[]>([emptyLine()]);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "check",
    reference: "",
    notes: "",
  });

  const { data: invoices = [], isLoading } = useInvoices(
    orgId,
    filterStatus ? { status: filterStatus } : undefined,
  );
  const summary = useInvoiceSummary(orgId);
  const { data: customers = [] } = useCustomers({ orgId });
  const { data: accounts = [] } = useChartOfAccounts(orgId);
  const { data: detail } = useInvoiceDetail(detailId ?? undefined);

  const createInvoice = useCreateInvoiceWithLines();
  const transitionStatus = useTransitionInvoiceStatus();
  const recordPayment = useRecordInvoicePayment();
  const sendInvoice = useSendInvoice();

  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.type === "revenue" && a.is_active),
    [accounts],
  );

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowNew(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const previewTotal = useMemo(() => {
    const sub = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const tax = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.tax_rate / 100), 0);
    const dv = parseFloat(form.discount_value) || 0;
    const disc =
      form.discount_type === "percent" ? sub * (dv / 100) : form.discount_type === "flat" ? dv : 0;
    return Math.max(sub - disc, 0) + tax;
  }, [lines, form.discount_type, form.discount_value]);

  const handleCreate = async () => {
    if (!orgId) {
      toast({ title: "No company selected", variant: "destructive" });
      return;
    }
    if (!form.customer_id || lines.every((l) => !l.description.trim())) {
      toast({ title: "Customer and at least one line item are required.", variant: "destructive" });
      return;
    }
    const dueDate =
      form.due_date ||
      (() => {
        const d = new Date(form.issue_date);
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })();

    try {
      const id = await createInvoice.mutateAsync({
        org_id: orgId,
        customer_id: form.customer_id,
        invoice_number: `INV-${Date.now().toString(36).toUpperCase()}`,
        issue_date: form.issue_date,
        due_date: dueDate,
        notes: form.notes || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        lines: lines.filter((l) => l.description.trim()),
      });
      toast({ title: "Invoice created", description: `Draft ${fmtCurrency(previewTotal)}` });
      setShowNew(false);
      setForm({
        customer_id: "",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: "",
        notes: "",
        discount_type: "none",
        discount_value: "",
      });
      setLines([emptyLine()]);
      setDetailId(id);
    } catch (err) {
      toast({ title: "Failed to create invoice", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleStatus = async (id: string, status: InvoiceStatus) => {
    if (!orgId) return;
    try {
      await transitionStatus.mutateAsync({ invoiceId: id, status, orgId });
      toast({ title: "Invoice updated", description: statusConfig[status].label });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    }
    setActionMenuId(null);
  };

  const handleSend = async (id: string) => {
    if (!orgId) return;
    try {
      const res = await sendInvoice.mutateAsync({ invoiceId: id, orgId });
      toast({
        title: res.email_sent ? "Invoice sent" : "Invoice marked sent",
        description: res.payment_link_url
          ? "Payment link created. Email sent if customer has an address."
          : "Configure STRIPE_SECRET_KEY for online payment links.",
      });
    } catch (err) {
      toast({ title: "Send failed", description: (err as Error).message, variant: "destructive" });
    }
    setActionMenuId(null);
  };

  const handlePdf = async (inv: Invoice) => {
    const cust = customerMap.get(inv.customer_id);
    const { data: lineRows } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("line_number");
    await downloadInvoicePdf({
      invoice: inv,
      lines: (lineRows ?? []) as InvoiceLineItem[],
      customer: cust ? { name: cust.name, email: cust.email, billing_address: cust.billing_address } : null,
      orgName,
    });
  };

  const handleRecordPayment = async () => {
    if (!orgId || !detailId || !detail) return;
    const amount = parseFloat(paymentForm.amount) || detail.invoice.balance_due;
    try {
      await recordPayment.mutateAsync({
        invoiceId: detailId,
        orgId,
        amount,
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      });
      toast({ title: "Payment recorded" });
      setShowPayment(false);
      setPaymentForm({ amount: "", payment_method: "check", reference: "", notes: "" });
    } catch (err) {
      toast({ title: "Payment failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const summaryCards = [
    { label: "Outstanding", value: fmtCurrency(summary.outstanding), sub: "Sent & partial", color: "text-warning", icon: CalendarClock },
    { label: "Overdue", value: fmtCurrency(summary.overdue), sub: "Past due", color: "text-destructive", icon: AlertCircle },
    { label: "Paid This Month", value: fmtCurrency(summary.paidThisMonth), sub: "Collected", color: "text-success", icon: CheckCircle },
    { label: "Drafts", value: String(summary.draftCount), sub: "Pending", color: "text-muted-foreground", icon: FileText },
  ];

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Invoices</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">AR · PDF · Stripe payment links · partial payments</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl glow-primary" onClick={() => setShowNew(true)} disabled={!orgId}>
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
              <p className={cn("mt-1 font-display text-2xl font-bold", card.color)}>{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value ?? "all"}
            onClick={() => setFilterStatus(tab.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              filterStatus === tab.value
                ? "border-primary/30 bg-primary/20 text-primary"
                : "border-border/30 bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              {["Invoice", "Customer", "Status", "Issue", "Due", "Total", "Balance", ""].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No invoices match this filter.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const sc = statusConfig[inv.status] ?? statusConfig.draft;
                const StatusIcon = sc.icon;
                const cust = customerMap.get(inv.customer_id);
                return (
                  <tr
                    key={inv.id}
                    className="group cursor-pointer border-b border-border/20 transition-colors hover:bg-secondary/20"
                    onClick={() => setDetailId(inv.id)}
                  >
                    <td className="px-5 py-4 text-sm font-medium">{inv.invoice_number}</td>
                    <td className="px-5 py-4 text-sm">{cust?.name ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", sc.color)}>
                        <StatusIcon className="h-3 w-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(inv.due_date)}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold">{fmtCurrency(inv.total)}</td>
                    <td className={cn("px-5 py-4 text-right text-sm font-semibold", inv.balance_due > 0 ? "text-warning" : "text-success")}>
                      {fmtCurrency(inv.balance_due)}
                    </td>
                    <td className="relative px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setActionMenuId(actionMenuId === inv.id ? null : inv.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {actionMenuId === inv.id && (
                        <div className="absolute right-4 top-12 z-50 min-w-[180px] rounded-xl border border-border/50 bg-card p-1.5 shadow-xl">
                          <button type="button" onClick={() => handlePdf(inv)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary/50">
                            <Download className="h-3.5 w-3.5" /> Download PDF
                          </button>
                          {inv.status === "draft" && (
                            <button type="button" onClick={() => handleSend(inv.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary/50">
                              <Send className="h-3.5 w-3.5 text-primary" /> Send
                            </button>
                          )}
                          {!["voided", "cancelled", "paid", "draft"].includes(inv.status) && (
                            <button type="button" onClick={() => { setDetailId(inv.id); setShowPayment(true); setActionMenuId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary/50">
                              <CreditCard className="h-3.5 w-3.5" /> Record payment
                            </button>
                          )}
                          {inv.status === "draft" && (
                            <button type="button" onClick={() => handleStatus(inv.id, "sent")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary/50">
                              <Send className="h-3.5 w-3.5" /> Mark sent
                            </button>
                          )}
                          {!["voided", "cancelled", "paid"].includes(inv.status) && (
                            <button type="button" onClick={() => handleStatus(inv.id, "voided")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-secondary/50">
                              <Ban className="h-3.5 w-3.5" /> Void
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {actionMenuId && <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.invoice.invoice_number}</DialogTitle>
                <DialogDescription>
                  {customerMap.get(detail.invoice.customer_id)?.name} · {statusConfig[detail.invoice.status].label} ·{" "}
                  Balance {fmtCurrency(detail.invoice.balance_due)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {detail.invoice.payment_link_url && (
                  <a
                    href={detail.invoice.payment_link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary"
                  >
                    Stripe payment link →
                  </a>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left">Description</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Tax%</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((li) => (
                      <tr key={li.id} className="border-b border-border/20">
                        <td className="py-2">{li.description}</td>
                        <td className="py-2 text-right">{li.quantity}</td>
                        <td className="py-2 text-right">{fmtCurrency(li.unit_price)}</td>
                        <td className="py-2 text-right">{li.tax_rate}%</td>
                        <td className="py-2 text-right">{fmtCurrency(li.quantity * li.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end gap-4 text-sm">
                  <span>Subtotal {fmtCurrency(detail.invoice.subtotal)}</span>
                  <span>Tax {fmtCurrency(detail.invoice.tax_amount)}</span>
                  <span className="font-semibold">Total {fmtCurrency(detail.invoice.total)}</span>
                </div>
                {detail.payments.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Payments</p>
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.payment_date} · {p.payment_method}</span>
                        <span>{fmtCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => handlePdf(detail.invoice)}>
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                  {detail.invoice.status === "draft" && (
                    <Button size="sm" className="rounded-xl gap-1" onClick={() => handleSend(detail.invoice.id)}>
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  )}
                  {detail.invoice.balance_due > 0 && !["voided", "cancelled", "draft"].includes(detail.invoice.status) && (
                    <Button size="sm" variant="secondary" className="rounded-xl gap-1" onClick={() => setShowPayment(true)}>
                      <CreditCard className="h-3.5 w-3.5" /> Record payment
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Check, cash, wire, or other manual payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder={detail ? String(detail.invoice.balance_due) : "0"}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Reference #" value={paymentForm.reference} onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                Save payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create invoice */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>Customer from contacts · line items · discount · USD</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invoice date</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((l) => [...l, emptyLine()])}>
                  <Plus className="h-3 w-3" /> Add line
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-xl border border-border/40 p-3 space-y-2">
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
                    onValueChange={(v) => setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, account_id: v || null } : r)))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Revenue account (optional)" /></SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{formatAccountLabel(a)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setLines((l) => l.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v as typeof form.discount_type }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="flat">Flat amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.discount_type !== "none" && (
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Memo / notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <p className="text-right text-sm font-medium">Estimated total: {fmtCurrency(previewTotal)}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createInvoice.isPending}>
                {createInvoice.isPending ? "Creating..." : "Create draft"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

