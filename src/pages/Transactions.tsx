import { type ChangeEventHandler, useRef, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Sparkles,
  Filter,
  Download,
  Search,
  Plus,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt,
  Upload,
  Link2,
  Link2Off,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useToast } from "@/hooks/use-toast";
import { useTransactions, useCreateTransaction, useMatchTransaction } from "@/hooks/useTransactions";
import { useOrgId } from "@/hooks/useCompanies";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import type { BankTransaction } from "@/integrations/supabase/types";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const confidenceColor = (c: number | null) => {
  if (c === null) return "text-muted-foreground";
  if (c >= 0.9) return "text-success";
  if (c >= 0.7) return "text-warning";
  return "text-destructive";
};

const typeIcon = (type: string) => {
  if (type === "income") return <ArrowDownLeft className="h-3.5 w-3.5" />;
  if (type === "transfer") return <ArrowLeftRight className="h-3.5 w-3.5" />;
  return <ArrowUpRight className="h-3.5 w-3.5" />;
};

const typeIconBg = (type: string) => {
  if (type === "income") return "bg-success/10 text-success";
  if (type === "transfer") return "bg-primary/10 text-primary";
  return "bg-accent/10 text-accent";
};

export default function Transactions() {
  const { toast } = useToast();
  const orgId = useOrgId();

  // Hooks
  const { data: transactions = [], isLoading, isError, error, refetch } = useTransactions({ orgId });
  const createTransaction = useCreateTransaction();
  const matchTransaction = useMatchTransaction();
  const { data: bankAccounts = [], isLoading: bankLoading } = useBankAccounts();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Local state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [form, setForm] = useState({
    bank_account_id: "",
    date: "",
    description: "",
    merchant: "",
    amount: "",
    type: "expense" as "income" | "expense" | "transfer",
    category: "",
  });

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (tx.description ?? "").toLowerCase().includes(q) ||
        (tx.merchant ?? "").toLowerCase().includes(q) ||
        (tx.category ?? "").toLowerCase().includes(q);
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, filterType]);

  // Stats
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions],
  );
  const totalExpenses = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions],
  );
  const unmatchedCount = useMemo(
    () => transactions.filter((t) => !t.is_matched).length,
    [transactions],
  );

  // Create handler
  const handleCreate = async () => {
    if (!form.bank_account_id) {
      toast({ title: "Select an account", description: "Choose a bank account for this transaction.", variant: "destructive" });
      return;
    }
    if (!form.date || !form.description || !form.amount) {
      toast({ title: "Fill required fields", description: "Date, description, and amount are required.", variant: "destructive" });
      return;
    }
    const rawAmount = parseFloat(form.amount);
    if (isNaN(rawAmount)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const amount = form.type === "expense" ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    try {
      await createTransaction.mutateAsync({
        org_id: orgId,
        bank_account_id: form.bank_account_id,
        date: form.date,
        description: form.description,
        merchant: form.merchant || null,
        amount,
        type: form.type,
        category: form.category || null,
        is_matched: false,
        is_reconciled: false,
        is_pending: false,
      });
      toast({ title: "Transaction created" });
      setShowNewDialog(false);
      setForm({ bank_account_id: "", date: "", description: "", merchant: "", amount: "", type: "expense", category: "" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  // Match toggle handler
  const handleToggleMatch = async (tx: BankTransaction) => {
    try {
      await matchTransaction.mutateAsync({
        id: tx.id,
        is_matched: !tx.is_matched,
        category: tx.ai_suggested_category ?? undefined,
      });
      toast({
        title: tx.is_matched ? "Unmatched" : "Matched",
        description: !tx.is_matched && tx.ai_suggested_category
          ? `Category set to "${tx.ai_suggested_category}"`
          : undefined,
      });
    } catch (err) {
      toast({ title: "Failed to update", description: (err as Error).message, variant: "destructive" });
    }
  };

  // CSV export
  const handleExport = () => {
    const headers = ["Date", "Description", "Merchant", "Amount", "Type", "Category", "Matched", "AI Confidence"];
    const rows = filtered.map((tx) => [
      tx.date,
      `"${(tx.description ?? "").replace(/"/g, '""')}"`,
      `"${(tx.merchant ?? "").replace(/"/g, '""')}"`,
      tx.amount.toFixed(2),
      tx.type,
      tx.category ?? "",
      tx.is_matched ? "Yes" : "No",
      tx.ai_confidence !== null ? `${Math.round(tx.ai_confidence * 100)}%` : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filtered.length} transactions exported to CSV.` });
  };

  const parseCsvRows = (csvText: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(value.trim());
        value = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(value.trim());
        value = "";
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
      } else {
        value += ch;
      }
    }

    if (value.length > 0 || row.length > 0) {
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
    }

    return rows;
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportCsv: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const csvText = await file.text();
      const rows = parseCsvRows(csvText);
      if (rows.length < 2) {
        toast({ title: "Import failed", description: "CSV is empty or missing data rows.", variant: "destructive" });
        return;
      }

      const headerIndex = new Map(
        rows[0].map((h, i) => [h.replace(/^"|"$/g, "").trim().toLowerCase(), i] as const),
      );

      const dateIdx = headerIndex.get("date");
      const descIdx = headerIndex.get("description");
      const amountIdx = headerIndex.get("amount");
      const merchantIdx = headerIndex.get("merchant");
      const typeIdx = headerIndex.get("type");
      const categoryIdx = headerIndex.get("category");

      if (dateIdx === undefined || descIdx === undefined || amountIdx === undefined) {
        toast({
          title: "Import failed",
          description: "CSV must include Date, Description, and Amount columns.",
          variant: "destructive",
        });
        return;
      }

      let imported = 0;
      let skipped = 0;
      const importBankId = bankAccounts[0]?.id;
      if (!importBankId) {
        toast({
          title: "Import failed",
          description: bankLoading ? "Bank accounts are still loading. Try again in a moment." : "Create or connect a bank account before importing.",
          variant: "destructive",
        });
        return;
      }
      for (const cells of rows.slice(1)) {
        const date = (cells[dateIdx] ?? "").replace(/^"|"$/g, "").trim();
        const description = (cells[descIdx] ?? "").replace(/^"|"$/g, "").trim();
        const amountText = (cells[amountIdx] ?? "").replace(/^"|"$/g, "").replace(/\$/g, "").replace(/,/g, "").trim();
        const merchant = merchantIdx !== undefined ? (cells[merchantIdx] ?? "").replace(/^"|"$/g, "").trim() : "";
        const category = categoryIdx !== undefined ? (cells[categoryIdx] ?? "").replace(/^"|"$/g, "").trim() : "";
        const typeRaw = typeIdx !== undefined ? (cells[typeIdx] ?? "").replace(/^"|"$/g, "").trim().toLowerCase() : "";
        const amount = parseFloat(amountText);

        if (!date || !description || Number.isNaN(amount)) {
          skipped++;
          continue;
        }

        const normalizedType: "income" | "expense" | "transfer" =
          typeRaw === "income" || typeRaw === "expense" || typeRaw === "transfer"
            ? typeRaw
            : amount >= 0
              ? "income"
              : "expense";

        await createTransaction.mutateAsync({
          org_id: orgId,
          bank_account_id: importBankId,
          date,
          description,
          merchant: merchant || null,
          amount,
          type: normalizedType,
          category: category || null,
          is_matched: false,
          is_reconciled: false,
          is_pending: false,
        });
        imported++;
      }

      toast({
        title: "CSV import completed",
        description: `Imported ${imported} transaction(s)${skipped ? `, skipped ${skipped}` : ""}.`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <CommandPalette />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Transactions</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              AI-categorized and reconciled &middot; {filtered.length} of {transactions.length} shown
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50" onClick={handleImportClick}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4" /> New Transaction
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Transactions</p>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{transactions.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{filtered.length} matching filters</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Income</p>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-success">{fmtCurrency(totalIncome)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {transactions.filter((t) => t.type === "income").length} transactions
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Expenses</p>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{fmtCurrency(totalExpenses)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {transactions.filter((t) => t.type === "expense").length} transactions
          </p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unmatched</p>
            <AlertCircle className="h-4 w-4 text-warning" />
          </div>
          <p className={cn("mt-1 font-display text-2xl font-bold", unmatchedCount === 0 ? "text-success" : "text-warning")}>
            {unmatchedCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {unmatchedCount === 0 ? "All matched" : "Need review"}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by description or merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border/50 bg-secondary/30 pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(["all", "income", "expense", "transfer"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "rounded-xl border px-3.5 py-2 text-xs font-medium transition-all capitalize",
                filterType === t
                  ? t === "income"
                    ? "bg-success/15 text-success border-success/30"
                    : t === "expense"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : t === "transfer"
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-primary/15 text-primary border-primary/30"
                  : "bg-secondary/40 text-muted-foreground border-border/30 hover:text-foreground hover:border-border/60",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="glass-card overflow-hidden rounded-2xl">
        {isError && (
          <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load live transactions: {(error as Error)?.message ?? "Unknown error"}
            <Button variant="link" className="ml-2 h-auto p-0 text-destructive underline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-3 text-sm text-muted-foreground">Loading transactions...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Details</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Match</th>
                  <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">AI</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {transactions.length === 0
                          ? "No transactions yet. Create one to get started."
                          : "No transactions match your search or filters."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => (
                    <tr key={tx.id} className="group border-b border-border/20 transition-colors hover:bg-secondary/20">
                      {/* Date */}
                      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(tx.date)}
                      </td>

                      {/* Details: icon + merchant + description */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeIconBg(tx.type))}>
                            {typeIcon(tx.type)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {tx.merchant ?? "Unknown"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category badge */}
                      <td className="px-5 py-4">
                        {tx.category ? (
                          <span className="inline-block rounded-lg bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground">
                            {tx.category}
                          </span>
                        ) : tx.ai_suggested_category ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-2.5 py-1 text-xs font-medium text-warning">
                            <Sparkles className="h-3 w-3" />
                            {tx.ai_suggested_category}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Match status */}
                      <td className="px-5 py-4">
                        {tx.is_matched ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                            <Link2 className="h-3 w-3" /> Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                            <Link2Off className="h-3 w-3" /> Unmatched
                          </span>
                        )}
                      </td>

                      {/* AI confidence */}
                      <td className="px-5 py-4">
                        {tx.ai_confidence !== null ? (
                          <div className="flex items-center gap-1.5">
                            <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className={cn("text-xs font-semibold", confidenceColor(tx.ai_confidence))}>
                              {Math.round(tx.ai_confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className={cn(
                        "px-5 py-4 text-right text-sm font-semibold whitespace-nowrap",
                        tx.type === "income" ? "text-success" : tx.type === "transfer" ? "text-primary" : "text-foreground",
                      )}>
                        {tx.type === "income" ? "+" : ""}{fmtCurrency(Math.abs(tx.amount))}
                      </td>

                      {/* Action: toggle match */}
                      <td className="px-3 py-4">
                        <button
                          onClick={() => handleToggleMatch(tx)}
                          title={tx.is_matched ? "Unmatch transaction" : "Match transaction"}
                          className={cn(
                            "rounded-lg p-1.5 transition-all",
                            "opacity-0 group-hover:opacity-100",
                            tx.is_matched
                              ? "text-success hover:bg-success/10"
                              : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Transaction Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">New Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Bank Account *</Label>
              <Select
                value={form.bank_account_id}
                onValueChange={(v) => setForm((f) => ({ ...f, bank_account_id: v }))}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder={bankLoading ? "Loading accounts..." : "Select an account"} />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} — {a.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!bankLoading && bankAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">No bank accounts found. Create/connect one first.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as "income" | "expense" | "transfer" }))}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Invoice payment from Acme Corp"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Merchant</Label>
                <Input
                  placeholder="e.g. Stripe"
                  value={form.merchant}
                  onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                placeholder="e.g. Revenue, Software, Payroll"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreate} disabled={createTransaction.isPending}>
                {createTransaction.isPending ? "Creating..." : "Create Transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
