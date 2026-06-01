"use client";

import { PencilIcon, UserIcon } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import {
  LINE_BILLING_STATUS_LABELS,
  VENDOR_PAYMENT_STATUS_LABELS,
} from "@/features/campaigns/constants";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentParentRowProps = {
  group: AssignmentHierarchyGroup;
  currency: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (line: CampaignLineWorkspace) => void;
  parentSelected: boolean;
  parentIndeterminate: boolean;
  onToggleParentSelect: () => void;
  showSelection: boolean;
  rowIndex: number;
  focused: boolean;
  onFocus: () => void;
};

export const AssignmentParentRow = memo(function AssignmentParentRow({
  group,
  currency,
  expanded,
  onToggleExpand,
  onEdit,
  parentSelected,
  parentIndeterminate,
  onToggleParentSelect,
  showSelection,
  rowIndex,
  focused,
  onFocus,
}: AssignmentParentRowProps) {
  const { line, rollups } = group;
  const eligibleCount = group.deliverables.filter(
    (d) => d.invoice_eligible && !d.is_synthetic
  ).length;

  return (
    <TableRow
      tabIndex={0}
      data-row-index={rowIndex}
      onFocus={onFocus}
      className={cn(
        "bg-background hover:bg-muted/40",
        focused && "ring-1 ring-inset ring-primary/30",
        expanded && "border-b-0"
      )}
    >
      <TableCell className="w-10 pr-0">
        <AssignmentExpandToggle
          expanded={expanded}
          onToggle={onToggleExpand}
          ariaLabel={
            expanded
              ? `Collapse ${line.influencer_name ?? line.name}`
              : `Expand ${line.influencer_name ?? line.name}`
          }
        />
      </TableCell>
      <TableCell className="w-10">
        {showSelection && eligibleCount > 0 ? (
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            checked={parentSelected}
            ref={(el) => {
              if (el) el.indeterminate = parentIndeterminate;
            }}
            onChange={onToggleParentSelect}
            aria-label={`Select all deliverables for ${line.influencer_name ?? line.name}`}
          />
        ) : null}
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <span className="font-medium">{line.name}</span>
          <p className="font-mono text-xs text-muted-foreground">{line.document_number}</p>
        </div>
      </TableCell>
      <TableCell>
        {line.influencer_name ? (
          <div className="flex items-center gap-1.5">
            <UserIcon className="size-3.5 text-muted-foreground" />
            <span className="text-sm">{line.influencer_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm">{line.platform_summary ?? "—"}</span>
      </TableCell>
      <TableCell className="text-right text-sm">{rollups.deliverable_count}</TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(rollups.revenue, currency)}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(rollups.cost, currency)}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatMoney(rollups.gp, currency)}
      </TableCell>
      <TableCell className="text-right text-sm">
        {formatPercent(rollups.margin_percent)}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {LINE_BILLING_STATUS_LABELS[line.billing_status]}
          </Badge>
          {rollups.invoiced_value > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {formatMoney(rollups.invoiced_value, currency)} invoiced ·{" "}
              {formatMoney(rollups.remaining_value, currency)} open
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {line.vendor_payment_status ? (
          <Badge variant="secondary" className="text-xs">
            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <AssignmentStatusBadge status={line.assignment_status} />
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(line)}>
          <PencilIcon className="size-4" />
          <span className="sr-only">Edit assignment</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});
