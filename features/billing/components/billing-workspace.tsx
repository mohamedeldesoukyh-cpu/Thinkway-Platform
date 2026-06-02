"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgingReport } from "@/features/billing/components/aging-report";
import { BillingApprovalsPanel } from "@/features/billing/components/billing-approvals-panel";
import { BillingCampaignQueueTable } from "@/features/billing/components/billing-campaign-queue-table";
import { BillingInvoicesTable } from "@/features/billing/components/billing-invoices-table";
import { BillingKpiStrip } from "@/features/billing/components/billing-kpi-strip";
import { CollectionTracker } from "@/features/billing/components/collection-tracker";
import { VendorBatchesCard } from "@/features/billing/components/billing-invoices-table";
import type { BillingDashboard } from "@/features/billing/types";

type BillingWorkspaceViewProps = {
  dashboard: BillingDashboard;
};

export function BillingWorkspaceView({ dashboard }: BillingWorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <BillingKpiStrip kpis={dashboard.kpis} />

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="queue">Billing queue</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="vendors">Vendor payments</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <BillingCampaignQueueTable campaigns={dashboard.campaign_queue} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <CollectionTracker invoices={dashboard.invoices} />
          <BillingApprovalsPanel approvals={dashboard.pending_approvals} />
        </TabsContent>

        <TabsContent value="invoices">
          <BillingInvoicesTable invoices={dashboard.invoices} />
        </TabsContent>

        <TabsContent value="collections">
          <CollectionTracker invoices={dashboard.invoices} />
        </TabsContent>

        <TabsContent value="aging">
          <AgingReport aging={dashboard.aging} />
        </TabsContent>

        <TabsContent value="approvals">
          <BillingApprovalsPanel approvals={dashboard.pending_approvals} />
        </TabsContent>

        <TabsContent value="vendors">
          <VendorBatchesCard batches={dashboard.vendor_batches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
