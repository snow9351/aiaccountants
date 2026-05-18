import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

function monthBounds(): { start: string; end: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { start: fmt(start), end: fmt(end), label };
}

/** Answer expense questions from live DB when the AI edge function is unavailable. */
export async function tryExpenseFallbackAnswer(query: string, orgId: string): Promise<string | null> {
  const q = query.toLowerCase();
  if (!isSupabaseConfigured || !orgId) return null;
  const expenseIntent =
    q.includes("expense") ||
    q.includes("spend") ||
    q.includes("cost") ||
    q.includes("paid") ||
    (q.includes("this month") && (q.includes("how much") || q.includes("total") || q.includes("what")));
  if (!expenseIntent) return null;

  const { start, end, label } = monthBounds();
  const { data, error } = await supabase
    .from("expenses")
    .select("vendor_name, amount, category, date, description")
    .eq("org_id", orgId)
    .gte("date", start)
    .lte("date", end)
    .order("amount", { ascending: false });

  if (error) return null;

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  if (rows.length === 0) {
    return `No expenses are recorded for **${label}** in this company yet. Add expenses under **Expenses** or pay a vendor bill to see totals here.`;
  }

  const top = rows.slice(0, 8);
  const lines = top
    .map(
      (r, i) =>
        `| ${i + 1} | ${r.date ?? "—"} | ${r.vendor_name ?? r.description ?? "—"} | ${r.category ?? "Uncategorized"} | $${Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} |`,
    )
    .join("\n");

  return `**Expenses for ${label}** (from your ledger — offline summary)\n\n**Total:** $${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} across **${rows.length}** entries\n\n| # | Date | Vendor | Category | Amount |\n|---|------|--------|----------|--------|\n${lines}${rows.length > 8 ? `\n\n_…and ${rows.length - 8} more._` : ""}`;
}

export function formatAiInvokeError(error: unknown, data: unknown): string {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: string }).error === "string") {
    return (data as { error: string }).error;
  }
  if (error instanceof Error) return error.message;
  return "AI service unavailable";
}
