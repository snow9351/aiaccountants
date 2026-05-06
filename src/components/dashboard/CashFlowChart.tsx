import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", income: 42000, expenses: 31000, forecast: null },
  { month: "Feb", income: 48000, expenses: 33000, forecast: null },
  { month: "Mar", income: 45000, expenses: 35000, forecast: null },
  { month: "Apr", income: 52000, expenses: 32000, forecast: null },
  { month: "May", income: 58000, expenses: 38000, forecast: null },
  { month: "Jun", income: 54000, expenses: 36000, forecast: null },
  { month: "Jul", income: null, expenses: null, forecast: 56000 },
  { month: "Aug", income: null, expenses: null, forecast: 62000 },
  { month: "Sep", income: null, expenses: null, forecast: 59000 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: ${(entry.value / 1000).toFixed(0)}k
        </p>
      ))}
    </div>
  );
};

export function CashFlowChart() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Cash Flow</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Income vs Expenses with AI forecast</p>
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
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-dashed border-primary bg-transparent" />
            <span className="text-muted-foreground">AI Forecast</span>
          </div>
        </div>
      </div>
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
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(168, 80%, 50%)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(168, 80%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsla(228, 15%, 25%, 0.5)" />
          <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="income" stroke="hsl(168, 80%, 50%)" strokeWidth={2} fill="url(#incomeGrad)" />
          <Area type="monotone" dataKey="expenses" stroke="hsl(255, 80%, 65%)" strokeWidth={2} fill="url(#expenseGrad)" />
          <Area type="monotone" dataKey="forecast" stroke="hsl(168, 80%, 50%)" strokeWidth={2} strokeDasharray="6 4" fill="url(#forecastGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
