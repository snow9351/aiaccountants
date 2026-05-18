import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, Receipt, Search, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useExpenses,
  useCreateExpenseEntry,
  useUploadReceipt,
  getReceiptSignedUrl,
} from "@/hooks/useExpenses";
import { useContacts } from "@/hooks/useContacts";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { formatAccountLabel } from "@/lib/coaSubTypes";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";
import type { Contact, Expense } from "@/integrations/supabase/types";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function vendorContacts(contacts: Contact[]) {
  return contacts.filter((c) => c.vendor_id && (c.contact_type === "vendor" || c.contact_type === "both"));
}

export default function Expenses() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: expenses = [], isLoading } = useExpenses(orgId);
  const { data: contacts = [] } = useContacts(orgId);
  const { data: accounts = [] } = useChartOfAccounts(orgId);
  const createExpense = useCreateExpenseEntry();
  const uploadReceipt = useUploadReceipt();

  const vendors = useMemo(() => vendorContacts(contacts), [contacts]);
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.type === "expense" && a.is_active),
    [accounts],
  );

  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    vendor_id: "",
    date: new Date().toISOString().slice(0, 10),
    payment_date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    account_id: "",
    payment_method: "credit_card",
    payment_reference: "",
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        (e.vendor_name ?? "").toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const withReceipts = expenses.filter((e) => e.receipt_url).length;
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);

  const handleCreate = async () => {
    if (!orgId || !form.account_id || !form.amount) {
      toast({ title: "Account and amount are required", variant: "destructive" });
      return;
    }
    const vendor = vendors.find((c) => c.vendor_id === form.vendor_id);
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        receiptPath = await uploadReceipt.mutateAsync({ file: receiptFile, orgId });
      }
      await createExpense.mutateAsync({
        org_id: orgId,
        vendor_id: form.vendor_id || null,
        vendor_name: vendor?.display_name ?? null,
        date: form.date,
        description: form.description || "Expense",
        amount: parseFloat(form.amount),
        account_id: form.account_id,
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        payment_reference: form.payment_reference || null,
        receipt_url: receiptPath,
      });
      toast({
        title: "Expense recorded",
        description: "Posted to P&L (no A/P — paid immediately).",
      });
      setShowNew(false);
      setReceiptFile(null);
      setForm({
        vendor_id: "",
        date: new Date().toISOString().slice(0, 10),
        payment_date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        account_id: "",
        payment_method: "credit_card",
        payment_reference: "",
      });
    } catch (err) {
      toast({ title: "Failed to log expense", description: (err as Error).message, variant: "destructive" });
    }
  };

  const openReceipt = async (exp: Expense) => {
    if (!exp.receipt_url) return;
    const url = await getReceiptSignedUrl(exp.receipt_url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast({ title: "Could not open receipt", variant: "destructive" });
  };

  const onVendorChange = (vendorId: string) => {
    const contact = vendors.find((c) => c.vendor_id === vendorId);
    setForm((f) => ({
      ...f,
      vendor_id: vendorId,
      account_id: contact?.default_expense_account_id ?? f.account_id,
    }));
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct to COA · paid immediately (no accounts payable)
          </p>
        </div>
        <Button size="sm" className="gap-2 rounded-xl glow-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Log Expense
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total (all)</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmtCurrency(totalExpenses)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">This month</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{fmtCurrency(thisMonth)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">With receipts</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{withReceipts}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendor, description, account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      <div className="glass-card overflow-x-auto rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              {["Date", "Vendor", "Account", "Paid", "Receipt", "Amount"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  Loading expenses...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  {search ? "No expenses match your search." : "No expenses yet. Log a paid expense."}
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="border-b border-border/20 hover:bg-secondary/20">
                  <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(exp.date)}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium">{exp.vendor_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{exp.description}</p>
                  </td>
                  <td className="px-5 py-4 text-xs">{exp.category ?? "—"}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {exp.payment_date ? fmtDate(exp.payment_date) : "—"}
                    {exp.payment_method && (
                      <span className="block capitalize">{exp.payment_method.replace(/_/g, " ")}</span>
                    )}
                    {exp.payment_reference && <span className="block">{exp.payment_reference}</span>}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {exp.receipt_url ? (
                      <button
                        type="button"
                        onClick={() => openReceipt(exp)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Receipt className="h-4 w-4" />
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <Upload className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold">-{fmtCurrency(exp.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log expense</DialogTitle>
            <DialogDescription>
              Credit card, cash, or check — posts straight to P&L (not a vendor bill)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Vendor (contacts)</Label>
              <Select value={form.vendor_id} onValueChange={onVendorChange}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Optional vendor" />
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
                <Label>Expense date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expense account (COA) *</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm((p) => ({ ...p, account_id: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select expense account" />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatAccountLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What was purchased?"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm((p) => ({ ...p, payment_method: v }))}
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
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input
                  placeholder="Check #, last 4..."
                  value={form.payment_reference}
                  onChange={(e) => setForm((p) => ({ ...p, payment_reference: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt (image or PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={createExpense.isPending || uploadReceipt.isPending}
              className="w-full rounded-xl glow-primary"
            >
              {createExpense.isPending ? "Saving..." : "Log expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
