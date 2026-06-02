"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { isDeliverableInvoiceEligible } from "@/lib/billing/deliverable-billing";
import type { AssignmentBillingGroup, BillingLineRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatMoney } from "@/features/campaigns/utils";

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Assignment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Invoiced</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="text-right">Collected</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
        </TableBody>
      </Table>
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
  const cur = group.currency_code || currency;
  const hasDeliverables = group.deliverables.length > 0;
  const title =
    group.influencer_name != null
      ? `${group.influencer_name} — ${group.pricing_mode === "package" ? "Package" : "Per deliverable"}`
      : group.name;

  return (
    <>
      <TableRow className="bg-muted/20">
        <TableCell>
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
        </TableCell>
        <TableCell>
          <p className="font-medium">{title}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {group.document_number}
          </p>
          {group.platform_summary ? (
            <p className="text-xs text-muted-foreground">{group.platform_summary}</p>
          ) : null}
        </TableCell>
        <TableCell>
          <BillingStatusBadge status={group.billing_status} />
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoney(group.total_value, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoney(group.invoiced_value, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoney(group.remaining_value, cur)}
        </TableCell>
        <TableCell className="text-right">
          {formatBillingMoney(group.collected_value, cur)}
        </TableCell>
        <TableCell>
          {group.invoice_id ? (
            <Link
              href={`/billing/invoices/${group.invoice_id}`}
              className="font-mono text-xs hover:underline"
            >
              {group.invoice_document_number}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-right">
          {line && renderActions ? renderActions(line) : null}
        </TableCell>
      </TableRow>

      {expanded &&
        group.deliverables.map((deliverable) => (
          <TableRow key={deliverable.id} className="bg-background">
            <TableCell />
            <TableCell className="pl-8">
              <div className="flex items-center gap-2">
                <p className="text-sm">{deliverable.label}</p>
                {deliverable.locked_at ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <LockIcon className="size-3" />
                    Locked
                  </Badge>
                ) : null}
              </div>
              {deliverable.live_date ? (
                <p className="text-xs text-muted-foreground">
                  Live {formatLiveDate(deliverable.live_date) ?? "—"}
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <DeliverableBillingStatusBadge status={deliverable.billing_status} />
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatMoney(deliverable.billable_amount, cur)}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatMoney(deliverable.invoiced_amount, cur)}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatMoney(deliverable.remaining_amount, cur)}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatMoney(deliverable.collected_amount, cur)}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        ))}
    </>
  );
}

export function countEligibleDeliverables(group: AssignmentBillingGroup): number {
  return group.deliverables.filter((d) =>
    isDeliverableInvoiceEligible(d, group.billing_status)
  ).length;
}
