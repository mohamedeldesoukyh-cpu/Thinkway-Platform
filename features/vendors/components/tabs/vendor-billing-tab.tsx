"use client";

import {
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { KpiCarousel } from "@/components/ui/kpi-carousel";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
} as const;

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
      <KpiCarousel items={summaryItems} showNavigation={false} className="px-4 md:px-5" />

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Payout history
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Creator payouts linked to campaign assignments and payment batches.
            </p>
          </div>
        }
      >
        {workspace.payouts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
            No payout records.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <CampaignOperationalTable>
              <CampaignOperationalTableHeader>
                <CampaignOperationalTableHeaderRow>
                  <CampaignOperationalTableHead>Campaign</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead className="text-right">Amount</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                </CampaignOperationalTableHeaderRow>
              </CampaignOperationalTableHeader>
              <CampaignOperationalTableBody>
                {workspace.payouts.map((p) => (
                  <CampaignOperationalTableRow key={p.id}>
                    <CampaignOperationalTableCell className="text-muted-foreground">
                      {p.campaign_name ?? "—"}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCellAmount>
                      {formatMoney(p.amount, p.currency)}
                    </CampaignOperationalTableCellAmount>
                    <CampaignOperationalTableCell>
                      <Badge
                        variant="outline"
                        className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
                      >
                        {VENDOR_PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </CampaignOperationalTableCell>
                  </CampaignOperationalTableRow>
                ))}
              </CampaignOperationalTableBody>
            </CampaignOperationalTable>
          </div>
        )}
      </OperationalTableSection>
    </div>
  );
}
