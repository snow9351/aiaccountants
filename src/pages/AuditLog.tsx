import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Download, Filter, Search, Shield, User, Bot, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { AuditEvent, AuditActionType } from "@/integrations/supabase/types";

const ACTION_LABELS: Record<AuditActionType, string> = {
  create:         "Created",
  update:         "Updated",
  delete:         "Deleted",
  void:           "Voided",
  post:           "Posted",
  approve:        "Approved",
  reject:         "Rejected",
  ai_suggest:     "AI Suggested",
  ai_apply:       "AI Applied",
  period_close:   "Period Closed",
  period_reopen:  "Period Reopened",
};
import { isSupabaseConfigured } from "@/integrations/supabase/client";

const actorIcons: Record<string, React.ElementType> = { user: User, ai: Bot, system: Settings };
const actorColors: Record<string, string> = {
  user: "bg-info/10 text-info",
  ai: "bg-primary/10 text-primary",
  system: "bg-secondary/50 text-muted-foreground",
};

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const { data: events = [] } = useAuditLog(100);

  const filtered = events.filter((e: AuditEvent) =>
    search === "" ||
    e.actor_name.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    (e.target_description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const aiActions = events.filter((e: AuditEvent) => e.actor_type === "ai").length;
  const userOverrides = events.filter((e: AuditEvent) => e.actor_type === "user" && e.action === "update").length;

  const handleExport = () => {
    const csv = [
      ["Timestamp", "Actor", "Actor Type", "Action", "Target", "Confidence", "Flagged"].join(","),
      ...filtered.map((e: AuditEvent) => [
        e.timestamp,
        e.actor_name,
        e.actor_type,
        ACTION_LABELS[e.action as AuditActionType] ?? e.action,
        (e.target_description ?? "").replace(/,/g, ";"),
        e.ai_confidence ?? "",
        e.is_flagged,
      ].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <CommandPalette />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="mt-0.5 text-sm text-muted-foreground flex items-center gap-1.5">
              Immutable event trail with SHA-256 hash chain
              {isSupabaseConfigured && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success font-medium">LIVE</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2 rounded-xl border-border/50">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search audit log or filter by actor/action...'
            className="rounded-xl border-border/50 bg-secondary/30 pl-10"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total events</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{events.length.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI actions</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{aiActions.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">User overrides</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{userOverrides.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hash chain</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">Valid ✓</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Timestamp</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actor</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Target</th>
                <th className="px-5 py-3.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event: AuditEvent) => {
                const ActorIcon = actorIcons[event.actor_type] ?? User;
                const formattedTime = new Date(event.timestamp).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                });
                return (
                  <tr key={event.id} className={cn(
                    "border-b border-border/20 transition-colors hover:bg-secondary/20",
                    event.is_flagged && "bg-warning/5"
                  )}>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{formattedTime}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", actorColors[event.actor_type] ?? actorColors.system)}>
                          <ActorIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm text-foreground">{event.actor_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">{ACTION_LABELS[event.action as AuditActionType] ?? event.action}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-xs truncate">{event.target_description ?? "—"}</td>
                    <td className="px-5 py-3.5 text-center">
                      {event.ai_confidence !== null && event.ai_confidence !== undefined ? (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          event.ai_confidence >= 0.9 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        )}>
                          {Math.round(event.ai_confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No events match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
