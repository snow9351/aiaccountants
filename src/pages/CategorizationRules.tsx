import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Filter, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Zap, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useCategorizationRules, useCreateCategorizationRule, useUpdateCategorizationRule, useDeleteCategorizationRule } from "@/hooks/useCategorizationRules";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { CategorizationRule } from "@/hooks/useCategorizationRules";

const matchFieldLabels: Record<string, string> = {
  description: "Description",
  vendor: "Vendor Name",
  amount: "Amount",
  memo: "Memo",
};

const matchTypeLabels: Record<string, string> = {
  contains: "Contains",
  starts_with: "Starts With",
  exact: "Exact Match",
  regex: "Regex Pattern",
  greater_than: "Greater Than",
  less_than: "Less Than",
};

export default function CategorizationRules() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: rules = [] } = useCategorizationRules(orgId);
  const createRule = useCreateCategorizationRule();
  const updateRule = useUpdateCategorizationRule();
  const deleteRule = useDeleteCategorizationRule();

  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", match_field: "description" as CategorizationRule['match_field'],
    match_type: "contains" as CategorizationRule['match_type'],
    match_value: "", target_account_name: "", target_account_id: "",
    priority: "5", auto_apply: true,
  });

  const activeRules = rules.filter(r => r.is_active);
  const totalApplied = rules.reduce((sum, r) => sum + r.times_applied, 0);

  const handleCreate = async () => {
    if (!form.name || !form.match_value || !form.target_account_name) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    try {
      await createRule.mutateAsync({
        org_id: orgId,
        name: form.name,
        match_field: form.match_field,
        match_type: form.match_type,
        match_value: form.match_value,
        target_account_id: form.target_account_id || `acc-${form.target_account_name.toLowerCase().replace(/\s+/g, '-')}`,
        target_account_name: form.target_account_name,
        priority: parseInt(form.priority) || 5,
        is_active: true,
        auto_apply: form.auto_apply,
      });
      toast({ title: "Rule created" });
      setShowCreate(false);
      setForm({ name: "", match_field: "description", match_type: "contains", match_value: "", target_account_name: "", target_account_id: "", priority: "5", auto_apply: true });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const toggleActive = (rule: CategorizationRule) => {
    updateRule.mutate({ id: rule.id, is_active: !rule.is_active });
    toast({ title: rule.is_active ? "Rule disabled" : "Rule enabled" });
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    try {
      await deleteRule.mutateAsync(showDelete);
      toast({ title: "Rule deleted" });
      setShowDelete(null);
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Filter className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Categorization Rules</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Auto-categorize transactions with custom rules</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Rules</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{activeRules.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{rules.length} total rules</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Applied</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{totalApplied}</p>
          <p className="mt-1 text-xs text-muted-foreground">transactions auto-categorized</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Auto-Apply Rules</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{rules.filter(r => r.auto_apply && r.is_active).length}</p>
          <p className="mt-1 text-xs text-muted-foreground">categorize without review</p>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.id} className={cn("glass-card rounded-2xl p-5 transition-opacity", !rule.is_active && "opacity-60")}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                  {rule.auto_apply && rule.is_active && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                      <Zap className="h-2.5 w-2.5" /> Auto-Apply
                    </span>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-muted border border-border/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Hash className="h-2.5 w-2.5" /> Priority {rule.priority}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-foreground">
                    {matchFieldLabels[rule.match_field]}
                  </span>
                  <span className="text-muted-foreground">{matchTypeLabels[rule.match_type]}</span>
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-primary">
                    "{rule.match_value}"
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="rounded-md bg-success/10 px-2 py-1 font-medium text-success">
                    {rule.target_account_name}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>Applied {rule.times_applied} times</span>
                  {rule.last_applied_at && (
                    <span>Last: {new Date(rule.last_applied_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => toggleActive(rule)}>
                  {rule.is_active ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-destructive/60 hover:text-destructive" onClick={() => setShowDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No categorization rules yet. Create one to auto-categorize transactions.</p>
          </div>
        )}
      </div>

      {/* Create rule dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Categorization Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. AWS Cloud Charges" className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Match Field</Label>
                <Select value={form.match_field} onValueChange={(v: CategorizationRule['match_field']) => setForm(f => ({ ...f, match_field: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="vendor">Vendor Name</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="memo">Memo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Match Type</Label>
                <Select value={form.match_type} onValueChange={(v: CategorizationRule['match_type']) => setForm(f => ({ ...f, match_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="starts_with">Starts With</SelectItem>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="regex">Regex Pattern</SelectItem>
                    <SelectItem value="greater_than">Greater Than</SelectItem>
                    <SelectItem value="less_than">Less Than</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Match Value *</Label>
              <Input value={form.match_value} onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))} placeholder="e.g. AMAZON WEB SERVICES" className="bg-background/50 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Account *</Label>
                <Input value={form.target_account_name} onChange={e => setForm(f => ({ ...f, target_account_name: e.target.value }))} placeholder="Cloud Hosting" className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority (1-10)</Label>
                <Input type="number" min="1" max="10" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.auto_apply} onCheckedChange={v => setForm(f => ({ ...f, auto_apply: v }))} />
              <div>
                <Label>Auto-apply</Label>
                <p className="text-xs text-muted-foreground">Categorize matching transactions without manual review</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createRule.isPending}>
                {createRule.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">Delete Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">This rule will be permanently deleted. Previously categorized transactions will not be affected.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDelete(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDelete} disabled={deleteRule.isPending}>
                {deleteRule.isPending ? "Deleting..." : "Delete Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
