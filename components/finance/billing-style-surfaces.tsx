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
  return <div className={cn("bq-kwrap", className)}>
    {items.map((item) => <div key={item.id} className={cn("bq-k", item.tone)}>
      <div className="bq-k__l">{item.label}</div>
      <div className="bq-k__v bq-n">{item.value}</div>
      {item.hint && <div className="bq-k__s">{item.hint}</div>}
    </div>)}
  </div>;
}
