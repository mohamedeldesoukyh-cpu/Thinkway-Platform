"use client";

import { useEffect, useMemo } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";

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
  onInvoice?: (selection: OperationalSelectionPayload) => void;
};

export function BillingCampaignReviewPanel({
  campaignName,
  campaignDocumentNumber,
  detail,
  loading,
  filter,
  open,
  onOpenChange,
  onInvoice,
}: BillingCampaignReviewPanelProps) {
  const operationalFilter = mapCampaignQueueFilterToOperational(filter);

  const filteredRows = useMemo(
    () =>
      detail
        ? filterOperationalBillingTree(detail.operational_rows, operationalFilter)
        : [],
    [detail, operationalFilter]
  );

  const flatRows = useMemo(() => flattenReviewRows(filteredRows), [filteredRows]);

  useEffect(() => {
    if (!detail || !open) return;
    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-review-table] review panel rendered", {
        campaignId: detail.campaign_header_id,
        filter,
        operationalFilter,
        rowCount: flatRows.length,
      });
    }
  }, [detail, open, filter, operationalFilter, flatRows.length]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Campaign lines review</CardTitle>
          <p className="text-sm text-muted-foreground">
            {campaignDocumentNumber} · {campaignName}
          </p>
        </div>
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
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4 pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading campaign billing lines…</p>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">
              Unable to load campaign billing detail.
            </p>
          ) : flatRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No operational rows match the current finance filter.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Invoice status</TableHead>
                      <TableHead className="text-right">Achieved</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Billing status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flatRows.map(({ row, depth }) => {
                      const cur = detail.currency_code;
                      const invoiceStatus =
                        row.invoiced_amount >= row.billable_amount && row.billable_amount > 0
                          ? "Invoiced"
                          : row.invoiced_amount > 0
                            ? "Partially invoiced"
                            : "Not invoiced";

                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {rowKindLabel(row.kind)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div
                              className="min-w-[12rem]"
                              style={{ paddingLeft: depth * 16 }}
                            >
                              <p className="text-sm font-medium">{row.label}</p>
                              {row.document_number ? (
                                <p className="font-mono text-[10px] text-muted-foreground">
                                  {row.document_number}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.invoice_document_number ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {invoiceStatus}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBillingMoneyCompact(achievedAmount(row), cur)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBillingMoneyCompact(row.invoiced_amount, cur)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBillingMoneyCompact(row.remaining_amount, cur)}
                          </TableCell>
                          <TableCell>
                            {row.kind === "assignment" ? (
                              <BillingStatusBadge status={row.line_billing_status} />
                            ) : (
                              <DeliverableBillingStatusBadge
                                status={
                                  row.billing_status as import("@/features/billing/types").AssignmentDeliverableBillingStatus
                                }
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <BillingCampaignDrilldown
                detail={detail}
                filter={operationalFilter}
                onInvoice={onInvoice}
              />
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
