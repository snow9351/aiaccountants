import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestedQuestions = [
  "What's my cash runway?",
  "Show overdue invoices",
  "Create invoice for Acme $3,000",
  "Top expenses this month",
];

const aiResponses: Record<string, string> = {
  "cash runway": "Based on your current burn rate of **$34K/mo** and cash on hand of **$240K**, your **cash runway is 8.2 months**.\n\nAccelerating AR collection on 60+ day invoices could extend this to **9.4 months**.\n\n| Metric | Value |\n|--------|-------|\n| Monthly burn | $34,000 |\n| Cash on hand | $240,000 |\n| Runway | 8.2 months |\n| Optimized | 9.4 months |",
  "overdue": "You have **3 invoices overdue > 60 days** totaling **$23,700**:\n\n| Client | Amount | Likelihood |\n|--------|--------|------------|\n| Acme Corp | $12,400 | 62% |\n| TechFlow | $8,200 | 78% |\n| Nova Inc | $3,100 | 58% |\n\n✉️ I've drafted collection emails with tone adjusted by overdue duration. Want me to send them?",
  "create invoice": "I'll draft that invoice:\n\n✅ **Invoice #1049** — Acme Corp\n- **Amount:** $3,000\n- **Terms:** Net-30\n- **Due:** May 3, 2026\n\n⚠️ **Note:** Acme has 2 existing invoices overdue > 60 days. Payment likelihood score is **62%**.\n\nWant me to adjust terms or add a late payment clause?",
  "expenses": "Your **top expenses this month** ($33,703 total):\n\n| Category | Amount | % of Total |\n|----------|--------|------------|\n| Payroll | $24,800 | 73.6% |\n| Rent | $4,200 | 12.5% |\n| Marketing | $2,150 | 6.4% |\n| Infrastructure | $1,280 | 3.8% |\n| Software | $75 | 0.2% |\n\n📊 Payroll is **8.3% above** last month due to the March cycle timing.",
  "default": "I can help with:\n\n- 📄 **Invoicing** — create, send, track\n- 💰 **Expenses** — categorize, analyze trends\n- 🔄 **Reconciliation** — auto-match bank transactions\n- 📊 **Reports** — P&L, cash flow, custom queries\n- 🔮 **Forecasting** — cash runway, revenue projections\n\nTry asking me about your cash position, overdue invoices, or expense trends!",
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("runway") || lower.includes("cash")) return aiResponses["cash runway"];
  if (lower.includes("overdue") || (lower.includes("invoice") && lower.includes("show"))) return aiResponses["overdue"];
  if (lower.includes("create") || (lower.includes("invoice") && lower.includes("acme"))) return aiResponses["create invoice"];
  if (lower.includes("expense") || lower.includes("spend") || lower.includes("top")) return aiResponses["expenses"];
  return aiResponses["default"];
}

export function AIChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", content: "Hi! I'm your **ConnectCash AI** assistant. Ask me anything about your finances, or tell me what to do — I can create invoices, log expenses, run reports, and more.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      if (!isSupabaseConfigured) {
        // Demo mode: use mock responses
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
        const response = getAIResponse(text);
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: response, timestamp: new Date() }]);
        return;
      }

      // Real mode: call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          userId: user?.id,
        },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data?.response ?? "I couldn't generate a response. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } catch {
      // Fallback to mock on any error
      const response = getAIResponse(text);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: response, timestamp: new Date() }]);
      toast({
        title: "AI unavailable",
        description: "Using cached responses. Check your Supabase Edge Function configuration.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  if (!open) {
    return (
      <button
        data-ai-chat-trigger
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl glow-primary transition-all hover:scale-105"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[540px] w-[400px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-card/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ConnectCash AI</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {isSupabaseConfigured ? (
                <><Wifi className="h-2.5 w-2.5 text-success" /> Live data</>
              ) : (
                <><WifiOff className="h-2.5 w-2.5 text-warning" /> Demo mode</>
              )}
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 transition-colors hover:bg-secondary">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground"
              )}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-th:text-xs prose-th:font-medium prose-th:text-muted-foreground prose-td:px-3 prose-td:py-1.5 prose-td:text-xs prose-headings:text-foreground prose-strong:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-secondary/60 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "0.2s" }} />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t border-border/30 px-4 py-3">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your finances..."
            className="flex-1 rounded-xl border border-border/50 bg-secondary/30 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
