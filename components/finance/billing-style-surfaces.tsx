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
  return <div className={cn("collections-suite related-summary-deck", className)}>
    {items.map((item) => <section key={item.id} className={cn("tw-dc2", item.tone === "bad" && "alert")}>
      <div className="tw-dc2__h"><b>{item.label}</b></div>
      <div className="tw-pad"><div className="tw-st"><span><b className={item.tone === "bad" ? "bad" : undefined}>{item.value}</b></span></div>
        {item.hint && <p className="tw-hint">{item.hint}</p>}
      </div>
    </section>)}
  </div>;
}
