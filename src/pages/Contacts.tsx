import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Contact2,
  Plus,
  Search,
  Mail,
  Phone,
  Pencil,
  EyeOff,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useVendors1099Threshold,
  type ContactFormInput,
} from "@/hooks/useContacts";
import { ensureDefaultPaymentTerms, usePaymentTerms } from "@/hooks/usePaymentTerms";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { formatAccountLabel } from "@/lib/coaSubTypes";
import type { Contact, ContactType } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

type AddressFields = { line1: string; line2: string; city: string; state: string; zip: string };

const emptyAddress = (): AddressFields => ({
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
});

function addressFromJson(j: unknown): AddressFields {
  if (!j || typeof j !== "object") return emptyAddress();
  const o = j as Record<string, string>;
  return {
    line1: o.line1 ?? "",
    line2: o.line2 ?? "",
    city: o.city ?? "",
    state: o.state ?? "",
    zip: o.zip ?? "",
  };
}

function addressToJson(a: AddressFields) {
  if (!a.line1.trim() && !a.city.trim()) return null;
  return {
    line1: a.line1.trim(),
    line2: a.line2.trim() || undefined,
    city: a.city.trim(),
    state: a.state.trim(),
    zip: a.zip.trim(),
  };
}

const TYPE_LABELS: Record<ContactType, string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & Vendor",
};

const TYPE_BADGE: Record<ContactType, string> = {
  customer: "border-primary/30 text-primary bg-primary/10",
  vendor: "border-warning/30 text-warning bg-warning/10",
  both: "border-info/30 text-info bg-info/10",
};

type FormState = {
  contact_type: ContactType;
  display_name: string;
  legal_name: string;
  email: string;
  phone: string;
  tax_id: string;
  is_1099_eligible: boolean;
  payment_terms_id: string;
  default_income_account_id: string;
  default_expense_account_id: string;
  notes: string;
  billing: AddressFields;
  shipping: AddressFields;
};

const emptyForm = (): FormState => ({
  contact_type: "customer",
  display_name: "",
  legal_name: "",
  email: "",
  phone: "",
  tax_id: "",
  is_1099_eligible: false,
  payment_terms_id: "",
  default_income_account_id: "",
  default_expense_account_id: "",
  notes: "",
  billing: emptyAddress(),
  shipping: emptyAddress(),
});

function formFromContact(c: Contact): FormState {
  return {
    contact_type: c.contact_type,
    display_name: c.display_name,
    legal_name: c.legal_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    tax_id: c.tax_id ?? "",
    is_1099_eligible: c.is_1099_eligible,
    payment_terms_id: c.payment_terms_id ?? "",
    default_income_account_id: c.default_income_account_id ?? "",
    default_expense_account_id: c.default_expense_account_id ?? "",
    notes: c.notes ?? "",
    billing: addressFromJson(c.billing_address),
    shipping: addressFromJson(c.shipping_address),
  };
}

export default function Contacts() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const [filter, setFilter] = useState<"all" | ContactType>("all");
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: contacts = [] } = useContacts(orgId, { includeInactive: showHidden });
  const { data: paymentTerms = [] } = usePaymentTerms(orgId);
  const { data: accounts = [] } = useChartOfAccounts(orgId);
  const { data: threshold1099 = [] } = useVendors1099Threshold(orgId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  useEffect(() => {
    if (orgId) void ensureDefaultPaymentTerms(orgId);
  }, [orgId]);

  const incomeAccounts = useMemo(
    () => accounts.filter((a) => a.type === "revenue" || a.type === "asset"),
    [accounts]
  );
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === "expense"), [accounts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filter !== "all" && c.contact_type !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.display_name.toLowerCase().includes(q) ||
        (c.legal_name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.tax_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, filter, search]);

  const openCreate = () => {
    setEditContact(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (c: Contact) => {
    setEditContact(c);
    setForm(formFromContact(c));
    setShowDialog(true);
  };

  const buildPayload = (): ContactFormInput => ({
    org_id: orgId,
    contact_type: form.contact_type,
    display_name: form.display_name.trim(),
    legal_name: form.legal_name.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    tax_id: form.tax_id.trim() || null,
    is_1099_eligible: form.is_1099_eligible,
    payment_terms_id: form.payment_terms_id || null,
    default_income_account_id: form.default_income_account_id || null,
    default_expense_account_id: form.default_expense_account_id || null,
    notes: form.notes.trim() || null,
    billing_address: addressToJson(form.billing),
    shipping_address:
      form.contact_type === "customer" || form.contact_type === "both"
        ? addressToJson(form.shipping)
        : null,
  });

  const handleSave = async () => {
    if (!orgId || !form.display_name.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    try {
      if (editContact) {
        await updateContact.mutateAsync({
          id: editContact.id,
          org_id: orgId,
          display_name: form.display_name.trim(),
          legal_name: form.legal_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          tax_id: form.tax_id.trim() || null,
          is_1099_eligible: form.is_1099_eligible,
          payment_terms_id: form.payment_terms_id || null,
          default_income_account_id: form.default_income_account_id || null,
          default_expense_account_id: form.default_expense_account_id || null,
          notes: form.notes.trim() || null,
          billing_address: addressToJson(form.billing),
          shipping_address: addressToJson(form.shipping),
        });
        toast({ title: "Contact updated" });
      } else {
        await createContact.mutateAsync(buildPayload());
        toast({ title: "Contact created" });
      }
      setShowDialog(false);
    } catch (err) {
      toast({
        title: editContact ? "Update failed" : "Create failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async (c: Contact) => {
    if (!orgId) return;
    try {
      await updateContact.mutateAsync({ id: c.id, org_id: orgId, is_active: false });
      toast({ title: "Contact hidden", description: `${c.display_name} — turn on “Show hidden” to see it again.` });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRestore = async (c: Contact) => {
    if (!orgId) return;
    try {
      await updateContact.mutateAsync({ id: c.id, org_id: orgId, is_active: true });
      toast({ title: "Contact restored", description: c.display_name });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const showIncome = form.contact_type === "customer" || form.contact_type === "both";
  const showExpense = form.contact_type === "vendor" || form.contact_type === "both";
  const show1099 = showExpense;

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Contact2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Contacts</h1>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={openCreate} disabled={!orgId}>
          <Plus className="h-4 w-4" /> New contact
        </Button>
      </div>

      {threshold1099.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-foreground">
                1099 threshold ({new Date().getFullYear()}): {threshold1099.length} vendor
                {threshold1099.length === 1 ? "" : "s"} at or above $600 YTD
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Form generation is post-MVP; payment data is tracked from bill payments.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="all" className="rounded-lg">
              All
            </TabsTrigger>
            <TabsTrigger value="customer" className="rounded-lg">
              Customers
            </TabsTrigger>
            <TabsTrigger value="vendor" className="rounded-lg">
              Vendors
            </TabsTrigger>
            <TabsTrigger value="both" className="rounded-lg">
              Both
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          <div className="group relative flex shrink-0 flex-col items-center px-1 pb-0">
            <Switch
              checked={showHidden}
              onCheckedChange={setShowHidden}
              aria-label="Show hidden contacts"
            />
            <span
              className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap text-xs leading-tight text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              Show hidden
            </span>
          </div>
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="rounded-xl border-border/50 bg-secondary/30 pl-10"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className={cn("glass-card rounded-2xl p-5", !c.is_active && "opacity-60")}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-foreground">{c.display_name}</h3>
                {c.legal_name && c.legal_name !== c.display_name && (
                  <p className="truncate text-xs text-muted-foreground">Legal: {c.legal_name}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className={cn("text-[10px]", TYPE_BADGE[c.contact_type])}>
                  {TYPE_LABELS[c.contact_type]}
                </Badge>
                {!c.is_active && (
                  <Badge variant="secondary" className="text-[10px]">
                    Hidden
                  </Badge>
                )}
              </div>
            </div>

            {c.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {c.email}
              </div>
            )}
            {c.phone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {c.phone}
              </div>
            )}

            {c.is_1099_eligible && (c.contact_type === "vendor" || c.contact_type === "both") && (
              <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">1099 YTD </span>
                <span className={cn(c.ytd_1099_payments >= 600 ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                  {fmtCurrency(Number(c.ytd_1099_payments))}
                </span>
                {c.ytd_1099_payments >= 600 && (
                  <Badge className="ml-2 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700">
                    ≥ $600
                  </Badge>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1" onClick={() => openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {c.is_active ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-muted-foreground"
                  title="Hide contact"
                  onClick={() => handleDeactivate(c)}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-muted-foreground"
                  title="Restore contact"
                  onClick={() => handleRestore(c)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">
          No contacts yet. Add customers, vendors, or both from <strong>New contact</strong>.
        </p>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit contact" : "New contact"}</DialogTitle>
            <DialogDescription>
              Display name, legal name, type, addresses, tax ID, payment terms, and default GL accounts for invoicing and bills.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {!editContact && (
              <div className="space-y-1.5">
                <Label>Contact type</Label>
                <Select
                  value={form.contact_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, contact_type: v as ContactType }))}
                >
                  <SelectTrigger className="rounded-xl bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Customer & Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editContact && (
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-sm">
                Type: <span className="font-medium">{TYPE_LABELS[editContact.contact_type]}</span> (fixed)
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Display name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Legal name (optional)</Label>
                <Input
                  value={form.legal_name}
                  onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
                  placeholder="May differ for sole proprietors"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing address</p>
              <Input
                placeholder="Line 1"
                value={form.billing.line1}
                onChange={(e) => setForm((f) => ({ ...f, billing: { ...f.billing, line1: e.target.value } }))}
                className="bg-background/50"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={form.billing.city}
                  onChange={(e) => setForm((f) => ({ ...f, billing: { ...f.billing, city: e.target.value } }))}
                  className="bg-background/50"
                />
                <Input
                  placeholder="State"
                  value={form.billing.state}
                  onChange={(e) => setForm((f) => ({ ...f, billing: { ...f.billing, state: e.target.value } }))}
                  className="bg-background/50"
                />
                <Input
                  placeholder="ZIP"
                  value={form.billing.zip}
                  onChange={(e) => setForm((f) => ({ ...f, billing: { ...f.billing, zip: e.target.value } }))}
                  className="bg-background/50"
                />
              </div>
            </div>

            {showIncome && (
              <div className="space-y-2 rounded-xl border border-border/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shipping address (customer)</p>
                <Input
                  placeholder="Line 1"
                  value={form.shipping.line1}
                  onChange={(e) => setForm((f) => ({ ...f, shipping: { ...f.shipping, line1: e.target.value } }))}
                  className="bg-background/50"
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>EIN / SSN (optional)</Label>
                <Input
                  value={form.tax_id}
                  onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment terms</Label>
                <Select
                  value={form.payment_terms_id || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, payment_terms_id: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {paymentTerms.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showIncome && (
              <div className="space-y-1.5">
                <Label>Default income account</Label>
                <Select
                  value={form.default_income_account_id || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, default_income_account_id: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="For invoices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {incomeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatAccountLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showExpense && (
              <div className="space-y-1.5">
                <Label>Default expense account</Label>
                <Select
                  value={form.default_expense_account_id || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, default_expense_account_id: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="For bills" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {expenseAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatAccountLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {show1099 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.is_1099_eligible}
                  onChange={(e) => setForm((f) => ({ ...f, is_1099_eligible: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">1099-eligible vendor (track YTD payments; $600+ surfaced at year-end)</span>
              </label>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="bg-background/50"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleSave}
                disabled={createContact.isPending || updateContact.isPending}
              >
                {editContact ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
