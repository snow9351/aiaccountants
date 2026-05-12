import { useState } from "react";
import { Building2, ChevronDown, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreateCompany, type Company } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";

function roleSubtitle(role: string | undefined): string {
  switch (role) {
    case "owner":
      return "Owner — full access";
    case "accountant":
      return "Invited accountant — client books";
    case "bookkeeper":
      return "Invited bookkeeper";
    case "read_only":
      return "View only";
    default:
      return role ?? "Member";
  }
}

export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useCompanies();
  const companies = (data ?? []).filter((c) => c.id && c.name);
  const { activeOrgId, setActiveOrgId } = useCompanyStore();
  const createCompany = useCreateCompany();

  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", entity_type: "llc", accounting_method: "cash", ein: "" });

  const active = companies.find(c => c.id === activeOrgId) ?? companies[0];

  /**
   * Owners can add another org. If the company list is empty (RLS misconfig, first visit, etc.),
   * still offer "Add company" so the user can create a workspace; the mutation always inserts owner.
   */
  const canAddCompany = companies.length === 0 || companies.some((c) => c.role === "owner");

  const handleCreate = async () => {
    if (!form.name) { toast({ title: "Company name required", variant: "destructive" }); return; }
    try {
      const company = await createCompany.mutateAsync(form);
      setActiveOrgId(company.id);
      toast({ title: "Company created", description: `${form.name} — COA auto-generated` });
      setShowCreateDialog(false);
      setForm({ name: "", entity_type: "llc", accounting_method: "cash", ein: "" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground">
        <Building2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
              {active?.name?.slice(0, 2).toUpperCase() ?? "—"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{active?.name ?? "Select company"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {active ? roleSubtitle(active.role) : isLoading ? "Loading…" : ""}
              </p>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] w-[min(18rem,calc(100vw-1.5rem))] p-0"
        >
          <div className="max-h-52 overflow-y-auto rounded-xl border border-border/50 bg-card shadow-xl">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
              </div>
            )}
            {isError && !isLoading && (
              <div className="space-y-2 px-3 py-4">
                <div className="flex gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{(error as Error)?.message ?? "Could not load companies."}</span>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full rounded-lg" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {!isLoading && !isError && companies.length === 0 && (
              <div className="space-y-2 px-3 py-4 text-center text-sm text-muted-foreground">
                <p>No companies loaded for this account.</p>
                <Button type="button" variant="outline" size="sm" className="w-full rounded-lg" onClick={() => void refetch()}>
                  Retry
                </Button>
                <p className="text-xs">If you were invited, confirm you signed in with the invited email.</p>
              </div>
            )}
            {!isLoading &&
              !isError &&
              companies.map((company: Company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setActiveOrgId(company.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{company.name}</p>
                    <p className="text-[10px] text-muted-foreground">{roleSubtitle(company.role)}</p>
                  </div>
                  {company.id === activeOrgId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
          </div>
          {canAddCompany && !isLoading && (
            <div className="border-t border-border/50 p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowCreateDialog(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add company
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add Company</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new organization by entering company details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Legal Name *</Label>
              <Input placeholder="Acme Technologies LLC" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entity Type</Label>
                <Select value={form.entity_type} onValueChange={v => setForm(f => ({ ...f, entity_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="s_corp">S-Corp</SelectItem>
                    <SelectItem value="c_corp">C-Corp</SelectItem>
                    <SelectItem value="sole_prop">Sole Prop</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Accounting Method</Label>
                <Select value={form.accounting_method} onValueChange={v => setForm(f => ({ ...f, accounting_method: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>EIN (optional)</Label>
              <Input placeholder="XX-XXXXXXX" value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} className="bg-background/50" />
            </div>
            <p className="text-xs text-muted-foreground">A default chart of accounts will be auto-generated based on your entity type.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createCompany.isPending}>
                {createCompany.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
