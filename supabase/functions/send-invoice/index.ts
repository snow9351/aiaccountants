/// <reference path="../types/remote-modules.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

function env(key: string): string | undefined {
  const d = (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return d?.env.get(key);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = env("SUPABASE_URL")!;
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = env("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("*, customers(name, email)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await admin
      .from("company_memberships")
      .select("org_id")
      .eq("org_id", invoice.org_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const balanceDue = Math.max(Number(invoice.total) - Number(invoice.amount_paid), 0);
    let paymentLinkUrl = invoice.payment_link_url as string | null;

    const stripeKey = env("STRIPE_SECRET_KEY");
    if (stripeKey && balanceDue > 0) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

      let stripeCustomerId: string | undefined;
      const { data: sc } = await admin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("org_id", invoice.org_id)
        .maybeSingle();
      stripeCustomerId = sc?.stripe_customer_id;

      const link = await stripe.paymentLinks.create({
        line_items: [
          {
            price_data: {
              currency: (invoice.currency ?? "usd").toLowerCase(),
              product_data: {
                name: `Invoice ${invoice.invoice_number}`,
                description: invoice.notes ?? undefined,
              },
              unit_amount: Math.round(balanceDue * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          org_id: invoice.org_id,
        },
        payment_intent_data: {
          metadata: {
            invoice_id: invoice.id,
            org_id: invoice.org_id,
          },
        },
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      });

      paymentLinkUrl = link.url;
      await admin
        .from("invoices")
        .update({
          stripe_payment_link_id: link.id,
          payment_link_url: link.url,
        })
        .eq("id", invoice_id);
    }

    if (invoice.status === "draft") {
      await admin
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoice_id);
    }

    const customer = invoice.customers as { name?: string; email?: string } | null;
    let emailSent = false;
    const resendKey = env("RESEND_API_KEY");
    const fromEmail = env("INVOICE_FROM_EMAIL") ?? "billing@connectcash.app";

    if (resendKey && customer?.email) {
      const payBlock = paymentLinkUrl
        ? `<p><a href="${paymentLinkUrl}">Pay online (card or ACH)</a></p>`
        : "";
      const html = `
        <p>Hello${customer.name ? ` ${customer.name}` : ""},</p>
        <p>Please find invoice <strong>${invoice.invoice_number}</strong> for <strong>$${balanceDue.toFixed(2)}</strong> due ${invoice.due_date}.</p>
        ${payBlock}
        <p>Thank you.</p>
      `;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: customer.email,
          subject: `Invoice ${invoice.invoice_number}`,
          html,
        }),
      });
      emailSent = res.ok;
    }

    return new Response(
      JSON.stringify({
        payment_link_url: paymentLinkUrl,
        email_sent: emailSent,
        balance_due: balanceDue,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
