import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Store, Plus, Search, Mail, Phone, Star, TrendingDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useVendors, useCreateVendor } from "@/hooks/useVendors";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Vendor } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function Vendors() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: vendors = [] } = useVendors();
  const createVendor = useCreateVendor();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", tax_id: "", is_1099: false });

  const filtered = vendors.filter((v: Vendor) =>
    search === "" ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalSpend = vendors.reduce((s: number, v: Vendor) => s + v.total_spend, 0);
  const totalAP = vendors.reduce((s: number, v: Vendor) => s + v.ap_balance, 0);
  const vendors1099 = vendors.filter((v: Vendor) => v.is_1099).length;

  const handleCreate = async () => {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    try {
      await createVendor.mutateAsync({ ...form, org_id: orgId, total_spend: 0, ap_balance: 0, reliability_score: 100, is_active: true });
      toast({ title: "Vendor created", description: form.name });
      setShowDialog(false);
      setForm({ name: "", email: "", phone: "", tax_id: "", is_1099: false });
    } catch (err) {
      toast({ title: "Failed to create vendor", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Vendors</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{vendors.length} active vendors</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Spend (YTD)</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalSpend)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding AP</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(totalAP)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">1099 Vendors</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{vendors1099}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((vendor: Vendor) => (
          <div key={vendor.id} className="glass-card group rounded-2xl p-5 transition-all hover:scale-[1.02]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                {vendor.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex items-center gap-1">
                {vendor.is_1099 && (
                  <Badge variant="outline" className="text-[10px] border-info/30 text-info">1099</Badge>
                )}
                {vendor.ap_balance > 0 && (
                  <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">AP Due</Badge>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-foreground">{vendor.name}</h3>

            {vendor.email && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {vendor.email}
              </div>
            )}
            {vendor.phone && (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {vendor.phone}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Spend</p>
                <p className="text-sm font-semibold text-foreground">{fmtCurrency(vendor.total_spend)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AP Balance</p>
                <p className={cn("text-sm font-semibold", vendor.ap_balance > 0 ? "text-warning" : "text-success")}>
                  {fmtCurrency(vendor.ap_balance)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className={cn("h-3.5 w-3.5", vendor.reliability_score >= 90 ? "text-success fill-success" : vendor.reliability_score >= 70 ? "text-warning fill-warning" : "text-destructive fill-destructive")} />
                <span className="text-xs text-muted-foreground">Reliability {vendor.reliability_score}%</span>
              </div>
              {vendor.ap_balance > 0 && (
                <button className="flex items-center gap-1 rounded-xl border border-warning/30 px-3 py-1 text-xs text-warning hover:bg-warning/10 transition-colors">
                  <TrendingDown className="h-3 w-3" /> Pay Now
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 glass-card rounded-2xl p-12 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No vendors found.</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Vendor Name *</Label>
              <Input placeholder="Acme Supplies Inc" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="billing@vendor.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="555-1234" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tax ID (EIN/SSN)</Label>
              <Input placeholder="XX-XXXXXXX" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="is1099" checked={form.is_1099} onChange={e => setForm(f => ({ ...f, is_1099: e.target.checked }))} className="rounded" />
              <Label htmlFor="is1099">This is a 1099 vendor (contractor)</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createVendor.isPending}>
                {createVendor.isPending ? "Adding..." : "Add Vendor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
