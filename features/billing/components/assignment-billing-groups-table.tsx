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
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            <CampaignOperationalTableHead className="w-8" />
            <CampaignOperationalTableHead>Assignment</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Total</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Invoiced</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Remaining</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Collected</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Invoice</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
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
  const title =
    group.influencer_name != null
      ? `${group.influencer_name} — ${group.pricing_mode === "package" ? "Package" : "Per deliverable"}`
      : group.name;

  return (
    <>
      <CampaignOperationalTableRow className="bg-muted/20">
        <CampaignOperationalTableCell>
          {hasDeliverables ? (
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
            </button>
          ) : null}
        </CampaignOperationalTableCell>
        <CampaignOperationalTableCell>
          <p className="font-medium">{title}</p>
          <p className="text-[11px] text-muted-foreground">
            <DocumentNumber value={group.document_number} />
          </p>
          {group.platform_summary ? (
            <p className="text-[11px] text-muted-foreground">{group.platform_summary}</p>
          ) : null}
        </CampaignOperationalTableCell>
        <CampaignOperationalTableCell>
          <BillingStatusBadge status={group.billing_status} />
        </CampaignOperationalTableCell>
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(group.total_value)}
        </CampaignOperationalTableCellAmount>
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(group.invoiced_value)}
        </CampaignOperationalTableCellAmount>
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(group.remaining_value)}
        </CampaignOperationalTableCellAmount>
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(group.collected_value)}
        </CampaignOperationalTableCellAmount>
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
        <CampaignOperationalTableCell className="text-right">
          {line && renderActions ? renderActions(line) : null}
        </CampaignOperationalTableCell>
      </CampaignOperationalTableRow>

      {expanded &&
        group.deliverables.map((deliverable) => (
          <CampaignOperationalTableRow key={deliverable.id} className="bg-muted/10">
            <CampaignOperationalTableCell />
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
            <CampaignOperationalTableCell>
              <DeliverableBillingStatusBadge status={deliverable.billing_status} />
            </CampaignOperationalTableCell>
            <CampaignOperationalTableCellAmount>
              {formatOperationalAmount(deliverable.billable_amount)}
            </CampaignOperationalTableCellAmount>
            <CampaignOperationalTableCellAmount>
              {formatOperationalAmount(deliverable.invoiced_amount)}
            </CampaignOperationalTableCellAmount>
            <CampaignOperationalTableCellAmount>
              {formatOperationalAmount(deliverable.remaining_amount)}
            </CampaignOperationalTableCellAmount>
            <CampaignOperationalTableCellAmount>
              {formatOperationalAmount(deliverable.collected_amount)}
            </CampaignOperationalTableCellAmount>
            <CampaignOperationalTableCell colSpan={2} />
          </CampaignOperationalTableRow>
        ))}
    </>
  );
}

export function countEligibleDeliverables(group: AssignmentBillingGroup): number {
  return group.deliverables.filter((d) =>
    isDeliverableInvoiceEligible(d, group.billing_status)
  ).length;
}
