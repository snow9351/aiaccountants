import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CalendarCheck, Plus, CheckCircle, Circle, Clock, Lock, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useCloseChecklists, useCloseTasks, useCreateChecklist, useUpdateCloseTask, useCloseMonth } from "@/hooks/useMonthEndClose";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { CloseChecklist, CloseTask } from "@/hooks/useMonthEndClose";

const statusConfig = {
  open:      { label: "Open",      icon: Circle,      color: "bg-muted text-muted-foreground border-border" },
  in_review: { label: "In Review", icon: Clock,       color: "bg-warning/10 text-warning border-warning/20" },
  closed:    { label: "Closed",    icon: Lock,         color: "bg-success/10 text-success border-success/20" },
};

const categoryLabels: Record<string, string> = {
  bank: "Banking & Cash",
  receivables: "Accounts Receivable",
  payables: "Accounts Payable",
  payroll: "Payroll & Benefits",
  accruals: "Accruals & Adjustments",
  review: "Review & Sign-off",
};

export default function MonthEndClose() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: checklists = [] } = useCloseChecklists(orgId);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);
  const activeChecklist = checklists.find(c => c.id === selectedChecklist) ?? checklists[0];
  const { data: tasks = [] } = useCloseTasks(activeChecklist?.id);
  const createChecklist = useCreateChecklist();
  const updateTask = useUpdateCloseTask();
  const closeMonth = useCloseMonth();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [newPeriod, setNewPeriod] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(categoryLabels)));

  const completedCount = tasks.filter(t => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const tasksByCategory = tasks.reduce<Record<string, CloseTask[]>>((acc, task) => {
    (acc[task.category] ??= []).push(task);
    return acc;
  }, {});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleTask = (task: CloseTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTask.mutate({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    });
  };

  const handleCreate = async () => {
    if (!newPeriod) { toast({ title: "Select a period", variant: "destructive" }); return; }
    try {
      await createChecklist.mutateAsync({ org_id: orgId, period: newPeriod });
      toast({ title: "Close checklist created", description: `Period ${newPeriod} is ready.` });
      setShowNewDialog(false);
      setNewPeriod("");
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleClose = async () => {
    if (!activeChecklist) return;
    try {
      await closeMonth.mutateAsync({ id: activeChecklist.id, notes: closeNotes });
      toast({ title: "Month closed", description: "The period has been closed and locked." });
      setShowCloseDialog(false);
      setCloseNotes("");
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const allComplete = completedCount === totalCount && totalCount > 0;

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Month-End Close</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Structured close workflow with task tracking</p>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4" /> New Close Period
        </Button>
      </div>

      {/* Period selector + stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Active Period</p>
          <div className="flex flex-wrap gap-2">
            {checklists.map(cl => {
              const cfg = statusConfig[cl.status];
              const StatusIcon = cfg.icon;
              return (
                <button
                  key={cl.id}
                  onClick={() => setSelectedChecklist(cl.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                    cl.id === activeChecklist?.id ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {cl.period}
                </button>
              );
            })}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{progressPct}%</p>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{completedCount} of {totalCount} tasks complete</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
          {activeChecklist && (() => {
            const cfg = statusConfig[activeChecklist.status];
            const StatusIcon = cfg.icon;
            return (
              <>
                <div className={cn("mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cfg.color)}>
                  <StatusIcon className="h-3 w-3" /> {cfg.label}
                </div>
                {activeChecklist.status !== "closed" && allComplete && (
                  <Button size="sm" className="mt-2 w-full gap-1.5 rounded-xl bg-success hover:bg-success/90" onClick={() => setShowCloseDialog(true)}>
                    <Lock className="h-3.5 w-3.5" /> Close Period
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Task checklist by category */}
      <div className="space-y-3">
        {Object.entries(categoryLabels).map(([cat, label]) => {
          const catTasks = tasksByCategory[cat] ?? [];
          if (catTasks.length === 0) return null;
          const catCompleted = catTasks.filter(t => t.status === "completed").length;
          const isExpanded = expandedCategories.has(cat);

          return (
            <div key={cat} className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-medium text-foreground">{label}</span>
                  <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", catCompleted === catTasks.length ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    {catCompleted}/{catTasks.length}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {catTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-secondary/20 transition-colors">
                      <button
                        onClick={() => toggleTask(task)}
                        className="mt-0.5 shrink-0"
                        disabled={activeChecklist?.status === "closed"}
                      >
                        {task.status === "completed" ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                      </div>
                      {task.completed_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Select or create a close period to get started.</p>
          </div>
        )}
      </div>

      {/* New period dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">Start New Close Period</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Period (YYYY-MM)</Label>
              <Input type="month" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="bg-background/50" />
            </div>
            <p className="text-xs text-muted-foreground">A checklist of 16 standard close tasks will be generated automatically.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createChecklist.isPending}>
                {createChecklist.isPending ? "Creating..." : "Create Checklist"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close period dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg flex items-center gap-2"><Lock className="h-5 w-5 text-success" /> Close Period</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-success/30 bg-success/5 p-4">
              <p className="text-sm font-medium text-success">All tasks complete</p>
              <p className="mt-1 text-xs text-muted-foreground">Closing this period will lock all transactions and prevent further changes. This action is irreversible.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Close Notes (optional)</Label>
              <Textarea placeholder="Summary of adjustments made..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} className="bg-background/50 resize-none" rows={3} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl bg-success hover:bg-success/90" onClick={handleClose} disabled={closeMonth.isPending}>
                <Lock className="h-4 w-4 mr-2" /> {closeMonth.isPending ? "Closing..." : "Close Month"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
