import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

  // Get price ID from plans table
  const priceField = billing_interval === "annually" ? "stripe_price_id_annually" : "stripe_price_id_monthly";
  const { data: planData } = await supabase.from("plans").select(priceField).eq("name", plan).single();
  const priceId = planData?.[priceField];

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
