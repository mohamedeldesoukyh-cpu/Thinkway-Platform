import type { ReactNode } from "react";

type BillingCardHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

/** HTML `.bq-card__h` contents — sits inside `thinkway-campaign-section-head`. */
export function BillingCardHeader({ title, subtitle, actions }: BillingCardHeaderProps) {
  return (
    <>
      <span className="bq-card__t">{title}</span>
      {subtitle ? <span className="bq-card__s">{subtitle}</span> : null}
      <span className="bq-sp" />
      {actions}
    </>
  );
}
