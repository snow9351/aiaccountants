import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-info/15 text-info",
  "bg-destructive/15 text-destructive",
  "bg-violet-500/15 text-violet-500",
  "bg-pink-500/15 text-pink-500",
  "bg-cyan-500/15 text-cyan-500",
];

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function scoreColor(score: number) {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

function scoreBg(score: number) {
  if (score >= 90) return "bg-success/10 border-success/20";
  if (score >= 70) return "bg-warning/10 border-warning/20";
  return "bg-destructive/10 border-destructive/20";
}

export default function Customers() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: customers = [] } = useCustomers();
  const createCustomer = useCreateCustomer();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    industry: "",
    credit_limit: "",
  });

  const filtered = useMemo(
    () =>
      customers.filter(
        (c: Customer) =>
          search === "" ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  const totalRevenue = customers.reduce(
    (s: number, c: Customer) => s + c.total_revenue,
    0
  );
  const totalAR = customers.reduce(
    (s: number, c: Customer) => s + c.ar_balance,
    0
  );
  const avgScore =
    customers.length > 0
      ? Math.round(
          customers.reduce(
            (s: number, c: Customer) => s + c.payment_score,
            0
          ) / customers.length
        )
      : 0;

  const handleCreate = async () => {
    if (!form.name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      await createCustomer.mutateAsync({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        industry: form.industry || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        org_id: orgId,
        total_revenue: 0,
        ar_balance: 0,
        payment_score: 100,
        is_active: true,
      });
      toast({ title: "Customer created", description: form.name });
      setShowDialog(false);
      setForm({ name: "", email: "", phone: "", industry: "", credit_limit: "" });
    } catch (err) {
      toast({
        title: "Failed to create customer",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Customers
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {customers.length} active customers
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => setShowDialog(true)}
        >
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Customers
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {customers.length}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Revenue
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">
            {fmtCurrency(totalRevenue)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AR Balance
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">
            {fmtCurrency(totalAR)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Avg Payment Score
          </p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-bold",
              scoreColor(avgScore)
            )}
          >
            {avgScore}%
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c: Customer) => (
          <div
            key={c.id}
            className="glass-card group rounded-2xl p-5 transition-all hover:scale-[1.01] hover:glow-primary"
          >
            {/* Top row: avatar + name, status badges */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                    avatarColor(c.name)
                  )}
                >
                  {getInitials(c.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold text-foreground">
                    {c.name}
                  </h3>
                  {c.email && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.is_active ? (
                  <Badge
                    variant="outline"
                    className="border-success/30 text-[10px] text-success"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/30 text-[10px] text-muted-foreground"
                  >
                    Inactive
                  </Badge>
                )}
                {c.industry && (
                  <Badge
                    variant="outline"
                    className="border-info/30 text-[10px] text-info"
                  >
                    {c.industry}
                  </Badge>
                )}
              </div>
            </div>

            {/* Contact */}
            {c.phone && (
              <div className="mt-2 flex items-center gap-1.5 pl-[52px] text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                {c.phone}
              </div>
            )}

            {/* Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-secondary/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Revenue
                </p>
                <p className="mt-1 font-display text-sm font-bold text-foreground">
                  {fmtCurrency(c.total_revenue)}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  AR Balance
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-sm font-bold",
                    c.ar_balance > 0 ? "text-warning" : "text-success"
                  )}
                >
                  {fmtCurrency(c.ar_balance)}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Pay Score
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-sm font-bold",
                    scoreColor(c.payment_score)
                  )}
                >
                  {c.payment_score}%
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className={cn(
                    "h-3.5 w-3.5",
                    scoreColor(c.payment_score)
                  )}
                />
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    scoreBg(c.payment_score),
                    scoreColor(c.payment_score)
                  )}
                >
                  {c.payment_score >= 90
                    ? "Excellent"
                    : c.payment_score >= 70
                    ? "Fair"
                    : "At Risk"}
                </span>
              </div>
              <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="glass-subtle flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:border-primary/30">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button className="glass-subtle flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:border-primary/30">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full glass-card rounded-2xl p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "No customers match your search."
                : "No customers yet. Add your first customer to get started."}
            </p>
          </div>
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Customer Name *</Label>
              <Input
                placeholder="Acme Corporation"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="billing@acme.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="555-0100"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input
                  placeholder="Technology"
                  value={form.industry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, industry: e.target.value }))
                  }
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={form.credit_limit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, credit_limit: e.target.value }))
                  }
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleCreate}
                disabled={createCustomer.isPending}
              >
                {createCustomer.isPending ? "Adding..." : "Add Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
