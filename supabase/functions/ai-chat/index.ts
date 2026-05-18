import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function monthRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start: fmt(start), end: fmt(end), label };
}

async function runQuery<T extends unknown[]>(
  label: string,
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.warn(`ai-chat query failed (${label}):`, error.message);
    return [] as T;
  }
  return (data ?? []) as T;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { messages?: Message[]; userId?: string; orgId?: string };
    const messages = (body.messages ?? []).filter(
      (m) => m?.content?.trim() && (m.role === 'user' || m.role === 'assistant'),
    );
    const orgId = body.orgId?.trim() || null;

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
    );

    const { start: monthStart, end: monthEnd, label: monthLabel } = monthRange();
    const today = new Date().toISOString().slice(0, 10);

    let overdueQ = supabaseClient
      .from('invoices')
      .select('invoice_number, total, balance_due, due_date, status')
      .in('status', ['overdue', 'sent', 'partial'])
      .order('due_date', { ascending: true })
      .limit(8);
    let recentExpensesQ = supabaseClient
      .from('expenses')
      .select('vendor_name, amount, category, date, description')
      .order('date', { ascending: false })
      .limit(15);
    let monthExpensesQ = supabaseClient
      .from('expenses')
      .select('vendor_name, amount, category, date, description')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('amount', { ascending: false })
      .limit(25);
    let customersQ = supabaseClient
      .from('customers')
      .select('name, ar_balance, payment_score, total_revenue')
      .order('total_revenue', { ascending: false })
      .limit(5);
    let cashQ = supabaseClient
      .from('bank_accounts')
      .select('account_name, current_balance, account_type')
      .eq('is_active', true);

    if (orgId) {
      overdueQ = overdueQ.eq('org_id', orgId);
      recentExpensesQ = recentExpensesQ.eq('org_id', orgId);
      monthExpensesQ = monthExpensesQ.eq('org_id', orgId);
      customersQ = customersQ.eq('org_id', orgId);
      cashQ = cashQ.eq('org_id', orgId);
    }

    const [overdueInvoices, recentExpenses, monthExpenses, topCustomers, cashBalance] = await Promise.all([
      runQuery('overdueInvoices', overdueQ),
      runQuery('recentExpenses', recentExpensesQ),
      runQuery('monthExpenses', monthExpensesQ),
      runQuery('topCustomers', customersQ),
      runQuery('cashBalance', cashQ),
    ]);

    const monthTotal = (monthExpenses as { amount: number }[]).reduce(
      (s, e) => s + Number(e.amount ?? 0),
      0,
    );

    const totalCash = (cashBalance as { current_balance: number }[]).reduce(
      (s, a) => s + Number(a.current_balance ?? 0),
      0,
    );

    const systemPrompt = `You are AI Accountants, an expert financial CFO assistant embedded in an AI-native accounting platform.

Today's date: ${today}
Active month for reporting: ${monthLabel} (${monthStart} through ${monthEnd})

## Real Financial Context (this company's data)

**Cash Position:** $${totalCash.toLocaleString()} across ${(cashBalance as unknown[]).length} active accounts

**This month (${monthLabel}) — expense total:** $${monthTotal.toLocaleString()} (${(monthExpenses as unknown[]).length} entries)

**This month's expenses (detail):**
${JSON.stringify(monthExpenses, null, 2)}

**Recent expenses (all dates, last 15):**
${JSON.stringify(recentExpenses, null, 2)}

**Outstanding / open invoices:**
${JSON.stringify(overdueInvoices, null, 2)}

**Top customers by revenue:**
${JSON.stringify(topCustomers, null, 2)}

## Instructions
- Answer using the data above; cite specific dollar amounts and dates
- For "this month" expense questions, use the month expenses section and state the month total
- Use Markdown tables when listing multiple rows
- If data arrays are empty, say so and suggest where in the app to add data
- Keep answers concise (under 200 words unless a table is needed)`;

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'ANTHROPIC_API_KEY is not set. In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add ANTHROPIC_API_KEY.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const model = Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic error:', anthropicResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: `AI provider error (${anthropicResponse.status}). Check ANTHROPIC_API_KEY and model "${model}".`,
          detail: errText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const anthropicData = await anthropicResponse.json();
    const responseText =
      anthropicData.content?.[0]?.type === 'text'
        ? anthropicData.content[0].text
        : 'I was unable to generate a response. Please try again.';

    try {
      await supabaseClient.from('nlq_queries').insert({
        org_id: orgId,
        user_id: body.userId ?? null,
        query: messages[messages.length - 1]?.content ?? '',
        response: responseText,
      });
    } catch {
      // non-fatal
    }

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI chat error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
