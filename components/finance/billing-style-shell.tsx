import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { BillingRelatedNav } from "@/components/finance/billing-related-nav";
import "@/app/styles/billing-workspace-v3.css";
import "@/app/styles/billing-related-pages.css";

export function BillingStyleShell({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode;
}) {
  return <div className="tw-billing-v3 billing-related flex min-h-0 min-w-0 flex-1 flex-col">
    <DashboardShell title={title} description={description} hidePageHeader hideDesktopHeader mainClassName="bq-main">
      <header className="bq-hd">
        <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
        <div className="flex flex-wrap items-center gap-2"><PageBackButton fallbackHref="/billing" variant="text" />{actions}</div>
      </header>
      <BillingRelatedNav />
      {children}
    </DashboardShell>
  </div>;
}
