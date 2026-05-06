import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json() as { messages: Message[]; userId?: string };

    // Initialize Supabase client with the user's auth token to respect RLS
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );

    // Fetch real financial context to make AI responses data-aware
    const [overdueInvoices, recentExpenses, topCustomers, cashBalance] = await Promise.all([
      supabaseClient
        .from('invoices')
        .select('invoice_number, total, balance_due, due_date, status')
        .in('status', ['overdue', 'sent'])
        .order('due_date', { ascending: true })
        .limit(5),
      supabaseClient
        .from('expenses')
        .select('vendor_name, amount, category, date')
        .order('date', { ascending: false })
        .limit(10),
      supabaseClient
        .from('customers')
        .select('name, ar_balance, payment_score, total_revenue')
        .order('total_revenue', { ascending: false })
        .limit(5),
      supabaseClient
        .from('bank_accounts')
        .select('account_name, current_balance, account_type')
        .eq('is_active', true),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const totalCash = (cashBalance.data ?? []).reduce((s: number, a: { current_balance: number }) => s + a.current_balance, 0);

    const systemPrompt = `You are ConnectCash AI, an expert financial CFO assistant embedded in an AI-native accounting platform.

Today's date: ${today}

## Real Financial Context (your organization's live data)

**Cash Position:** $${totalCash.toLocaleString()} total across ${cashBalance.data?.length ?? 0} accounts

**Outstanding/Overdue Invoices:**
${JSON.stringify(overdueInvoices.data?.slice(0, 5) ?? [], null, 2)}

**Recent Expenses (last 10):**
${JSON.stringify(recentExpenses.data?.slice(0, 10) ?? [], null, 2)}

**Top Customers by Revenue:**
${JSON.stringify(topCustomers.data?.slice(0, 5) ?? [], null, 2)}

## Your Capabilities
- Answer questions about the financial data above with specific numbers
- Create invoices, log expenses, and record transactions via natural language
- Explain financial concepts (GAAP, accrual vs cash basis, etc.)
- Provide cash flow analysis and forecasting insights
- Identify risk areas (high AR concentration, overdue invoices, unusual expenses)
- Generate financial summaries and reports
- Suggest tax optimization strategies

## Response Format
- Use Markdown for formatting
- Be concise and actionable — limit responses to 3-5 sentences or a focused table
- When presenting data, use Markdown tables
- Always base answers on the actual data provided above when available
- If asked to take an action (create invoice, log expense), describe what you would create in a structured JSON block

## Tone
Professional but conversational. You're a trusted financial advisor, not a chatbot.`;

    // Call Anthropic API
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: Message) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} — ${errText}`);
    }

    const anthropicData = await anthropicResponse.json();
    const responseText = anthropicData.content?.[0]?.type === 'text'
      ? anthropicData.content[0].text
      : 'I was unable to generate a response. Please try again.';

    // Log the query for analytics (best effort — don't fail if this errors)
    try {
      await supabaseClient.from('nlq_queries').insert({
        user_id: userId ?? null,
        query: messages[messages.length - 1]?.content ?? '',
        response: responseText,
      });
    } catch {
      // Ignore logging errors
    }

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI chat error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
