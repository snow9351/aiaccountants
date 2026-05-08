import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCompany } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";

export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
  const { toast } = useToast();
  const { data: companies = [] } = useCompanies();
  const { activeOrgId, setActiveOrgId } = useCompanyStore();
  const createCompany = useCreateCompany();

  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", entity_type: "llc", accounting_method: "cash", ein: "" });

  const active = companies.find(c => c.id === activeOrgId) ?? companies[0];

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
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-left transition-colors hover:bg-secondary/40"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
            {active?.name?.slice(0, 2).toUpperCase() ?? "—"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{active?.name ?? "Select company"}</p>
            <p className="text-[10px] text-muted-foreground truncate capitalize">{active?.plan ?? ""} · {active?.entity_type?.toUpperCase() ?? ""}</p>
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {companies.map(company => (
                <button
                  key={company.id}
                  onClick={() => { setActiveOrgId(company.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{company.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{company.role}</p>
                  </div>
                  {company.id === activeOrgId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
            <div className="border-t border-border/30 p-2">
              <button
                onClick={() => { setOpen(false); setShowCreateDialog(true); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add company
              </button>
            </div>
          </div>
        )}
      </div>

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
