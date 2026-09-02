import type { ReactNode } from "react";

type FinanceSuiteCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  notes?: ReactNode;
};

export function FinanceSuiteCard({
  title,
  subtitle,
  actions,
  children,
  notes,
}: FinanceSuiteCardProps) {
  return (
    <div className="tw-c">
      <div className="tw-ch">
        <span className="tw-ct">{title}</span>
        {subtitle ? <span className="tw-cs">{subtitle}</span> : null}
        <span className="tw-sp" />
        {actions}
      </div>
      {children}
      {notes}
    </div>
  );
}
