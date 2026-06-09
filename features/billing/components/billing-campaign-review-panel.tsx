"use client";

import { memo, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { Button } from "@/components/ui/button";
import { OperationalTableSettingsButton } from "@/components/tables/operational-table-settings-button";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import type { CampaignBillingQueueFilter } from "@/lib/billing/campaign-billing-queue";
import {
  isOperationalRowAchieved,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  filterOperationalBillingTree,
  mapCampaignQueueFilterToOperational,
} from "@/lib/billing/operational-row-filters";
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

type ReviewFlatRow = {
  row: OperationalBillingRow;
  depth: number;
};

function flattenReviewRows(
  rows: OperationalBillingRow[],
  depth = 0,
  acc: ReviewFlatRow[] = []
): ReviewFlatRow[] {
  for (const row of rows) {
    acc.push({ row, depth });
    if (row.children.length > 0) {
      flattenReviewRows(row.children, depth + 1, acc);
    }
  }
  return acc;
}

function rowKindLabel(kind: OperationalBillingRow["kind"]): string {
  switch (kind) {
    case "assignment":
      return "Assignment";
    case "deliverable_group":
      return "Deliverable";
    case "post":
      return "Post";
    default:
      return kind;
  }
}

function achievedAmount(row: OperationalBillingRow): number {
  return isOperationalRowAchieved(row) ? row.billable_amount : 0;
}

type BillingCampaignReviewPanelProps = {
  campaignName: string;
  campaignDocumentNumber: string;
  detail: CampaignOperationalBillingDetail | null;
  loading: boolean;
  filter: CampaignBillingQueueFilter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function BillingCampaignReviewPanelInner({
  campaignName,
  campaignDocumentNumber,
  detail,
  loading,
  filter,
  open,
  onOpenChange,
}: BillingCampaignReviewPanelProps) {
  const operationalFilter = mapCampaignQueueFilterToOperational(filter);

  const suiteRows =
    useOperationalTableDataContextOptional<OperationalBillingRow>()?.processedRows ??
    detail?.operational_rows ??
    [];

  const filteredRows = useMemo(
    () =>
      suiteRows.length > 0
        ? filterOperationalBillingTree(suiteRows, operationalFilter)
        : [],
    [suiteRows, operationalFilter]
  );

  const flatRows = useMemo(() => flattenReviewRows(filteredRows), [filteredRows]);
  const unfilteredRowCount = useMemo(
    () =>
      detail && filter !== "all" ? flattenReviewRows(detail.operational_rows).length : 0,
    [detail, filter]
  );

  return (
    <div
      id="billing-campaign-review"
      className={cn(
        "scroll-mt-4",
        open && "shadow-sm"
      )}
    >
    <CampaignFlatSection
      title="Campaign lines review"
      description={`${campaignDocumentNumber} · ${campaignName}`}
      className="border-primary/20 ring-1 ring-primary/10"
      actions={
        <div className="flex items-center gap-2">
          <OperationalTableSettingsButton contextLabel="Campaign lines review" />
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
        </div>
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
            <>
              {flatRows.length === 0 ? (
                <p className="px-4 py-8 text-[11px] text-muted-foreground">
                  {filter !== "all" && unfilteredRowCount > 0
                    ? `No lines match the "${filter.replace(/_/g, " ")}" filter. ${unfilteredRowCount} line(s) hidden — switch to All to review the full campaign.`
                    : "No operational billing lines found for this campaign."}
                </p>
              ) : (
                <CampaignOperationalTable>
                  <BillingCampaignReviewTableHeader />
                  <CampaignOperationalTableBody>
                    {flatRows.map(({ row, depth }) => (
                      <CampaignOperationalTableRow key={row.id}>
                        <BillingCampaignReviewTableCells
                          row={row}
                          depth={depth}
                          currency={detail.currency_code}
                        />
                      </CampaignOperationalTableRow>
                    ))}
                  </CampaignOperationalTableBody>
                </CampaignOperationalTable>
              )}

              {flatRows.length > 0 ? (
                <BillingCampaignDrilldown detail={detail} filter={operationalFilter} />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </CampaignFlatSection>
    </div>
  );
}

export const BillingCampaignReviewPanel = memo(BillingCampaignReviewPanelInner);

function BillingCampaignReviewTableHeader() {
  const showType = useIsOperationalColumnVisible("type");
  const showLine = useIsOperationalColumnVisible("line");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showInvoiceStatus = useIsOperationalColumnVisible("invoice_status");
  const showAchieved = useIsOperationalColumnVisible("achieved");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showBillingStatus = useIsOperationalColumnVisible("billing_status");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showType ? <CampaignOperationalTableHead>Type</CampaignOperationalTableHead> : null}
        {showLine ? <CampaignOperationalTableHead>Line</CampaignOperationalTableHead> : null}
        {showInvoice ? <CampaignOperationalTableHead>Invoice</CampaignOperationalTableHead> : null}
        {showInvoiceStatus ? (
          <CampaignOperationalTableHead>Invoice status</CampaignOperationalTableHead>
        ) : null}
        {showAchieved ? (
          <CampaignOperationalTableHead className="text-right">Achieved</CampaignOperationalTableHead>
        ) : null}
        {showInvoiced ? (
          <CampaignOperationalTableHead className="text-right">Invoiced</CampaignOperationalTableHead>
        ) : null}
        {showRemaining ? (
          <CampaignOperationalTableHead className="text-right">Remaining</CampaignOperationalTableHead>
        ) : null}
        {showBillingStatus ? (
          <CampaignOperationalTableHead>Billing status</CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function BillingCampaignReviewTableCells({
  row,
  depth,
  currency,
}: {
  row: OperationalBillingRow;
  depth: number;
  currency: string;
}) {
  const showType = useIsOperationalColumnVisible("type");
  const showLine = useIsOperationalColumnVisible("line");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showInvoiceStatus = useIsOperationalColumnVisible("invoice_status");
  const showAchieved = useIsOperationalColumnVisible("achieved");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showBillingStatus = useIsOperationalColumnVisible("billing_status");

  const invoiceStatus =
    row.invoiced_amount >= row.billable_amount && row.billable_amount > 0
      ? "Invoiced"
      : row.invoiced_amount > 0
        ? "Partially invoiced"
        : "Not invoiced";

  return (
    <>
      {showType ? (
        <CampaignOperationalTableCell>
          <Badge variant="outline" className="text-[10px]">
            {rowKindLabel(row.kind)}
          </Badge>
        </CampaignOperationalTableCell>
      ) : null}
      {showLine ? (
        <CampaignOperationalTableCell>
          <div className="min-w-[12rem]" style={{ paddingLeft: depth * 16 }}>
            <p className="font-medium">{row.label}</p>
            {row.document_number ? (
              <p className="text-[10px] tabular-nums text-muted-foreground">
                <DocumentNumber value={row.document_number} />
              </p>
            ) : null}
          </div>
        </CampaignOperationalTableCell>
      ) : null}
      {showInvoice ? (
        <CampaignOperationalTableCellMono>
          {row.invoice_document_number ?? "—"}
        </CampaignOperationalTableCellMono>
      ) : null}
      {showInvoiceStatus ? (
        <CampaignOperationalTableCell className="text-muted-foreground">
          {invoiceStatus}
        </CampaignOperationalTableCell>
      ) : null}
      {showAchieved ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoneyCompact(achievedAmount(row), currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showInvoiced ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoneyCompact(row.invoiced_amount, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showRemaining ? (
        <CampaignOperationalTableCellAmount>
          {formatBillingMoneyCompact(row.remaining_amount, currency)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showBillingStatus ? (
        <CampaignOperationalTableCell>
          {row.kind === "assignment" ? (
            <BillingStatusBadge status={row.line_billing_status} />
          ) : (
            <DeliverableBillingStatusBadge
              status={
                row.billing_status as import("@/features/billing/types").AssignmentDeliverableBillingStatus
              }
            />
          )}
        </CampaignOperationalTableCell>
      ) : null}
    </>
  );
}
