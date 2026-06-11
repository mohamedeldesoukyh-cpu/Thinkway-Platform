"use client";

import {
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney } from "@/features/vendors/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";
import { VendorBankDetailsSection } from "@/features/vendors/components/tabs/vendor-bank-details-section";
import { VENDOR_PAYOUTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
} as const;

type PayoutRow = VendorWorkspace["payouts"][number];

const VENDOR_BILLING_COLUMNS: OperationalConfigurableColumnDef<PayoutRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    cellClassName: "text-muted-foreground",
    renderCell: (payout) => payout.campaign_name ?? "—",
  },
  {
    id: "amount",
    label: "Amount",
    amountCell: true,
    renderCell: (payout) => formatMoney(payout.amount, payout.currency),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (payout) => (
      <Badge
        variant="outline"
        className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
      >
        {VENDOR_PAYMENT_STATUS_LABELS[payout.status] ?? payout.status}
      </Badge>
    ),
  },
];

const VENDOR_BILLING_COLUMN_METAS = getOperationalTableColumnMetas(VENDOR_BILLING_COLUMNS);

export function VendorBillingTab({ workspace }: { workspace: VendorWorkspace }) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const { financials } = workspace;

  const summaryItems = [
    {
      id: "revenue",
      label: "Assignment revenue",
      value: formatMoney(financials.total_revenue, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "cost",
      label: "Creator cost",
      value: formatMoney(financials.total_cost, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "gp",
      label: "GP contribution",
      value: formatMoney(financials.total_gp, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.green,
    },
    {
      id: "invoiced",
      label: "Invoiced",
      value: formatMoney(financials.invoiced_amount, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "paid",
      label: "Paid out",
      value: formatMoney(financials.paid_out, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.green,
    },
    {
      id: "pending",
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.pink,
    },
  ];

  return (
    <div className="space-y-4">
      <VendorBankDetailsSection workspace={workspace} />

      <KpiCarousel items={summaryItems} showNavigation={false} className="px-4 md:px-5" />

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorBilling}
        columns={VENDOR_BILLING_COLUMNS}
        rows={workspace.payouts}
        filterAccessors={VENDOR_PAYOUTS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Payout history"
              description="Creator payouts linked to campaign assignments and payment batches."
              actions={
                <OperationalTableControlsSlot contextLabel="Vendor billing" />
              }
            />
          }
        >
          {workspace.payouts.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
              No payout records.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={VENDOR_BILLING_COLUMNS}
              rows={workspace.payouts}
              rowKey={(payout) => payout.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}
