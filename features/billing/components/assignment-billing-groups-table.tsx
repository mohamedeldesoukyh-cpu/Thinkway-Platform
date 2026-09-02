"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { DocumentNumber } from "@/components/ui/document-number";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { isDeliverableInvoiceEligible } from "@/lib/billing/deliverable-billing";
import type { AssignmentBillingGroup, BillingLineRow } from "@/features/billing/types";
import {
  useIsOperationalColumnVisible,
} from "@/components/tables/operational-table-column-context";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";

export const CAMPAIGN_ASSIGNMENT_BILLING_GROUPS_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "expand", label: "Expand", locked: true },
  { id: "assignment", label: "Assignment" },
  { id: "status", label: "Status" },
  { id: "total", label: "Total" },
  { id: "invoiced", label: "Invoiced" },
  { id: "remaining", label: "Remaining" },
  { id: "collected", label: "Collected" },
  { id: "invoice", label: "Invoice" },
  { id: "actions", label: "Actions", locked: true },
];

function formatLiveDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "MMM d, yyyy");
}

type AssignmentBillingGroupsTableProps = {
  groups: AssignmentBillingGroup[];
  billingLines: BillingLineRow[];
  currency: string;
  campaignId: string;
  renderActions?: (line: BillingLineRow) => React.ReactNode;
};

export function AssignmentBillingGroupsTable({
  groups,
  billingLines,
  currency,
  campaignId,
  renderActions,
}: AssignmentBillingGroupsTableProps) {
  const lineMap = new Map(billingLines.map((l) => [l.id, l]));

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No campaign assignments.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <CampaignOperationalTable>
        <AssignmentBillingGroupsTableHeader />
        <CampaignOperationalTableBody>
          {groups.map((group) => (
            <AssignmentBillingGroupRow
              key={group.line_id}
              group={group}
              line={lineMap.get(group.line_id)}
              currency={currency}
              campaignId={campaignId}
              renderActions={renderActions}
            />
          ))}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>
    </div>
  );
}

function AssignmentBillingGroupsTableHeader() {
  const showExpand = useIsOperationalColumnVisible("expand");
  const showAssignment = useIsOperationalColumnVisible("assignment");
  const showStatus = useIsOperationalColumnVisible("status");
  const showTotal = useIsOperationalColumnVisible("total");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showCollected = useIsOperationalColumnVisible("collected");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showActions = useIsOperationalColumnVisible("actions");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showExpand ? <CampaignOperationalTableHead className="w-8" /> : null}
        {showAssignment ? <CampaignOperationalTableHead>Assignment</CampaignOperationalTableHead> : null}
        {showStatus ? <CampaignOperationalTableHead>Status</CampaignOperationalTableHead> : null}
        {showTotal ? (
          <CampaignOperationalTableHead className="text-right">Total</CampaignOperationalTableHead>
        ) : null}
        {showInvoiced ? (
          <CampaignOperationalTableHead className="text-right">Invoiced</CampaignOperationalTableHead>
        ) : null}
        {showRemaining ? (
          <CampaignOperationalTableHead className="text-right">Remaining</CampaignOperationalTableHead>
        ) : null}
        {showCollected ? (
          <CampaignOperationalTableHead className="text-right">Collected</CampaignOperationalTableHead>
        ) : null}
        {showInvoice ? <CampaignOperationalTableHead>Invoice</CampaignOperationalTableHead> : null}
        {showActions ? (
          <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function AssignmentBillingGroupRow({
  group,
  line,
  currency,
  campaignId,
  renderActions,
}: {
  group: AssignmentBillingGroup;
  line?: BillingLineRow;
  currency: string;
  campaignId: string;
  renderActions?: (line: BillingLineRow) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDeliverables = group.deliverables.length > 0;

  const showExpand = useIsOperationalColumnVisible("expand");
  const showAssignment = useIsOperationalColumnVisible("assignment");
  const showStatus = useIsOperationalColumnVisible("status");
  const showTotal = useIsOperationalColumnVisible("total");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showCollected = useIsOperationalColumnVisible("collected");
  const showInvoice = useIsOperationalColumnVisible("invoice");
  const showActions = useIsOperationalColumnVisible("actions");

  const title =
    group.influencer_name != null
      ? `${group.influencer_name} — ${group.pricing_mode === "package" ? "Package" : "Per deliverable"}`
      : group.name;

  return (
    <>
      <CampaignOperationalTableRow className="bg-muted/20">
        {showExpand ? (
          <CampaignOperationalTableCell>
            {hasDeliverables ? (
              <button
                type="button"
                className="rounded p-1 hover:bg-muted"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? `Hide deliverables for ${title}` : `Show deliverables for ${title}`}
                title={expanded ? "Hide deliverables" : "Show deliverables"}
              >
                {expanded ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
              </button>
            ) : null}
          </CampaignOperationalTableCell>
        ) : null}
        {showAssignment ? (
          <CampaignOperationalTableCell>
            <p className="font-medium">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              <DocumentNumber value={group.document_number} />
            </p>
            {group.platform_summary ? (
              <p className="text-[11px] text-muted-foreground">{group.platform_summary}</p>
            ) : null}
          </CampaignOperationalTableCell>
        ) : null}
        {showStatus ? (
          <CampaignOperationalTableCell>
            <BillingStatusBadge status={group.billing_status} />
          </CampaignOperationalTableCell>
        ) : null}
        {showTotal ? (
          <CampaignOperationalTableCellAmount>
            {formatOperationalAmount(group.total_value)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showInvoiced ? (
          <CampaignOperationalTableCellAmount>
            {formatOperationalAmount(group.invoiced_value)}
            {group.total_value > 0 ? (
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                {Math.round((group.invoiced_value / group.total_value) * 100)}%
              </span>
            ) : null}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showRemaining ? (
          <CampaignOperationalTableCellAmount>
            {formatOperationalAmount(group.remaining_value)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showCollected ? (
          <CampaignOperationalTableCellAmount>
            {formatOperationalAmount(group.collected_value)}
          </CampaignOperationalTableCellAmount>
        ) : null}
        {showInvoice ? (
          <CampaignOperationalTableCell>
            {group.invoice_id ? (
              <Link
                href={`/billing/invoices/${group.invoice_id}`}
                className="text-[11px] tabular-nums hover:underline"
              >
                <DocumentNumber value={group.invoice_document_number} />
              </Link>
            ) : (
              "—"
            )}
          </CampaignOperationalTableCell>
        ) : null}
        {showActions ? (
          <CampaignOperationalTableCell className="text-right">
            {line && renderActions ? renderActions(line) : null}
          </CampaignOperationalTableCell>
        ) : null}
      </CampaignOperationalTableRow>

      {expanded &&
        group.deliverables.map((deliverable) => (
          <AssignmentBillingDeliverableRow
            key={deliverable.id}
            deliverable={deliverable}
            showExpand={showExpand}
            showAssignment={showAssignment}
            showStatus={showStatus}
            showTotal={showTotal}
            showInvoiced={showInvoiced}
            showRemaining={showRemaining}
            showCollected={showCollected}
            showInvoice={showInvoice}
            showActions={showActions}
          />
        ))}
    </>
  );
}

function AssignmentBillingDeliverableRow({
  deliverable,
  showExpand,
  showAssignment,
  showStatus,
  showTotal,
  showInvoiced,
  showRemaining,
  showCollected,
  showInvoice,
  showActions,
}: {
  deliverable: AssignmentBillingGroup["deliverables"][number];
  showExpand: boolean;
  showAssignment: boolean;
  showStatus: boolean;
  showTotal: boolean;
  showInvoiced: boolean;
  showRemaining: boolean;
  showCollected: boolean;
  showInvoice: boolean;
  showActions: boolean;
}) {
  return (
    <CampaignOperationalTableRow className="bg-muted/10">
      {showExpand ? <CampaignOperationalTableCell /> : null}
      {showAssignment ? (
        <CampaignOperationalTableCell className="pl-8">
          <div className="flex items-center gap-2">
            <p className="font-medium">{deliverable.label}</p>
            {deliverable.locked_at ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <LockIcon className="size-3" />
                Locked
              </Badge>
            ) : null}
          </div>
          {deliverable.live_date ? (
            <p className="text-[11px] text-muted-foreground">
              Live {formatLiveDate(deliverable.live_date) ?? "—"}
            </p>
          ) : null}
        </CampaignOperationalTableCell>
      ) : null}
      {showStatus ? (
        <CampaignOperationalTableCell>
          <DeliverableBillingStatusBadge status={deliverable.billing_status} />
        </CampaignOperationalTableCell>
      ) : null}
      {showTotal ? (
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(deliverable.billable_amount)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showInvoiced ? (
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(deliverable.invoiced_amount)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showRemaining ? (
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(deliverable.remaining_amount)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showCollected ? (
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(deliverable.collected_amount)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showInvoice ? <CampaignOperationalTableCell /> : null}
      {showActions ? <CampaignOperationalTableCell /> : null}
    </CampaignOperationalTableRow>
  );
}

export function countEligibleDeliverables(group: AssignmentBillingGroup): number {
  return group.deliverables.filter((d) =>
    isDeliverableInvoiceEligible(d, group.billing_status)
  ).length;
}
