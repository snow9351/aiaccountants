import { cn } from "@/lib/utils";

export type BillingInterval = "monthly" | "annually";

type BillingIntervalToggleProps = {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
  size?: "default" | "lg";
};

export function BillingIntervalToggle({
  value,
  onChange,
  className,
  size = "default",
}: BillingIntervalToggleProps) {
  const tabClass = (active: boolean) =>
    cn(
      "rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      size === "lg" ? "px-6 py-2.5 text-sm" : "px-5 py-2 text-sm",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Billing period</p>
      <div
        role="tablist"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/80 p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === "monthly"}
          className={tabClass(value === "monthly")}
          onClick={() => onChange("monthly")}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "annually"}
          className={cn(tabClass(value === "annually"), "inline-flex items-center gap-2")}
          onClick={() => onChange("annually")}
        >
          Annually
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              value === "annually" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-success/15 text-success",
            )}
          >
            Save ~17%
          </span>
        </button>
      </div>
    </div>
  );
}
