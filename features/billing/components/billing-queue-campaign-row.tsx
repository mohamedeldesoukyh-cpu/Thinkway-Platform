"use client";

import { Fragment, memo, useCallback, useMemo } from "react";
import Link from "next/link";

import { ExternalLinkIcon } from "lucide-react";

import { DocumentNumber } from "@/components/ui/document-number";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import {
  BillingQueueGridRow,
  BillingQueueMessageRow,
  useBillingQueueGridTemplate,
} from "@/features/billing/components/billing-queue-assignment-row";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { DraftNumericInput } from "@/features/billing/components/operational-row-tree";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import { formatQueueNumber } from "@/features/billing/components/use-billing-queue-column-visibility";
import { labelForBillingStatus } from "@/features/billing/constants";
import type {
  CampaignBillingQueueRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import {
  filterOperationalBillingTree,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import {
  computeCampaignInvoiceDraft,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
import {
  getGlobalSelectionStatus,
  type OperationalSelectionState,
  type RowSelectionStatus,
} from "@/lib/billing/operational-selection";
import { cn } from "@/lib/utils";

function formatDraftPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0";
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

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
  onCampaignPercentChange?: (percent: number) => void;
  invoicePending?: boolean;
  invoiceDisabled?: boolean;
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
  onCampaignPercentChange,
  invoicePending = false,
  invoiceDisabled = false,
}: BillingQueueCampaignRowProps) {
  const campaignId = row.campaign_header_id;
  const { cols, template } = useBillingQueueGridTemplate();

  const masterStatus = useMemo(
    () => computeCampaignMasterStatus(detail, selection, operationalFilter),
    [detail, selection, operationalFilter]
  );

  const draft = useMemo(() => {
    if (!detail) return null;
    const assignments = filterOperationalBillingTree(
      detail.operational_rows,
      operationalFilter
    ).filter((item) => item.kind === "assignment");
    return computeCampaignInvoiceDraft(assignments, invoicePercents ?? {});
  }, [detail, invoicePercents, operationalFilter]);

  const invoicedDisplay =
    (expanded || Object.keys(invoicePercents ?? {}).length > 0) && draft
      ? row.already_invoiced + draft.toBeInvoiced
      : row.already_invoiced;
  const remainingDisplay =
    (expanded || Object.keys(invoicePercents ?? {}).length > 0) && draft
      ? row.remaining_to_invoice - draft.toBeInvoiced
      : row.remaining_to_invoice;

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
      <BillingQueueGridRow
        className={cn("bq-prow", selectedForReview && "sel")}
        template={template}
        onClick={() => onSelectForReview(campaignId)}
        aria-selected={selectedForReview}
      >
        {cols.showSelect ? (
          <span onClick={(event) => event.stopPropagation()}>
            <OperationalSelectionCheckbox
              status={masterStatus}
              onToggle={() => onMasterSelect(campaignId)}
              ariaLabel={`Select all billable lines for ${row.campaign_name}`}
            />
          </span>
        ) : null}
        {cols.showExpand ? (
          <span onClick={handleExpandClick}>
            <button
              type="button"
              className="bq-x"
              aria-expanded={expanded}
              aria-label={expanded ? `Hide lines for ${row.campaign_name}` : `Show lines for ${row.campaign_name}`}
              title={expanded ? "Hide campaign lines" : "Show campaign lines"}
            >
              {expanded ? "▾" : "▸"}
            </button>
          </span>
        ) : null}
        {cols.showCampaignNo ? (
          <span className="bq-no">
            <DocumentNumber value={row.campaign_document_number} showCanonicalTitle={false} />
          </span>
        ) : null}
        {cols.showClient ? (
          <span className="bq-cl" title={row.client_name}>
            {row.client_name}
          </span>
        ) : null}
        {cols.showBrand ? (
          <span className="bq-brand" title={row.brand_name ?? undefined}>
            {row.brand_name ?? "—"}
          </span>
        ) : null}
        {cols.showCampaign ? (
          <span className="bq-cm" title={row.campaign_name}>
            <Link
              href={`/campaigns/${campaignId}?tab=billing`}
              className="hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {row.campaign_name}
            </Link>
          </span>
        ) : null}
        {cols.showCurrency ? (
          <span>
            <span className="bq-cc" title="Currency">{row.currency_code}</span>
          </span>
        ) : null}
        {cols.showTotal ? (
          <span className="bq-v">{formatQueueNumber(row.total_campaign_amount)}</span>
        ) : null}
        {cols.showAchieved ? (
          <span className={row.achieved_revenue > 0 ? "bq-v" : "bq-v z"}>
            {formatQueueNumber(row.achieved_revenue)}
          </span>
        ) : null}
        {cols.showInvoiced ? (
          <span className={invoicedDisplay > 0 ? "bq-v pos" : "bq-v z"}>
            {formatQueueNumber(invoicedDisplay)}
          </span>
        ) : null}
        {cols.showRemaining ? (
          <span className="bq-v" title="Amount still to invoice">
            {formatQueueNumber(remainingDisplay)}
          </span>
        ) : null}
        {cols.showBillPercent ? (
          <span onClick={(event) => event.stopPropagation()}>
            <div
              className="bq-inw"
              title="Bill percent of remaining. Changing this updates every line."
            >
              <DraftNumericInput
                value={Number(
                  formatDraftPercent(
                    draft?.percent ?? (row.remaining_to_invoice > 0.01 ? 100 : 0)
                  )
                )}
                ariaLabel={`Bill percent for ${row.campaign_name}`}
                disabled={invoiceDisabled || invoicePending || row.remaining_to_invoice <= 0.01}
                min={0}
                max={100}
                widthClass="bq-in"
                onCommit={(percent) => onCampaignPercentChange?.(percent)}
              />
              <span>%</span>
            </div>
          </span>
        ) : null}
        {cols.showUnachieved ? (
          <span className={row.unachieved_revenue > 0 ? "bq-v" : "bq-v z"}>
            {formatQueueNumber(row.unachieved_revenue)}
          </span>
        ) : null}
        {cols.showStatus ? (
          <span title={labelForBillingStatus(row.billing_status)}>
            <BillingStatusBadge status={row.billing_status} />
          </span>
        ) : null}
        {cols.showActions ? (
          <span className="bq-act" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="bq-b sm pri"
              disabled={invoiceDisabled || invoicePending}
              title="Create invoice for this campaign"
              onClick={() => onOpenInvoice(campaignId)}
            >
              {invoicePending ? "Generating…" : "Invoice"}
            </button>
            <Link
              href={`/campaigns/${campaignId}?tab=billing`}
              className="bq-ic"
              aria-label="Open campaign billing"
              title="Open campaign billing"
            >
              <ExternalLinkIcon />
            </Link>
          </span>
        ) : null}
      </BillingQueueGridRow>
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
