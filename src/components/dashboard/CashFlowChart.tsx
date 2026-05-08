import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useCashFlowChartData } from "@/hooks/useDashboard";

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
};

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value == null ? "—" : fmtMoney(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function CashFlowChart() {
  const { data = [], isPending } = useCashFlowChartData();

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Cash Flow</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Income vs expenses from bank transactions (last 6 months)</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-muted-foreground">Expenses</span>
          </div>
        </div>
      </div>
      {isPending && data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          No bank transactions in this window yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(168, 80%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(168, 80%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(255, 80%, 65%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(255, 80%, 65%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsla(228, 15%, 25%, 0.5)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="income" name="Income" stroke="hsl(168, 80%, 50%)" strokeWidth={2} fill="url(#incomeGrad)" />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(255, 80%, 65%)" strokeWidth={2} fill="url(#expenseGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
