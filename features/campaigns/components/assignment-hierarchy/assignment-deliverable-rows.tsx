"use client";

import Link from "next/link";
import { format } from "date-fns";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoney, formatPlatformLabel } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentDeliverableRowsProps = {
  deliverables: AssignmentDeliverableHierarchyRow[];
  currency: string;
  selectedIds: Set<string>;
  onToggleDeliverable: (id: string) => void;
  showSelection: boolean;
};

function ScheduleChips({ deliverable }: { deliverable: AssignmentDeliverableHierarchyRow }) {
  if (deliverable.schedules.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {deliverable.schedules.map((schedule) => (
        <Badge key={schedule.id} variant="secondary" className="text-[10px] font-normal">
          Post #{schedule.sequence_number}
          {schedule.live_date
            ? ` · ${format(new Date(`${schedule.live_date}T00:00:00`), "MMM d")}`
            : ""}
          {" · "}
          {schedule.status.replace(/_/g, " ")}
        </Badge>
      ))}
    </div>
  );
}

function DeliverableRow({
  deliverable,
  currency,
  selected,
  onToggle,
  showSelection,
}: {
  deliverable: AssignmentDeliverableHierarchyRow;
  currency: string;
  selected: boolean;
  onToggle: () => void;
  showSelection: boolean;
}) {
  const collectionLabel =
    deliverable.collection_status === "collected"
      ? "Collected"
      : deliverable.collection_status === "partial"
        ? "Partial"
        : deliverable.collection_status === "pending"
          ? "Pending"
          : "—";

  return (
    <TableRow
      className={cn(
        "border-l-2 border-l-primary/25 bg-muted/15 hover:bg-muted/30",
        selected && "bg-primary/5"
      )}
    >
      <TableCell />
      <TableCell>
        {showSelection && deliverable.invoice_eligible && !deliverable.is_synthetic ? (
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${deliverable.label}`}
          />
        ) : null}
      </TableCell>
      <TableCell>
        <div className="border-l border-border/80 pl-3">
          <p className="text-sm font-medium">{deliverable.label}</p>
          <p className="text-xs text-muted-foreground">{deliverable.deliverable_type_label}</p>
          <ScheduleChips deliverable={deliverable} />
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">—</TableCell>
      <TableCell className="text-sm">{formatPlatformLabel(deliverable.platform)}</TableCell>
      <TableCell className="text-right text-sm">
        <div>{deliverable.quantity}</div>
        <div className="text-xs text-muted-foreground">
          {deliverable.live_date
            ? format(new Date(`${deliverable.live_date}T00:00:00`), "MMM d")
            : "No date"}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(deliverable.revenue_before_vat, currency)}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(deliverable.cost_before_vat, currency)}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(deliverable.revenue_vat_amount, currency)}
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
      <TableCell>
        <DeliverableBillingBadge status={deliverable.billing_status} />
      </TableCell>
      <TableCell>
        {deliverable.payout_status ? (
          <Badge variant="secondary" className="text-xs font-normal">
            {VENDOR_PAYMENT_STATUS_LABELS[deliverable.payout_status]}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <DeliverableWorkflowBadge status={deliverable.workflow_status} />
          <p className="text-[10px] text-muted-foreground">{collectionLabel}</p>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {deliverable.invoice_document_number ? (
          <Link
            href={`/billing/invoices/${deliverable.invoice_id}`}
            className="font-mono text-xs hover:underline"
          >
            {deliverable.invoice_document_number}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export const AssignmentDeliverableRows = memo(function AssignmentDeliverableRows({
  deliverables,
  currency,
  selectedIds,
  onToggleDeliverable,
  showSelection,
}: AssignmentDeliverableRowsProps) {
  return (
    <>
      {deliverables.map((deliverable) => (
        <DeliverableRow
          key={deliverable.id}
          deliverable={deliverable}
          currency={currency}
          selected={selectedIds.has(deliverable.id)}
          onToggle={() => onToggleDeliverable(deliverable.id)}
          showSelection={showSelection}
        />
      ))}
    </>
  );
});
