"use client";

import { memo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import type { InvoiceDraftPercents } from "@/lib/billing/operational-invoice-draft";
import type { CampaignBillingQueueFilter } from "@/lib/billing/campaign-billing-queue";
import { mapCampaignQueueFilterToOperational } from "@/lib/billing/operational-row-filters";
import {
  createEmptySelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

export const BILLING_CAMPAIGN_REVIEW_LINES_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "type", label: "Type" },
  { id: "line", label: "Line" },
  { id: "invoice", label: "Invoice" },
  { id: "invoice_status", label: "Invoice status" },
  { id: "achieved", label: "Achieved" },
  { id: "invoiced", label: "Invoiced" },
  { id: "remaining", label: "Remaining" },
  { id: "billing_status", label: "Billing status" },
];

type BillingCampaignReviewPanelProps = {
  campaignName: string;
  campaignDocumentNumber: string;
  detail: CampaignOperationalBillingDetail | null;
  loading: boolean;
  filter: CampaignBillingQueueFilter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection?: OperationalSelectionState;
  onSelectionChange?: (selection: OperationalSelectionState) => void;
  invoicePercents?: InvoiceDraftPercents;
  onInvoicePercentsChange?: (next: InvoiceDraftPercents) => void;
  invoicePending?: boolean;
  onInvoice?: (selection: OperationalSelectionPayload) => void;
};

function BillingCampaignReviewPanelInner({
  campaignName,
  campaignDocumentNumber,
  detail,
  loading,
  filter,
  open,
  onOpenChange,
  selection,
  onSelectionChange,
  invoicePercents,
  onInvoicePercentsChange,
  invoicePending = false,
  onInvoice,
}: BillingCampaignReviewPanelProps) {
  const operationalFilter = mapCampaignQueueFilterToOperational(filter);

  return (
    <div
      id="billing-campaign-review"
      className={cn("scroll-mt-4", open && "shadow-sm")}
    >
      <CampaignFlatSection
        title="Campaign lines review"
        description={`${campaignDocumentNumber} · ${campaignName}`}
        className="border-primary/20 ring-1 ring-primary/10"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(!open)}
          >
            {open ? (
              <>
                <ChevronUpIcon className="size-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDownIcon className="size-4" />
                Expand
              </>
            )}
          </Button>
        }
      >
        {open ? (
          <div className="space-y-4">
            {loading ? (
              <p className="px-4 py-8 text-[11px] text-muted-foreground">
                Loading campaign billing lines…
              </p>
            ) : !detail ? (
              <p className="px-4 py-8 text-[11px] text-muted-foreground">
                Unable to load campaign billing detail.
              </p>
            ) : (
              <BillingCampaignDrilldown
                detail={detail}
                filter={operationalFilter}
                selection={selection ?? createEmptySelection()}
                onSelectionChange={onSelectionChange}
                invoicePercents={invoicePercents}
                onInvoicePercentsChange={onInvoicePercentsChange}
                invoicePending={invoicePending}
                onInvoice={onInvoice}
                appearance="campaign"
              />
            )}
          </div>
        ) : null}
      </CampaignFlatSection>
    </div>
  );
}

export const BillingCampaignReviewPanel = memo(BillingCampaignReviewPanelInner);
