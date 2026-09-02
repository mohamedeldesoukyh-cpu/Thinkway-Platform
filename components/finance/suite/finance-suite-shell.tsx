import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";

type FinanceSuiteShellProps = {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  backFallbackHref?: string;
  backLabel?: string;
};

export function FinanceSuiteShell({
  children,
  title,
  description,
  actions,
  backFallbackHref,
  backLabel = "Go back",
}: FinanceSuiteShellProps) {
  return (
    <DashboardShell
      title={title}
      description={description}
      hidePageHeader
      hideDesktopHeader
      mainClassName="tw-main"
    >
      <div className="tw-hd">
        {backFallbackHref ? (
          <PageBackButton
            fallbackHref={backFallbackHref}
            label={backLabel}
            variant="icon"
          />
        ) : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <span className="tw-sp" />
        {actions}
        <button type="button" className="tw-b">
          Export
        </button>
        <button type="button" className="tw-b pri">
          Actions
        </button>
      </div>
      {children}
    </DashboardShell>
  );
}
