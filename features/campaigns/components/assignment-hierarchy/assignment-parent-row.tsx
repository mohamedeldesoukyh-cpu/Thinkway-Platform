"use client";

import { PencilIcon, UserIcon } from "lucide-react";
import { memo, useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { HierarchyBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { DocumentNumber } from "@/components/ui/document-number";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatPercent } from "@/features/campaigns/utils";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import { cn } from "@/lib/utils";

type AssignmentParentRowProps = {
  group: AssignmentHierarchyGroup;
  viewModel: AssignmentRowViewModel;
  currency: string;
  expanded: boolean;
  enableExpansion?: boolean;
  enableBillingPills?: boolean;
  enableSelection?: boolean;
  onToggleExpand: () => void;
  onEdit: (line: CampaignLineWorkspace) => void;
  parentSelected: boolean;
  parentIndeterminate: boolean;
  onToggleParentSelect: () => void;
  rowSelectable: boolean;
  rowIndex: number;
  focused: boolean;
  onFocus: () => void;
};

export const AssignmentParentRow = memo(function AssignmentParentRow({
  group,
  viewModel,
  expanded,
  enableExpansion = true,
  enableBillingPills = true,
  enableSelection = true,
  onToggleExpand,
  onEdit,
  parentSelected,
  parentIndeterminate,
  onToggleParentSelect,
  rowSelectable,
  rowIndex,
  focused,
  onFocus,
}: AssignmentParentRowProps) {
  const { line } = group;
  const {
    rollups,
    displayName,
    operationalStatus,
    childBillingStatus,
    platformSummary,
    postingSummary,
    opsStatusLabel,
    billingStatusLabel,
  } = viewModel;
  const selectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.indeterminate = parentIndeterminate;
    }
  }, [parentIndeterminate, parentSelected]);

  const rowClass = LINE_OPERATIONAL_ROW_CLASS[operationalStatus] ?? LINE_OPERATIONAL_ROW_CLASS.draft;

  return (
    <TableRow
      tabIndex={0}
      data-row-index={rowIndex}
      data-line-id={line.id}
      onFocus={onFocus}
      className={cn(
        "border-b border-border/25 text-[11px] font-normal hover:bg-muted/20",
        OPERATIONAL_TABLE_SURFACE,
        rowClass,
        focused && "ring-1 ring-inset ring-primary/20",
        expanded && cn("sticky top-[36px] z-[5] border-b-0 shadow-sm", OPERATIONAL_TABLE_SURFACE)
      )}
    >
      {enableExpansion ? (
        <TableCell className="w-8 px-1.5 py-1.5">
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
      ) : null}
      {enableSelection ? (
        <TableCell className="w-8 px-1.5 py-1.5">
          {rowSelectable ? (
            <input
              ref={selectRef}
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={parentSelected}
              onChange={onToggleParentSelect}
              aria-label={`Select assignment ${line.influencer_name ?? line.name}`}
            />
          ) : null}
        </TableCell>
      ) : null}
      <TableCell className="min-w-[140px] px-1.5 py-1.5">
        <div>
          <span className="font-medium text-foreground">{displayName}</span>
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={line.document_number} />
          </p>
        </div>
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-muted-foreground">
        {line.influencer_name ? (
          <div className="flex items-center gap-1">
            <UserIcon className="size-3 text-muted-foreground" />
            <span>{line.influencer_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">{platformSummary}</TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {rollups.deliverable_count}
      </TableCell>
      <TableCell
        className="px-1.5 py-1.5 text-muted-foreground"
        suppressHydrationWarning
      >
        {postingSummary}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        {enableBillingPills ? (
          <>
            <AssignmentOperationalStatusBadge status={operationalStatus} />
            {line.vendor_io_document_number ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                <DocumentNumber value={line.vendor_io_document_number} />
              </p>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">{opsStatusLabel}</span>
        )}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        {enableBillingPills ? (
          <HierarchyBillingStatusBadge
            operationalStatus={operationalStatus}
            billingStatus={childBillingStatus}
          />
        ) : (
          <span className="capitalize text-muted-foreground">{billingStatusLabel}</span>
        )}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(rollups.revenue)}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.cost_received)}
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-center text-[10px] font-normal text-muted-foreground">
        {line.cost_received_currency ?? "—"}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.cost_before_vat)}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(rollups.gp)}
      </TableCell>
      <TableCell
        className={cn(
          "px-1.5 py-1.5 text-right",
          OPERATIONAL_AMOUNT_CLASS,
          "text-muted-foreground"
        )}
      >
        {formatPercent(rollups.margin_percent)}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        {line.vendor_payment_status ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status] ?? line.vendor_payment_status}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onEdit(line)}
        >
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit assignment</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});
