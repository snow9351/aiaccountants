import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAID_BASE = Deno.env.get("PLAID_ENV") === "production"
  ? "https://production.plaid.com"
  : "https://sandbox.plaid.com";

const plaidHeaders = {
  "Content-Type": "application/json",
  "PLAID-CLIENT-ID": Deno.env.get("PLAID_CLIENT_ID")!,
  "PLAID-SECRET": Deno.env.get("PLAID_SECRET")!,
};

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, org_id, public_token, institution_id, institution_name, bank_account_id } = await req.json();

  if (action === "create_link_token") {
    const res = await fetch(`${PLAID_BASE}/link/token/create`, {
      method: "POST",
      headers: plaidHeaders,
      body: JSON.stringify({
        user: { client_user_id: org_id },
        client_name: "ConnectCash AI",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ link_token: data.link_token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "exchange_token") {
    // Exchange public token for access token
    const res = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
      method: "POST",
      headers: plaidHeaders,
      body: JSON.stringify({ public_token }),
    });
    const { access_token, item_id } = await res.json();

    // Store connection
    const { data: conn } = await supabase.from("plaid_connections").insert({
      org_id, bank_account_id, access_token, item_id,
      institution_id, institution_name, status: "active",
    }).select().single();

    // Trigger initial sync
    await syncTransactions(access_token, item_id, org_id, bank_account_id, supabase);

    return new Response(JSON.stringify({ connection_id: conn?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "sync") {
    const { data: connection } = await supabase.from("plaid_connections").select("*").eq("org_id", org_id).eq("status", "active").single();
    if (!connection) return new Response(JSON.stringify({ error: "No active connection" }), { status: 404, headers: corsHeaders });
    const count = await syncTransactions(connection.access_token, connection.item_id, org_id, bank_account_id, supabase);
    return new Response(JSON.stringify({ synced: count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
});

async function syncTransactions(accessToken: string, itemId: string, orgId: string, bankAccountId: string, supabase: any): Promise<number> {
  // Get cursor for incremental sync
  const { data: conn } = await supabase.from("plaid_connections").select("cursor").eq("item_id", itemId).single();
  let cursor = conn?.cursor ?? "";
  let added = 0, modified = 0;
  let hasMore = true;

  while (hasMore) {
    const body: any = { access_token: accessToken, cursor };
    if (!cursor) delete body.cursor;

    const res = await fetch("https://sandbox.plaid.com/transactions/sync", {
      method: "POST",
      headers: plaidHeaders,
      body: JSON.stringify(body),
    });
    const data = await res.json();

    for (const tx of (data.added ?? [])) {
      // Deduplication: check if already exists by plaid transaction_id
      const { count } = await supabase.from("bank_transactions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("description", tx.transaction_id); // store plaid id in description for dedup

      if (count === 0) {
        await supabase.from("bank_transactions").insert({
          org_id: orgId,
          bank_account_id: bankAccountId,
          date: tx.date,
          description: tx.name,
          amount: Math.abs(tx.amount),
          type: tx.amount < 0 ? "credit" : "debit",
          status: "posted",
          categorization_status: "unreviewed",
          merchant_name: tx.merchant_name,
          metadata: { plaid_transaction_id: tx.transaction_id, plaid_category: tx.category },
        });
        added++;
      }
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
    modified += (data.modified ?? []).length;
  }

  await supabase.from("plaid_connections").update({ cursor, last_synced_at: new Date().toISOString() }).eq("item_id", itemId);
  return added;
}
