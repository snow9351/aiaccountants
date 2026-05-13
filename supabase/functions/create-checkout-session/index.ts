/// <reference path="../types/remote-modules.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

function env(key: string): string | undefined {
  const d = (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(key);
}

type PlanPriceOverrideMap = Record<string, { monthly?: string; annually?: string }>;

function parsePlanPriceOverrideMap(raw: string | undefined): PlanPriceOverrideMap | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    return v as PlanPriceOverrideMap;
  } catch {
    return undefined;
  }
}

function priceIdFromEnv(plan: string, billing_interval: string): string | undefined {
  const map = parsePlanPriceOverrideMap(env("STRIPE_PLAN_PRICE_IDS"));
  const slot = billing_interval === "annually" ? "annually" : "monthly";
  return map?.[plan]?.[slot]?.trim() || undefined;
}

const stripe = new Stripe(env("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
  const { plan, billing_interval, org_id, user_id, success_url, cancel_url } = await req.json();

  // Get or create Stripe customer
  let stripeCustomerId: string;
  const { data: existing } = await supabase.from("stripe_customers").select("stripe_customer_id").eq("org_id", org_id).single();

  if (existing?.stripe_customer_id) {
    stripeCustomerId = existing.stripe_customer_id;
  } else {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", org_id).single();
    const { data: user } = await supabase.auth.admin.getUserById(user_id);
    const customer = await stripe.customers.create({
      email: user.user?.email,
      name: org?.name,
      metadata: { org_id, user_id },
    });
    stripeCustomerId = customer.id;
    await supabase.from("stripe_customers").insert({ org_id, user_id, stripe_customer_id: stripeCustomerId });
    await supabase.from("organizations").update({ stripe_customer_id: stripeCustomerId }).eq("id", org_id);
  }

  // Price ID: DB first, then optional STRIPE_PLAN_PRICE_IDS secret (same JSON as VITE_STRIPE_PLAN_PRICE_IDS)
  const priceField = billing_interval === "annually" ? "stripe_price_id_annually" : "stripe_price_id_monthly";
  const { data: planData } = await supabase.from("plans").select(priceField).eq("name", plan).single();
  const fromDb = planData?.[priceField as keyof typeof planData];
  const priceId =
    (typeof fromDb === "string" && fromDb.trim().length > 0 ? fromDb.trim() : undefined) ?? priceIdFromEnv(plan, billing_interval);

  if (!priceId) {
    return new Response(JSON.stringify({ error: `No Stripe price configured for plan: ${plan}` }), { status: 400, headers: corsHeaders });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { org_id, plan }, trial_period_days: 14 },
    success_url: success_url ?? `${req.headers.get("origin")}/settings?tab=billing&success=1`,
    cancel_url: cancel_url ?? `${req.headers.get("origin")}/pricing`,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
