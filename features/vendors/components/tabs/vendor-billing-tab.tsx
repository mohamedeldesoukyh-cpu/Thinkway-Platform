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
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { VendorBankDetailsSection } from "@/features/vendors/components/tabs/vendor-bank-details-section";
import { VendorFinanceTab } from "@/features/vendors/components/tabs/vendor-finance-tab";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, hasVendorBankDetails } from "@/features/vendors/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
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

export function VendorBillingTab({
  workspace,
  currencyOptions = [],
  onCancel,
}: {
  workspace: VendorWorkspace;
  currencyOptions?: { value: string; label: string }[];
  onCancel?: () => void;
}) {
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

  const bankConfigured = hasVendorBankDetails(workspace.payment_details);

  return (
    <VendorProfileTabShell
      title="Billing & Payments"
      description={
        bankConfigured
          ? "Vendor payout bank details are on file and linked to Vendor IO Section 6."
          : "Add vendor bank details below — they flow into Vendor IO payment terms automatically."
      }
      onCancel={onCancel}
    >
      <div className="grid gap-[18px]">
        <VendorBankDetailsSection workspace={workspace} />

        <VendorFinanceTab
          vendor={workspace}
          currencyOptions={currencyOptions}
          hidePaymentTerms
          embedded
        />

        <KpiCarousel items={summaryItems} showNavigation={false} />

        <VendorFormSection
          icon={ReceiptIcon}
          title="Payout history"
          description="Creator payouts linked to campaign assignments and payment batches."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorBilling}
            columns={VENDOR_BILLING_COLUMNS}
            rows={workspace.payouts}
            filterAccessors={VENDOR_PAYOUTS_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor billing" />
            </div>
            {workspace.payouts.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9099A8]">
                No payout records.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={VENDOR_BILLING_COLUMNS}
                rows={workspace.payouts}
                rowKey={(payout) => payout.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}
