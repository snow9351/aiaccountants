import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShoppingCart, Plus, Search, ChevronDown, CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useBills, useCreateBill, useMarkBillPaid } from "@/hooks/useBills";
import { useVendors } from "@/hooks/useVendors";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Bill } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft:    { label: "Draft",    icon: ChevronDown,    color: "bg-secondary/50 text-muted-foreground" },
  received: { label: "Received", icon: Clock,          color: "bg-info/10 text-info" },
  approved: { label: "Approved", icon: CheckCircle,    color: "bg-primary/10 text-primary" },
  paid:     { label: "Paid",     icon: CheckCircle,    color: "bg-success/10 text-success" },
  overdue:  { label: "Overdue",  icon: AlertCircle,    color: "bg-destructive/10 text-destructive" },
  cancelled:{ label: "Cancelled",icon: XCircle,        color: "bg-secondary/50 text-muted-foreground" },
};

const TABS = ["all", "draft", "received", "approved", "overdue", "paid"] as const;

export default function Bills() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: bills = [] } = useBills(orgId);
  const { data: vendors = [] } = useVendors(orgId);
  const createBill = useCreateBill();
  const markBillPaid = useMarkBillPaid();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", bill_number: "", bill_date: new Date().toISOString().slice(0, 10), due_date: "", total: "", description: "" });

  const filtered = bills.filter((b: Bill) => {
    const matchesTab = activeTab === "all" || b.status === activeTab;
    const matchesSearch = search === "" || (b.bill_number ?? "").toLowerCase().includes(search.toLowerCase()) || (b.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const outstanding = bills.filter((b: Bill) => !["paid","cancelled"].includes(b.status)).reduce((s: number, b: Bill) => s + b.balance_due, 0);
  const overdue = bills.filter((b: Bill) => b.status === "overdue").reduce((s: number, b: Bill) => s + b.balance_due, 0);
  const paidThisMonth = bills.filter((b: Bill) => b.status === "paid").reduce((s: number, b: Bill) => s + b.total, 0);

  const handleMarkPaid = async (bill: Bill) => {
    if (!orgId) return;
    try {
      await markBillPaid.mutateAsync({ billId: bill.id, orgId });
      toast({
        title: "Bill paid",
        description: "Payment recorded for 1099 YTD tracking.",
      });
    } catch (err) {
      toast({
        title: "Payment failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!orgId || !form.vendor_id || !form.due_date || !form.total) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    try {
      const total = parseFloat(form.total);
      await createBill.mutateAsync({ vendor_id: form.vendor_id, bill_number: form.bill_number || undefined, bill_date: form.bill_date, due_date: form.due_date, total, subtotal: total, tax_amount: 0, amount_paid: 0, description: form.description || undefined, status: "received", org_id: orgId, is_duplicate: false });
      toast({ title: "Bill added" });
      setShowDialog(false);
    } catch (err) {
      toast({ title: "Failed to add bill", description: (err as Error).message, variant: "destructive" });
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
            <p className="mt-0.5 text-sm text-muted-foreground">Accounts payable management</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" /> New Bill
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(outstanding)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overdue</p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{fmtCurrency(overdue)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid This Month</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(paidThisMonth)}</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border/50 bg-secondary/20 p-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all", activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..." className="rounded-xl border-border/50 bg-secondary/30 pl-10 h-9" />
        </div>
      </div>

      {/* Bills Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                {["Bill #", "Vendor", "Date", "Due Date", "Status", "Total", "Balance Due", ""].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill: Bill) => {
                const cfg = statusConfig[bill.status] ?? statusConfig.draft;
                const StatusIcon = cfg.icon;
                const vendor = vendors.find(v => v.id === bill.vendor_id);
                return (
                  <tr key={bill.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{bill.bill_number ?? "—"}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{vendor?.name ?? "Unknown Vendor"}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{new Date(bill.bill_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{new Date(bill.due_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cfg.color)}>
                        <StatusIcon className="h-3 w-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{fmtCurrency(bill.total)}</td>
                    <td className="px-5 py-3.5 text-sm font-medium">
                      <span className={bill.balance_due > 0 ? "text-warning" : "text-success"}>
                        {fmtCurrency(bill.balance_due)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {bill.status !== "paid" && bill.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(bill)}
                          disabled={markBillPaid.isPending}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">No bills found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Bill</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Vendor *</Label>
              <Select value={form.vendor_id} onValueChange={v => setForm(f => ({ ...f, vendor_id: v }))}>
                <SelectTrigger className="bg-background/50"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bill Number</Label>
                <Input placeholder="VENDOR-2024-01" value={form.bill_number} onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Total Amount *</Label>
                <Input type="number" placeholder="0.00" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bill Date</Label>
                <Input type="date" value={form.bill_date} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date *</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="April services" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createBill.isPending}>
                {createBill.isPending ? "Adding..." : "Add Bill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
