import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Plus, Send, Clock, CheckCircle, AlertCircle, Eye, Ban,
  MoreHorizontal, FileText, DollarSign, CalendarClock, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useInvoices, useInvoiceSummary, useCreateInvoice, useUpdateInvoiceStatus } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useOrgId } from "@/hooks/useCompanies";
import type { Invoice } from "@/integrations/supabase/types";

/* ---------- helpers ---------- */

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
};

const filterTabs: { value: InvoiceStatus | null; label: string }[] = [
  { value: null,      label: "All" },
  { value: "draft",   label: "Draft" },
  { value: "sent",    label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "paid",    label: "Paid" },
];

/* ---------- component ---------- */

export default function Invoices() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_id: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  /* ---- data hooks ---- */
  const { data: invoices = [], isLoading } = useInvoices(
    filterStatus ? { status: filterStatus } : undefined,
  );
  const summary = useInvoiceSummary();
  const { data: customers = [] } = useCustomers();
  const createInvoice = useCreateInvoice();
  const updateStatus = useUpdateInvoiceStatus();

  /* customer lookup map */
  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  /* open dialog via ?action=new */
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowNew(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /* ---- handlers ---- */

  const handleCreate = async () => {
    if (!form.customer_id || !form.amount) {
      toast({ title: "Missing fields", description: "Customer and amount are required.", variant: "destructive" });
      return;
    }
    const total = parseFloat(form.amount) || 0;
    const now = new Date().toISOString().split("T")[0];
    const dueDate = form.due_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    })();

    try {
      await createInvoice.mutateAsync({
        org_id: orgId,
        invoice_number: `INV-${Date.now().toString(36).toUpperCase()}`,
        customer_id: form.customer_id,
        status: "draft" as const,
        issue_date: now,
        due_date: dueDate,
        subtotal: total,
        tax_amount: 0,
        total,
        amount_paid: 0,
        notes: form.notes || null,
        is_recurring: false,
        recurring_interval: null,
        journal_entry_id: null,
        sent_at: null,
        viewed_at: null,
      });
      toast({
        title: "Invoice created",
        description: `Draft invoice for ${customerMap.get(form.customer_id) ?? "customer"} - ${fmtCurrency(total)}`,
      });
      setShowNew(false);
      setForm({ customer_id: "", amount: "", due_date: "", notes: "" });
    } catch (err) {
      toast({ title: "Failed to create invoice", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: "Invoice updated", description: `Status changed to ${statusConfig[status].label}.` });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    }
    setActionMenuId(null);
  };

  /* ---- summary cards ---- */
  const summaryCards = [
    { label: "Outstanding",     value: fmtCurrency(summary.outstanding),   sub: "Sent & viewed",        color: "text-warning",      icon: CalendarClock },
    { label: "Overdue",         value: fmtCurrency(summary.overdue),       sub: "Past due date",        color: "text-destructive",  icon: AlertCircle },
    { label: "Paid This Month", value: fmtCurrency(summary.paidThisMonth), sub: "Collected revenue",    color: "text-success",      icon: CheckCircle },
    { label: "Drafts",          value: String(summary.draftCount),          sub: "Pending review",       color: "text-muted-foreground", icon: FileText },
  ];

  /* ---- render ---- */
  return (
    <AppLayout>
      <CommandPalette />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Invoices</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Create, send, and track customer invoices</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl glow-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      {/* Summary cards */}
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

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value ?? "all"}
            onClick={() => setFilterStatus(tab.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
              filterStatus === tab.value
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-secondary/40 text-muted-foreground border-border/30 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoice table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Invoice</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Issue Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Due Date</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Balance Due</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">Loading invoices...</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No invoices match this filter.</p>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const sc = statusConfig[inv.status];
                const StatusIcon = sc.icon;
                return (
                  <tr key={inv.id} className="group border-b border-border/20 transition-colors hover:bg-secondary/20">
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{inv.invoice_number}</td>
                    <td className="px-5 py-4 text-sm text-foreground">{customerMap.get(inv.customer_id) ?? "Unknown"}</td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", sc.color)}>
                        <StatusIcon className="h-3 w-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(inv.due_date)}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-foreground">{fmtCurrency(inv.total)}</td>
                    <td className={cn(
                      "px-5 py-4 text-right text-sm font-semibold",
                      inv.balance_due > 0 ? "text-warning" : "text-success",
                    )}>
                      {fmtCurrency(inv.balance_due)}
                    </td>
                    <td className="relative px-3 py-4">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === inv.id ? null : inv.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>

                      {/* Quick-action dropdown */}
                      {actionMenuId === inv.id && (
                        <div className="absolute right-4 top-12 z-50 min-w-[160px] rounded-xl border border-border/50 bg-card p-1.5 shadow-xl">
                          {inv.status === "draft" && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "sent")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
                            >
                              <Send className="h-3.5 w-3.5 text-primary" /> Mark as Sent
                            </button>
                          )}
                          {(inv.status === "sent" || inv.status === "viewed" || inv.status === "overdue" || inv.status === "partial") && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "paid")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-success" /> Mark as Paid
                            </button>
                          )}
                          {(inv.status === "sent" || inv.status === "viewed") && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "overdue")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
                            >
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Mark as Overdue
                            </button>
                          )}
                          {inv.status !== "cancelled" && inv.status !== "paid" && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "cancelled")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
                            >
                              <Ban className="h-3.5 w-3.5 text-muted-foreground" /> Cancel
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

      {/* Click-away for action menu */}
      {actionMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
      )}

      {/* New Invoice Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Create Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="rounded-xl border-border/50 bg-secondary/30">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="rounded-xl border-border/50 bg-secondary/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="rounded-xl border-border/50 bg-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes for this invoice..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="rounded-xl border-border/50 bg-secondary/30 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl glow-primary"
                onClick={handleCreate}
                disabled={createInvoice.isPending}
              >
                {createInvoice.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
