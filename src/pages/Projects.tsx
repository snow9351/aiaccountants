import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FolderKanban, Plus, Search, TrendingUp, Clock, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCustomers } from "@/hooks/useCustomers";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  planning:  { label: "Planning",   icon: Clock,         color: "bg-info/10 text-info border-info/20" },
  active:    { label: "Active",     icon: Loader,        color: "bg-primary/10 text-primary border-primary/20" },
  on_hold:   { label: "On Hold",    icon: Clock,         color: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed",  icon: CheckCircle,   color: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled",  icon: Clock,         color: "bg-secondary/50 text-muted-foreground border-border/30" },
};

const TABS = ["all", "active", "planning", "completed"] as const;

export default function Projects() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: projects = [] } = useProjects();
  const { data: customers = [] } = useCustomers();
  const createProject = useCreateProject();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "", customer_id: "", project_type: "fixed_price",
    start_date: new Date().toISOString().slice(0, 10), end_date: "",
    budget_amount: "", description: "",
  });

  const filtered = projects.filter((p: Project) => {
    const matchesTab = activeTab === "all" || p.status === activeTab;
    const matchesSearch = search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const active = projects.filter((p: Project) => p.status === "active");
  const totalBudget = active.reduce((s: number, p: Project) => s + p.budget_amount, 0);
  const totalSpent = active.reduce((s: number, p: Project) => s + p.actual_cost, 0);
  const avgComplete = active.length > 0 ? Math.round(active.reduce((s: number, p: Project) => s + p.percent_complete, 0) / active.length) : 0;

  const handleCreate = async () => {
    if (!form.name || !form.budget_amount) { toast({ title: "Name and budget are required", variant: "destructive" }); return; }
    try {
      await createProject.mutateAsync({
        name: form.name, customer_id: form.customer_id || undefined,
        project_type: form.project_type as Project["project_type"],
        start_date: form.start_date, end_date: form.end_date || undefined,
        budget_amount: parseFloat(form.budget_amount),
        actual_cost: 0, revenue_amount: 0, percent_complete: 0,
        description: form.description || undefined,
        status: "planning", org_id: orgId,
      });
      toast({ title: "Project created", description: form.name });
      setShowDialog(false);
      setForm({ name: "", customer_id: "", project_type: "fixed_price", start_date: new Date().toISOString().slice(0, 10), end_date: "", budget_amount: "", description: "" });
    } catch (err) {
      toast({ title: "Failed to create project", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FolderKanban className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Projects</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Project profitability & tracking</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Budget</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtCurrency(totalBudget)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{active.length} active projects</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Spent</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{fmtCurrency(totalSpent)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of budget</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Completion</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{avgComplete}%</p>
          <p className="mt-1 text-xs text-muted-foreground">Across active projects</p>
        </div>
      </div>

      {/* Filters */}
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
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="rounded-xl border-border/50 bg-secondary/30 pl-10 h-9" />
        </div>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((project: Project) => {
          const cfg = statusConfig[project.status] ?? statusConfig.planning;
          const StatusIcon = cfg.icon;
          const customer = customers.find(c => c.id === project.customer_id);
          const remaining = project.budget_amount - project.actual_cost;
          const budgetPct = project.budget_amount > 0 ? Math.min(100, (project.actual_cost / project.budget_amount) * 100) : 0;
          const profit = project.revenue_amount - project.actual_cost;
          const margin = project.revenue_amount > 0 ? Math.round((profit / project.revenue_amount) * 100) : 0;

          return (
            <div key={project.id} className="glass-card rounded-2xl p-5 transition-all hover:scale-[1.01]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                  {customer && <p className="text-xs text-muted-foreground mt-0.5">{customer.company_name ?? customer.name}</p>}
                </div>
                <span className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium shrink-0", cfg.color)}>
                  <StatusIcon className="h-3 w-3" /> {cfg.label}
                </span>
              </div>

              {project.description && (
                <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
              )}

              {/* Budget progress */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget usage</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{Math.round(budgetPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", budgetPct >= 90 ? "bg-destructive" : budgetPct >= 70 ? "bg-warning" : "bg-success")}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>

              {/* Completion */}
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Completion</span>
                  <span className="text-[10px] font-medium text-primary">{project.percent_complete}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${project.percent_complete}%` }} />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 border-t border-border/20 pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget</p>
                  <p className="text-sm font-semibold text-foreground">{fmtCurrency(project.budget_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Spent</p>
                  <p className="text-sm font-semibold text-foreground">{fmtCurrency(project.actual_cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</p>
                  <p className={cn("text-sm font-semibold", remaining >= 0 ? "text-success" : "text-destructive")}>{fmtCurrency(Math.abs(remaining))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
                  <p className={cn("text-sm font-semibold flex items-center gap-0.5", margin >= 0 ? "text-success" : "text-destructive")}>
                    <TrendingUp className="h-3 w-3" /> {margin}%
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/60">
                <span>Start: {new Date(project.start_date).toLocaleDateString()}</span>
                {project.end_date && <span>End: {new Date(project.end_date).toLocaleDateString()}</span>}
                <span className="capitalize">{project.project_type.replace("_", " ")}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 glass-card rounded-2xl p-12 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No projects found.</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Project</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Project Name *</Label>
              <Input placeholder="Platform Redesign 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project Type</Label>
                <Select value={form.project_type} onValueChange={v => setForm(f => ({ ...f, project_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_price">Fixed Price</SelectItem>
                    <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Amount *</Label>
              <Input type="number" placeholder="50000" value={form.budget_amount} onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Brief project description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background/50" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
