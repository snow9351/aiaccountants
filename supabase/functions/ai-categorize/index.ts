import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MODEL_VERSION = "v1.0-claude";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { org_id, transaction_ids } = await req.json();

  // Fetch unreviewed transactions
  let query = supabase.from("bank_transactions")
    .select("id, description, amount, type, merchant_name, date, metadata")
    .eq("org_id", org_id)
    .eq("categorization_status", "unreviewed");

  if (transaction_ids?.length) query = query.in("id", transaction_ids);
  const { data: transactions } = await query.limit(50);

  if (!transactions?.length) return new Response(JSON.stringify({ categorized: 0 }), { headers: corsHeaders });

  // Fetch org's accounts for context
  const { data: accounts } = await supabase.from("accounts")
    .select("id, account_number, name, type, sub_type")
    .eq("org_id", org_id)
    .eq("is_active", true)
    .order("account_number");

  // Fetch historical signals for this org (training data from user overrides)
  const { data: signals } = await supabase.from("ai_categorization_signals")
    .select("merchant_name, description_normalized, confirmed_account_id, was_overridden")
    .eq("org_id", org_id)
    .not("confirmed_account_id", "is", null)
    .limit(200);

  // Build prompt for Claude
  const accountList = accounts?.map(a => `${a.account_number} - ${a.name} (${a.type})`).join("\n") ?? "";
  const historicalPatterns = signals?.filter(s => s.was_overridden)
    .slice(0, 50)
    .map(s => `"${s.merchant_name ?? s.description_normalized}" → account ${s.confirmed_account_id}`)
    .join("\n") ?? "";

  const txList = transactions.map(t =>
    `ID: ${t.id} | ${t.type === "debit" ? "DEBIT" : "CREDIT"} $${t.amount} | "${t.description}" ${t.merchant_name ? `(${t.merchant_name})` : ""} | ${t.date}`
  ).join("\n");

  const prompt = `You are an expert bookkeeper. Categorize each bank transaction to the most appropriate account from the chart of accounts below.

CHART OF ACCOUNTS:
${accountList}

HISTORICAL CATEGORIZATIONS (user-confirmed):
${historicalPatterns || "None yet"}

TRANSACTIONS TO CATEGORIZE:
${txList}

For each transaction, respond with a JSON array of objects with:
- transaction_id: the ID
- account_id: the account ID from the chart of accounts (must be an exact match)
- account_number: the account number
- confidence: 0.0-1.0 (be conservative — use 0.95+ only when very certain, 0.7-0.95 when likely, below 0.7 when uncertain)
- reasoning: brief explanation (max 15 words)

Return ONLY the JSON array, no other text.`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", // fast + cheap for categorization
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const anthropicData = await anthropicRes.json();
  const responseText = anthropicData.content?.[0]?.text ?? "[]";

  let categorizations: Array<{ transaction_id: string; account_id: string; account_number: string; confidence: number; reasoning: string }> = [];
  try {
    categorizations = JSON.parse(responseText);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: responseText }), { status: 500, headers: corsHeaders });
  }

  // Apply categorizations
  let categorized = 0;
  for (const cat of categorizations) {
    const tx = transactions.find(t => t.id === cat.transaction_id);
    if (!tx) continue;

    await supabase.from("bank_transactions").update({
      suggested_account_id: cat.account_id,
      ai_confidence: cat.confidence,
      ai_model_version: MODEL_VERSION,
      categorization_status: "ai_suggested",
    }).eq("id", cat.transaction_id);

    // Store signal for training
    await supabase.from("ai_categorization_signals").insert({
      org_id,
      transaction_id: cat.transaction_id,
      merchant_name: tx.merchant_name,
      description_normalized: (tx.description ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().slice(0, 100),
      amount_range: tx.amount < 50 ? "0-50" : tx.amount < 200 ? "50-200" : tx.amount < 1000 ? "200-1000" : "1000+",
      suggested_account_id: cat.account_id,
      confidence: cat.confidence,
      model_version: MODEL_VERSION,
    });

    categorized++;
  }

  return new Response(JSON.stringify({ categorized, total: transactions.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
