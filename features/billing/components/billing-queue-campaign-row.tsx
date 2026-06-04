"use client";

import { Fragment, memo, useCallback, useMemo } from "react";
import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import type {
  CampaignBillingQueueRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  filterOperationalBillingTree,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import {
  getGlobalSelectionStatus,
  selectionToPayload,
  type OperationalSelectionState,
  type RowSelectionStatus,
} from "@/lib/billing/operational-selection";
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
}: BillingQueueCampaignRowProps) {
  const campaignId = row.campaign_header_id;
  const cur = row.currency_code;
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
      <TableRow
        className={cn(
          "cursor-pointer bg-muted/10 hover:bg-muted/20",
          selectedForReview && "bg-primary/5 ring-1 ring-primary/20"
        )}
        onClick={() => onSelectForReview(campaignId)}
        aria-selected={selectedForReview}
      >
        <TableCell onClick={handleExpandClick}>
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
        </TableCell>
        <TableCell onClick={(event) => event.stopPropagation()}>
          <OperationalSelectionCheckbox
            status={masterStatus}
            onToggle={() => onMasterSelect(campaignId)}
            ariaLabel={`Select all billable rows for ${row.campaign_name}`}
          />
        </TableCell>
        <TableCell className="text-xs">
          <DocumentNumber value={row.campaign_document_number} />
        </TableCell>
        <TableCell>{row.client_name}</TableCell>
        <TableCell className="text-muted-foreground">{row.brand_name ?? "—"}</TableCell>
        <TableCell>
          <Link
            href={`/campaigns/${campaignId}?tab=billing`}
            className="font-medium hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.campaign_name}
          </Link>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{row.currency_code}</Badge>
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatBillingMoneyCompact(row.total_campaign_amount, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoneyCompact(row.achieved_revenue, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoneyCompact(row.already_invoiced, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoneyCompact(row.remaining_to_invoice, cur)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatBillingMoneyCompact(row.unachieved_revenue, cur)}
        </TableCell>
        <TableCell>
          <BillingStatusBadge status={row.billing_status} />
        </TableCell>
        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenInvoice(campaignId)}
            >
              Invoice
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/campaigns/${campaignId}?tab=billing`}>
                <ExternalLinkIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={14} className="bg-background p-0">
            {detailLoading && !detail ? (
              <p className="p-4 text-sm text-muted-foreground">Loading operational billing…</p>
            ) : detail ? (
              <BillingCampaignDrilldown
                detail={detail}
                filter={operationalFilter}
                selection={selection}
                onSelectionChange={handleSelectionChange}
                showBulkSelectionControls={false}
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Unable to load operational rows.</p>
            )}
          </TableCell>
        </TableRow>
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
