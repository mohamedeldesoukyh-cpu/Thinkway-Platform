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
    <div className={cn("tw-kpi", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "tw-k",
            item.tone === "bad" && "bad",
            item.tone === "ok" && "ok",
            item.tone === "warn" && "warn"
          )}
        >
          <i>{item.label}</i>
          <b>{item.value}</b>
          {item.hint ? <u>{item.hint}</u> : null}
        </div>
      ))}
    </div>
  );
}
