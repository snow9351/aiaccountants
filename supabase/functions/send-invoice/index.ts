/// <reference path="../types/remote-modules.d.ts" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json(
        {
          error: "Edge function misconfigured",
          details: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY missing",
        },
        500,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr) {
      console.error("invoice load error", invErr);
      return json({ error: invErr.message, details: invErr.code }, 500);
    }
    if (!invoice) {
      return json({ error: "Invoice not found", invoice_id }, 404);
    }

    const { data: membership } = await admin
      .from("company_memberships")
      .select("org_id")
      .eq("org_id", invoice.org_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership) return json({ error: "Forbidden" }, 403);

    let customerName: string | null = null;
    let customerEmail: string | null = null;

    const { data: contact } = await admin
      .from("contacts")
      .select("display_name, email")
      .eq("customer_id", invoice.customer_id)
      .eq("org_id", invoice.org_id)
      .maybeSingle();

    if (contact) {
      customerName = contact.display_name;
      customerEmail = contact.email;
    } else {
      const { data: cust } = await admin
        .from("customers")
        .select("name, display_name, email")
        .eq("id", invoice.customer_id)
        .maybeSingle();
      customerName = cust?.display_name ?? cust?.name ?? null;
      customerEmail = cust?.email ?? null;
    }

    const balanceDue = Math.max(Number(invoice.total) - Number(invoice.amount_paid), 0);
    let paymentLinkUrl = (invoice.payment_link_url as string | null) ?? null;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && balanceDue > 0) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
        const link = await stripe.paymentLinks.create({
          line_items: [
            {
              price_data: {
                currency: ((invoice.currency as string) ?? "usd").toLowerCase(),
                product_data: {
                  name: `Invoice ${invoice.invoice_number}`,
                  description: (invoice.notes as string) ?? undefined,
                },
                unit_amount: Math.round(balanceDue * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            invoice_id: invoice.id as string,
            org_id: invoice.org_id as string,
          },
          payment_intent_data: {
            metadata: {
              invoice_id: invoice.id as string,
              org_id: invoice.org_id as string,
            },
          },
        });

        paymentLinkUrl = link.url;
        const { error: linkUpdErr } = await admin
          .from("invoices")
          .update({
            stripe_payment_link_id: link.id,
            payment_link_url: link.url,
          })
          .eq("id", invoice_id);

        if (linkUpdErr) {
          console.warn("Could not save payment link on invoice:", linkUpdErr.message);
        }
      } catch (stripeErr) {
        console.error("Stripe payment link error", stripeErr);
        return json({
          error: `Stripe error: ${(stripeErr as Error).message}`,
          hint: "Check STRIPE_SECRET_KEY or invoice amount",
        }, 502);
      }
    }

    if (invoice.status === "draft") {
      const { error: statusErr } = await admin
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoice_id);

      if (statusErr) {
        console.error("mark sent failed", statusErr);
        return json({ error: statusErr.message, hint: "Run migration 036_invoices_grants_service_role.sql" }, 500);
      }
    }

    let emailSent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVOICE_FROM_EMAIL") ?? "billing@connectcash.app";

    if (resendKey && customerEmail) {
      const payBlock = paymentLinkUrl
        ? `<p><a href="${paymentLinkUrl}">Pay online (card or ACH)</a></p>`
        : "";
      const html = `
        <p>Hello${customerName ? ` ${customerName}` : ""},</p>
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
          to: customerEmail,
          subject: `Invoice ${invoice.invoice_number}`,
          html,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.warn("Resend error", errText);
      }
    }

    return json({
      payment_link_url: paymentLinkUrl,
      email_sent: emailSent,
      balance_due: balanceDue,
      customer_email: customerEmail,
    });
  } catch (err) {
    console.error("send-invoice fatal", err);
    return json({ error: (err as Error).message }, 500);
  }
});
