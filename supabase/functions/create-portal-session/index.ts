/// <reference path="../types/remote-modules.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

function env(key: string): string | undefined {
  const d = (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(key);
}

// PostgREST chain is fully typed under `deno check`; the workspace TS server merges weaker types for URL imports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = env("SUPABASE_URL")!;
  const anonKey = env("SUPABASE_ANON_KEY")!;
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = env("STRIPE_SECRET_KEY");

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY is not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  }) as AnySupabaseClient;
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { org_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const org_id = body.org_id;
  if (!org_id) {
    return new Response(JSON.stringify({ error: "org_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey) as AnySupabaseClient;
  const { data: membership, error: mErr } = await admin
    .from("company_memberships")
    .select("role")
    .eq("org_id", org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr || !membership) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (membership.role !== "owner" && membership.role !== "accountant") {
    return new Response(JSON.stringify({ error: "Billing is restricted for your role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: cust, error: cErr } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("org_id", org_id)
    .maybeSingle();

  if (cErr || !cust?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "No Stripe customer for this organization. Subscribe via Pricing first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const origin =
    req.headers.get("origin") ??
    (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  if (!origin) {
    return new Response(JSON.stringify({ error: "Missing Origin or Referer" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.billingPortal.sessions.create({
    customer: cust.stripe_customer_id,
    return_url: `${origin}/settings?tab=billing`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
