import { cn } from "@/lib/utils";

export type FinanceSuiteKpiTone = "ok" | "bad" | "warn";

export type FinanceSuiteKpiItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: FinanceSuiteKpiTone;
};

type FinanceSuiteKpiStripProps = {
  items: readonly FinanceSuiteKpiItem[];
  className?: string;
};

export function FinanceSuiteKpiStrip({ items, className }: FinanceSuiteKpiStripProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("fs-kpi", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "fs-k",
            item.tone === "bad" && "bad",
            item.tone === "ok" && "ok",
            item.tone === "warn" && "warn"
          )}
        >
          <span className="fs-k__l">{item.label}</span>
          <span className="fs-k__v">{item.value}</span>
          {item.hint ? <span className="fs-k__s">{item.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}
