import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Brain, CheckCircle, AlertCircle, RefreshCw, Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useUncategorizedTransactions, useRunAICategorization, useConfirmCategorization, useBulkConfirm } from "@/hooks/useCategorization";
import { useChartOfAccounts } from "@/hooks/useAccounts";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { UncategorizedTransaction } from "@/hooks/useCategorization";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const confidenceColor = (c: number | null) => {
  if (!c) return "text-muted-foreground";
  if (c >= 0.9) return "text-success";
  if (c >= 0.7) return "text-warning";
  return "text-destructive";
};

const confidenceBg = (c: number | null) => {
  if (!c) return "bg-secondary/50 text-muted-foreground";
  if (c >= 0.9) return "bg-success/10 text-success";
  if (c >= 0.7) return "bg-warning/10 text-warning";
  return "bg-destructive/10 text-destructive";
};

export default function Categorization() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: transactions = [] } = useUncategorizedTransactions(orgId);
  const { data: accounts = [] } = useChartOfAccounts();
  const runAI = useRunAICategorization();
  const confirm = useConfirmCategorization();
  const bulkConfirm = useBulkConfirm();

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const unreviewed = transactions.filter(t => t.categorization_status === "unreviewed").length;
  const aiSuggested = transactions.filter(t => t.categorization_status === "ai_suggested").length;
  const highConfidence = transactions.filter(t => (t.ai_confidence ?? 0) >= 0.9 && t.categorization_status === "ai_suggested");

  const handleConfirm = async (tx: UncategorizedTransaction) => {
    const accountId = overrides[tx.id] ?? tx.suggested_account_id;
    if (!accountId) { toast({ title: "Select an account first", variant: "destructive" }); return; }
    const wasOverride = !!overrides[tx.id] && overrides[tx.id] !== tx.suggested_account_id;
    try {
      await confirm.mutateAsync({ transaction_id: tx.id, account_id: accountId, was_override: wasOverride });
      toast({ title: "Categorized", description: accounts.find(a => a.id === accountId)?.name });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleBulkConfirm = async () => {
    const ids = highConfidence.map(t => t.id);
    try {
      const res = await bulkConfirm.mutateAsync({ transaction_ids: ids, org_id: orgId });
      toast({ title: `${res.confirmed} transactions confirmed` });
    } catch (err) {
      toast({ title: "Bulk confirm failed", variant: "destructive" });
    }
  };

  const handleRunAI = async () => {
    try {
      const res = await runAI.mutateAsync({ org_id: orgId });
      toast({ title: `AI categorized ${res.categorized} transactions` });
    } catch (err) {
      toast({ title: "AI categorization failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">AI Categorization</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Review and confirm AI-suggested transaction categories</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highConfidence.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-success/30 text-success hover:bg-success/10" onClick={handleBulkConfirm} disabled={bulkConfirm.isPending}>
              <Check className="h-4 w-4" /> Approve {highConfidence.length} high-confidence
            </Button>
          )}
          <Button size="sm" className="gap-2 rounded-xl" onClick={handleRunAI} disabled={runAI.isPending}>
            <RefreshCw className={cn("h-4 w-4", runAI.isPending && "animate-spin")} />
            {runAI.isPending ? "Running AI..." : "Run AI"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unreviewed</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{unreviewed}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI Suggested</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{aiSuggested}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">High Confidence</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{highConfidence.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">≥ 90% confidence</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Queue</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{transactions.length}</p>
        </div>
      </div>

      {/* Transaction review list */}
      <div className="space-y-2">
        {transactions.map((tx: UncategorizedTransaction) => {
          const suggestedAccount = accounts.find(a => a.id === tx.suggested_account_id);
          const selectedAccountId = overrides[tx.id] ?? tx.suggested_account_id ?? "";

          return (
            <div key={tx.id} className={cn("glass-card rounded-2xl p-4 transition-all", tx.categorization_status === "unreviewed" && "border border-warning/20")}>
              <div className="flex items-center gap-4">
                {/* Transaction info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-medium", tx.type === "debit" ? "text-foreground" : "text-success")}>
                      {tx.type === "debit" ? "-" : "+"}{fmtCurrency(tx.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</span>
                    {tx.categorization_status === "unreviewed" && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" /> Needs AI review
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-0.5 truncate">{tx.description}</p>
                  {tx.merchant_name && tx.merchant_name !== tx.description && (
                    <p className="text-xs text-muted-foreground">{tx.merchant_name}</p>
                  )}
                </div>

                {/* AI confidence */}
                {tx.ai_confidence !== null && (
                  <div className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", confidenceBg(tx.ai_confidence))}>
                    {Math.round((tx.ai_confidence ?? 0) * 100)}% confident
                  </div>
                )}

                {/* Account selector */}
                <div className="shrink-0 w-56">
                  <Select
                    value={selectedAccountId}
                    onValueChange={v => setOverrides(prev => ({ ...prev, [tx.id]: v }))}
                  >
                    <SelectTrigger className={cn("h-9 rounded-xl text-xs border-border/50", suggestedAccount ? "bg-primary/5 border-primary/20" : "bg-background/50")}>
                      <SelectValue placeholder="Select account">
                        {suggestedAccount && !overrides[tx.id] ? (
                          <span className="flex items-center gap-1">
                            <Brain className="h-3 w-3 text-primary shrink-0" />
                            {suggestedAccount.account_number} — {suggestedAccount.name}
                          </span>
                        ) : accounts.find(a => a.id === selectedAccountId) ? (
                          `${accounts.find(a => a.id === selectedAccountId)?.account_number} — ${accounts.find(a => a.id === selectedAccountId)?.name}`
                        ) : "Select account"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {["asset", "liability", "equity", "revenue", "expense"].map(type => (
                        <div key={type}>
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{type}</div>
                          {accounts.filter(a => a.type === type).map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.account_number} — {a.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Confirm button */}
                <Button
                  size="sm"
                  className="shrink-0 rounded-xl h-9"
                  onClick={() => handleConfirm(tx)}
                  disabled={confirm.isPending || !selectedAccountId}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {transactions.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">No transactions awaiting categorization.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
