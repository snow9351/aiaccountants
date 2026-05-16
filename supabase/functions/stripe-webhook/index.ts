import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const getOrgId = async (customerId: string) => {
    const { data } = await supabase.from("stripe_customers").select("org_id").eq("stripe_customer_id", customerId).single();
    return data?.org_id;
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = await getOrgId(sub.customer as string);
      const plan = sub.metadata?.plan ?? "starter";
      await supabase.from("subscriptions").upsert({
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        org_id: orgId,
        plan,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      }, { onConflict: "stripe_subscription_id" });
      if (orgId) {
        await supabase.from("organizations").update({ subscription_status: sub.status, plan }).eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = await getOrgId(sub.customer as string);
      await supabase.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id);
      if (orgId) await supabase.from("organizations").update({ subscription_status: "canceled" }).eq("id", orgId);
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const orgId = await getOrgId(inv.customer as string);
      const { data: sub } = await supabase.from("subscriptions").select("dunning_count").eq("stripe_subscription_id", inv.subscription as string).single();
      const dunningCount = (sub?.dunning_count ?? 0) + 1;
      const graceDays = dunningCount === 1 ? 3 : dunningCount === 2 ? 7 : 14;
      await supabase.from("subscriptions").update({
        status: "past_due",
        dunning_count: dunningCount,
        dunning_grace_until: new Date(Date.now() + graceDays * 86400000).toISOString(),
      }).eq("stripe_subscription_id", inv.subscription as string);
      if (orgId) await supabase.from("organizations").update({ subscription_status: "past_due" }).eq("id", orgId);
      // Log to audit
      await supabase.from("audit_log").insert({ org_id: orgId, actor_type: "system", actor_name: "Stripe", action: "PAYMENT_FAILED", target_description: `Invoice ${inv.id} payment failed. Dunning attempt ${dunningCount}.` });
      break;
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      await supabase.from("subscriptions").update({ status: "active", dunning_count: 0, dunning_grace_until: null }).eq("stripe_subscription_id", inv.subscription as string);
      const orgId = await getOrgId(inv.customer as string);
      if (orgId) await supabase.from("organizations").update({ subscription_status: "active" }).eq("id", orgId);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId && session.payment_status === "paid") {
        const amount = (session.amount_total ?? 0) / 100;
        const pi = session.payment_intent as string | undefined;
        await supabase.rpc("apply_stripe_invoice_payment", {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_stripe_payment_intent_id: pi ?? session.id,
          p_reference: session.id,
        });
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        const amount = (pi.amount_received ?? 0) / 100;
        await supabase.rpc("apply_stripe_invoice_payment", {
          p_invoice_id: invoiceId,
          p_amount: amount,
          p_stripe_payment_intent_id: pi.id,
          p_reference: pi.id,
        });
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
