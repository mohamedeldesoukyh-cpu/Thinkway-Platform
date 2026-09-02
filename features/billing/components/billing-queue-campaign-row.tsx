"use client";

import { Fragment, memo, useCallback, useMemo } from "react";
import Link from "next/link";

import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import { BillingQueueMessageRow } from "@/features/billing/components/billing-queue-assignment-row";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import {
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import type {
  CampaignBillingQueueRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  filterOperationalBillingTree,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import type { InvoiceDraftPercents } from "@/lib/billing/operational-invoice-draft";
import {
  getGlobalSelectionStatus,
  type OperationalSelectionState,
  type RowSelectionStatus,
} from "@/lib/billing/operational-selection";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { cn } from "@/lib/utils";

export type BillingQueueCampaignRowProps = {
  row: CampaignBillingQueueRow;
  operationalFilter: OperationalBillingFilter;
  expanded: boolean;
  selectedForReview: boolean;
  detail: CampaignOperationalBillingDetail | undefined;
  detailLoading: boolean;
  selection: OperationalSelectionState;
  onToggleExpand: (campaignId: string) => void;
  onMasterSelect: (campaignId: string) => void;
  onSelectForReview: (campaignId: string) => void;
  onSelectionChange: (campaignId: string, selection: OperationalSelectionState) => void;
  onOpenInvoice: (campaignId: string) => void;
  invoicePercents?: InvoiceDraftPercents;
  onInvoicePercentsChange?: (next: InvoiceDraftPercents) => void;
  invoicePending?: boolean;
};

export const BillingQueueCampaignRow = memo(function BillingQueueCampaignRow({
  row,
  operationalFilter,
  expanded,
  selectedForReview,
  detail,
  detailLoading,
  selection,
  onToggleExpand,
  onMasterSelect,
  onSelectForReview,
  onSelectionChange,
  onOpenInvoice,
  invoicePercents,
  onInvoicePercentsChange,
  invoicePending = false,
}: BillingQueueCampaignRowProps) {
  const campaignId = row.campaign_header_id;
  const cur = row.currency_code;

  const showExpand = useIsOperationalColumnVisible("expand");
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNo = useIsOperationalColumnVisible("campaign_no");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showCampaign = useIsOperationalColumnVisible("campaign");
  const showCurrency = useIsOperationalColumnVisible("currency");
  const showTotal = useIsOperationalColumnVisible("total");
  const showAchieved = useIsOperationalColumnVisible("achieved");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showUnachieved = useIsOperationalColumnVisible("unachieved");
  const showStatus = useIsOperationalColumnVisible("status");
  const showActions = useIsOperationalColumnVisible("actions");

  const masterStatus = useMemo(
    () => computeCampaignMasterStatus(detail, selection, operationalFilter),
    [detail, selection, operationalFilter]
  );

  const handleExpandClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onToggleExpand(campaignId);
    },
    [campaignId, onToggleExpand]
  );

  const handleSelectionChange = useCallback(
    (next: OperationalSelectionState) => {
      onSelectionChange(campaignId, next);
    },
    [campaignId, onSelectionChange]
  );

  return (
    <Fragment>
      <CampaignOperationalTableRow
        className={cn(
          "cursor-pointer hover:bg-muted/20",
          selectedForReview && "bg-primary/5",
          expanded && "bg-muted/10"
        )}
        onClick={() => onSelectForReview(campaignId)}
        aria-selected={selectedForReview}
      >
        {showExpand ? (
          <CampaignOperationalTableCell onClick={handleExpandClick}>
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              aria-expanded={expanded}
              aria-label={`Expand ${row.campaign_name}`}
            >
              {expanded ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
            </button>
          </CampaignOperationalTableCell>
        ) : null}
        {showSelect ? (
          <CampaignOperationalTableCell onClick={(event) => event.stopPropagation()}>
            <OperationalSelectionCheckbox
              status={masterStatus}
              onToggle={() => onMasterSelect(campaignId)}
              ariaLabel={`Select all billable rows for ${row.campaign_name}`}
            />
          </CampaignOperationalTableCell>
        ) : null}
        {showCampaignNo ? (
          <CampaignOperationalTableCellMono>{row.campaign_document_number}</CampaignOperationalTableCellMono>
        ) : null}
        {showClient ? (
          <CampaignOperationalTableCell>{row.client_name}</CampaignOperationalTableCell>
        ) : null}
        {showBrand ? (
          <CampaignOperationalTableCell className="bq-brand">
            {row.brand_name ?? "—"}
          </CampaignOperationalTableCell>
        ) : null}
        {showCampaign ? (
          <CampaignOperationalTableCell>
            <Link
              href={`/campaigns/${campaignId}?tab=billing`}
              className="font-medium hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.campaign_name}
            </Link>
          </CampaignOperationalTableCell>
        ) : null}
        {showCurrency ? (
          <CampaignOperationalTableCell>
            <span className="bq-cc">{row.currency_code}</span>
          </CampaignOperationalTableCell>
        ) : null}
        {showTotal ? (
          <CampaignOperationalTableCellAmount className="font-medium">
            {formatBillingMoneyCompact(row.total_campaign_amount, cur)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showAchieved ? (
          <CampaignOperationalTableCellAmount className={row.achieved_revenue > 0 ? undefined : "bq-v-z"}>
            {formatBillingMoneyCompact(row.achieved_revenue, cur)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showInvoiced ? (
          <CampaignOperationalTableCellAmount
            className={row.already_invoiced > 0 ? "bq-v-pos" : "bq-v-z"}
          >
            {formatBillingMoneyCompact(row.already_invoiced, cur)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showRemaining ? (
          <CampaignOperationalTableCellAmount>
            {formatBillingMoneyCompact(row.remaining_to_invoice, cur)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showUnachieved ? (
          <CampaignOperationalTableCellAmount
            className={row.unachieved_revenue > 0 ? "text-muted-foreground" : "bq-v-z"}
          >
            {formatBillingMoneyCompact(row.unachieved_revenue, cur)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showStatus ? (
          <CampaignOperationalTableCell>
            <BillingStatusBadge status={row.billing_status} />
          </CampaignOperationalTableCell>
        ) : null}
        {showActions ? (
          <CampaignOperationalTableCell
            className="text-right"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={invoicePending}
                onClick={() => onOpenInvoice(campaignId)}
              >
                {invoicePending ? "Generating…" : "Invoice"}
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/campaigns/${campaignId}?tab=billing`}>
                  <ExternalLinkIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </CampaignOperationalTableCell>
        ) : null}
      </CampaignOperationalTableRow>
      {expanded ? (
        detailLoading && !detail ? (
          <BillingQueueMessageRow>Loading operational billing…</BillingQueueMessageRow>
        ) : detail ? (
          <BillingCampaignDrilldown
            detail={detail}
            filter={operationalFilter}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            showBulkSelectionControls={false}
            invoicePercents={invoicePercents}
            onInvoicePercentsChange={onInvoicePercentsChange}
            invoicePending={invoicePending}
            embedded
            queueAligned
            campaignAlreadyInvoiced={row.already_invoiced}
          />
        ) : (
          <BillingQueueMessageRow>Unable to load operational rows.</BillingQueueMessageRow>
        )
      ) : null}
    </Fragment>
  );
});

export function computeCampaignMasterStatus(
  detail: CampaignOperationalBillingDetail | undefined,
  selection: OperationalSelectionState,
  operationalFilter: OperationalBillingFilter
): RowSelectionStatus {
  if (!detail) {
    const count =
      selection.line_ids.size + selection.deliverable_ids.size + selection.post_ids.size;
    return count > 0 ? "indeterminate" : "unchecked";
  }
  const filteredRows = filterOperationalBillingTree(detail.operational_rows, operationalFilter);
  return getGlobalSelectionStatus(filteredRows, selection);
}
