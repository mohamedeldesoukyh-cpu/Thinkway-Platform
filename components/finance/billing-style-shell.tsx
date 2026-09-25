import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { BillingRelatedNav } from "@/components/finance/billing-related-nav";
import "@/app/styles/billing-workspace-v3.css";
import "@/app/styles/collections-platform-shared.css";
import "@/app/styles/billing-related-pages.css";

export function BillingStyleShell({ title, description, actions, children, contained = false }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode; contained?: boolean;
}) {
  return <div className="tw-billing-v3 billing-related flex min-h-0 min-w-0 flex-1 flex-col">
    <DashboardShell title={title} description={description} hidePageHeader hideDesktopHeader containedMain={contained} mainClassName={contained ? "bq-main po-contained-main" : "bq-main"}>
      <div className="collections-suite">
        <header className="tw-mast">
          <div className="tw-mh">
            <span className="id">{title === "Holding Groups" ? "CRM" : title === "Planning" ? "PLAN" : title === "Exchange rates" ? "FX" : "PO"}</span>
            <h1>{title}</h1>
            {description && <span className="sub">{description}</span>}
            <span className="tw-sp" />
            <div className="related-mast-actions"><PageBackButton fallbackHref="/billing" variant="text" />{actions}</div>
          </div>
          <BillingRelatedNav />
        </header>
      </div>
      {children}
    </DashboardShell>
  </div>;
}
