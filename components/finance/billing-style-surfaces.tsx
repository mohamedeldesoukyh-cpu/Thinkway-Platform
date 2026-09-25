import type { ComponentProps } from "react";
import type { FinanceSuiteCard, FinanceSuiteKpiStrip } from "@/components/finance/suite";
import { BillingCardHeader } from "@/features/billing/components/billing-card-header";
import { cn } from "@/lib/utils";

export function BillingStyleCard({ title, subtitle, actions, children, notes }: ComponentProps<typeof FinanceSuiteCard>) {
  return <section className="bq-card">
    <div className="bq-card__h"><BillingCardHeader title={title} subtitle={subtitle} actions={actions} /></div>
    {children}{notes}
  </section>;
}

export function BillingStyleKpis({ items, className }: ComponentProps<typeof FinanceSuiteKpiStrip>) {
  if (!items.length) return null;
  return <div className={cn("collections-suite related-summary-strip", className)}>
    <div className="tw-ms2">
      {items.map((item) => <div key={item.id}>
        <i>{item.label}</i>
        <b className={item.tone === "bad" ? "r" : undefined}>{item.value}</b>
        {item.hint && <p className="tw-hint">{item.hint}</p>}
      </div>)}
    </div>
  </div>;
}
