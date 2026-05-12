import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Wallet,
  PiggyBank,
  CreditCard,
  Building,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import {
  useBankAccounts,
  useCreateBankAccount,
  useReconciliationQueue,
} from "@/hooks/useBankAccounts";
import { useMatchTransaction } from "@/hooks/useTransactions";
import { useOrgId } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import type { BankAccount, BankTransaction } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

const fmtCurrencyCents = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(v);

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ACCOUNT_TYPE_ICON: Record<BankAccount["account_type"], React.ReactNode> = {
  checking: <Wallet className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
  credit: <CreditCard className="h-5 w-5" />,
  investment: <Landmark className="h-5 w-5" />,
};

const ACCOUNT_TYPE_STYLE: Record<BankAccount["account_type"], string> = {
  checking: "bg-primary/10 text-primary",
  savings: "bg-success/10 text-success",
  credit: "bg-accent/10 text-accent",
  investment: "bg-info/10 text-info",
};

const SYNC_STATUS_CONFIG: Record<
  BankAccount["sync_status"],
  { className: string; label: string }
> = {
  synced: {
    className: "bg-success/10 text-success border-success/20",
    label: "Synced",
  },
  syncing: {
    className: "bg-info/10 text-info border-info/20 animate-pulse",
    label: "Syncing",
  },
  failed: {
    className: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Failed",
  },
  disconnected: {
    className: "bg-muted text-muted-foreground border-border/30",
    label: "Disconnected",
  },
};

export default function Banking() {
  const { toast } = useToast();
  const orgId = useOrgId();
  const { data: accounts = [], isLoading: accountsLoading } = useBankAccounts({ orgId });
  const { data: queue = [], isLoading: queueLoading } = useReconciliationQueue();
  const createAccount = useCreateBankAccount();
  const matchTransaction = useMatchTransaction();

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    account_name: "",
    bank_name: "",
    account_type: "checking" as BankAccount["account_type"],
  });

  const totalBalance = accounts.reduce(
    (sum: number, a: BankAccount) => sum + a.current_balance,
    0
  );
  const queueCount = queue.length;

  const handleCreate = async () => {
    if (!form.account_name) {
      toast({ title: "Account name is required", variant: "destructive" });
      return;
    }
    if (!form.bank_name) {
      toast({ title: "Bank name is required", variant: "destructive" });
      return;
    }
    try {
      await createAccount.mutateAsync({
        account_name: form.account_name,
        bank_name: form.bank_name,
        account_type: form.account_type,
        org_id: orgId,
        currency: "USD",
        current_balance: 0,
        is_active: true,
        sync_status: "disconnected",
        account_number_masked: null,
        gl_account_id: null,
        plaid_account_id: null,
        last_sync_at: null,
      });
      toast({ title: "Bank account connected", description: form.account_name });
      setShowDialog(false);
      setForm({ account_name: "", bank_name: "", account_type: "checking" });
    } catch (err) {
      toast({
        title: "Failed to connect account",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleAccept = async (tx: BankTransaction) => {
    try {
      await matchTransaction.mutateAsync({
        id: tx.id,
        is_matched: true,
        category: tx.ai_suggested_category ?? undefined,
      });
      toast({ title: "Transaction accepted", description: tx.description });
    } catch (err) {
      toast({
        title: "Match failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (tx: BankTransaction) => {
    try {
      await matchTransaction.mutateAsync({
        id: tx.id,
        is_matched: false,
        category: undefined,
      });
      toast({ title: "Transaction rejected", description: tx.description });
    } catch (err) {
      toast({
        title: "Reject failed",
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
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Banking & Reconciliation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered bank feed matching with confidence scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-border/50"
          >
            <RefreshCw className="h-4 w-4" /> Sync All
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-xl glow-primary"
            onClick={() => setShowDialog(true)}
          >
            <Plus className="h-4 w-4" /> Connect Bank
          </Button>
        </div>
      </div>

      {/* Bank Account Cards */}
      {accountsLoading ? (
        <div className="mb-6 flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc: BankAccount) => {
            const syncCfg = SYNC_STATUS_CONFIG[acc.sync_status];
            return (
              <div
                key={acc.id}
                className="glass-card rounded-2xl p-5 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        ACCOUNT_TYPE_STYLE[acc.account_type]
                      )}
                    >
                      {ACCOUNT_TYPE_ICON[acc.account_type]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {acc.account_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {acc.bank_name}
                        {acc.account_number_masked && (
                          <span className="ml-1.5 font-mono text-[11px] opacity-70">
                            {acc.account_number_masked}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      syncCfg.className
                    )}
                  >
                    {syncCfg.label}
                  </span>
                </div>

                <p
                  className={cn(
                    "mt-4 font-display text-2xl font-bold",
                    acc.current_balance < 0 ? "text-destructive" : "text-foreground"
                  )}
                >
                  {fmtCurrency(acc.current_balance)}
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Last synced {timeAgo(acc.last_sync_at)}
                  </p>
                  <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                    {acc.account_type}
                  </span>
                </div>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="col-span-full glass-card rounded-2xl p-12 text-center">
              <Building className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No bank accounts connected yet.
              </p>
              <Button
                size="sm"
                className="mt-4 gap-2 rounded-xl"
                onClick={() => setShowDialog(true)}
              >
                <Plus className="h-4 w-4" /> Connect Your First Account
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Balance
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {fmtCurrency(totalBalance)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connected Accounts
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">
            {accounts.length}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Needs Review
          </p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-bold",
              queueCount > 0 ? "text-warning" : "text-success"
            )}
          >
            {queueCount}
          </p>
        </div>
      </div>

      {/* Reconciliation Queue */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold text-foreground">
              Reconciliation Queue
            </h3>
            {queueCount > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                {queueCount} unmatched
              </span>
            )}
          </div>
        </div>

        {queueLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : queue.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success/60" />
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No unmatched transactions in the queue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((tx: BankTransaction) => {
              const confidence = tx.ai_confidence
                ? Math.round(tx.ai_confidence * 100)
                : null;
              const isIncome = tx.amount > 0;

              return (
                <div
                  key={tx.id}
                  className="group flex flex-col gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4 transition-all hover:bg-warning/10 sm:flex-row sm:items-center"
                >
                  {/* Direction Icon */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      isIncome
                        ? "bg-success/10 text-success"
                        : "bg-accent/10 text-accent"
                    )}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Description + Date */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {tx.description}
                      </p>
                      {confidence !== null && confidence < 60 && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {tx.merchant && (
                        <span className="ml-1.5">
                          &middot; {tx.merchant}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* AI Category + Confidence */}
                  <div className="flex items-center gap-3">
                    {tx.ai_suggested_category && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-foreground">
                          {tx.ai_suggested_category}
                        </span>
                      </div>
                    )}
                    {confidence !== null && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          confidence >= 90
                            ? "bg-success/10 text-success"
                            : confidence >= 70
                              ? "bg-warning/10 text-warning"
                              : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {confidence}% conf
                      </span>
                    )}
                  </div>

                  {/* Amount */}
                  <p
                    className={cn(
                      "w-28 text-right text-sm font-semibold tabular-nums",
                      isIncome ? "text-success" : "text-foreground"
                    )}
                  >
                    {isIncome ? "+" : ""}
                    {fmtCurrencyCents(tx.amount)}
                  </p>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-2 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-xl border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(tx)}
                      disabled={matchTransaction.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-xl text-xs"
                      onClick={() => handleAccept(tx)}
                      disabled={matchTransaction.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Bank Account Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="rounded-2xl border-border/50 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Connect Bank Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Account Name *</Label>
              <Input
                placeholder="Business Checking"
                value={form.account_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, account_name: e.target.value }))
                }
                className="rounded-xl bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bank Name *</Label>
              <Input
                placeholder="Chase Bank"
                value={form.bank_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank_name: e.target.value }))
                }
                className="rounded-xl bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select
                value={form.account_type}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    account_type: val as BankAccount["account_type"],
                  }))
                }
              >
                <SelectTrigger className="rounded-xl bg-background/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
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
                disabled={createAccount.isPending}
              >
                {createAccount.isPending ? "Connecting..." : "Connect Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
