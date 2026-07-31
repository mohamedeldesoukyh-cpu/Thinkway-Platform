"use client";

import { PencilIcon } from "lucide-react";
import { memo, useEffect, useRef } from "react";

import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentPlatformPills } from "@/features/campaigns/components/assignment-hierarchy/assignment-platform-pills";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { LineBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_COST_AMOUNT_CLASS,
  OPERATIONAL_REVENUE_AMOUNT_CLASS,
  OPERATIONAL_TABLE_SURFACE,
  operationalGpAmountClass,
  operationalMarginAmountClass,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { DocumentNumber } from "@/components/ui/document-number";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatPercent } from "@/features/campaigns/utils";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import { resolveAssignmentLineCurrencyDisplay } from "@/lib/campaigns/assignment-line-currency";
import { assignmentParentColDataAttr } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
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
    platforms,
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
        // Sticky within campaign scrollport (banner is outside this region).
        expanded && cn("sticky top-0 z-[5] border-b-0 shadow-sm", OPERATIONAL_TABLE_SURFACE)
      )}
    >
      {enableExpansion ? (
        <TableCell {...assignmentParentColDataAttr("expand")} className="w-8 px-1.5 py-1.5">
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
        <TableCell {...assignmentParentColDataAttr("select")} className="w-8 px-1.5 py-1.5">
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
      <TableCell {...assignmentParentColDataAttr("assignment")} className="min-w-[140px] px-1.5 py-1.5">
        <div>
          <span className="font-medium text-foreground">{displayName}</span>
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={line.document_number} />
          </p>
        </div>
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("creator")}
        className="w-[108px] max-w-[120px] px-1.5 py-1.5"
      >
        {line.influencer_name ? (
          <CreatorIdentityCell
            source={creatorProfileSourceFromAccounts(
              line.influencer_name,
              line.creator_platform_accounts
            )}
            size="xs"
            showAvatar={false}
            showHandle={false}
            stopPropagation
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("platforms")} className="w-[72px] max-w-[88px] px-1.5 py-1.5">
        <AssignmentPlatformPills platforms={platforms} />
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("deliverables")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {rollups.deliverable_count}
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("postingDates")}
        className="px-1.5 py-1.5 text-muted-foreground"
        suppressHydrationWarning
      >
        {postingSummary}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("costCurrency")} className="px-1.5 py-1.5 text-center text-[10px] font-medium text-foreground/80">
        {resolveAssignmentLineCurrencyDisplay(line)}
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("revenue")}
        className={cn(
          "px-1.5 py-1.5 text-right",
          OPERATIONAL_REVENUE_AMOUNT_CLASS,
          "bg-primary/8 font-semibold"
        )}
      >
        {formatOperationalAmount(rollups.revenue)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("usageRights")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.usage_rights_amount)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("agencyFeePercent")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS, "text-muted-foreground")}>
        {formatPercent(line.agency_fee_percent)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("agencyFee")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.agency_fee_amount)}
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("cost")}
        className={cn(
          "px-1.5 py-1.5 text-right",
          OPERATIONAL_COST_AMOUNT_CLASS,
          "bg-amber-500/10 font-semibold dark:bg-amber-500/15"
        )}
      >
        {formatOperationalAmount(line.cost_before_vat)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("usageRightsCost")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.usage_rights_cost)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("vat")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.revenue_vat_amount)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("totalBilling")} className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.revenue_after_vat)}
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("gp")}
        className={cn("px-1.5 py-1.5 text-right", operationalGpAmountClass(rollups.gp))}
      >
        {formatOperationalAmount(rollups.gp)}
      </TableCell>
      <TableCell
        {...assignmentParentColDataAttr("margin")}
        className={cn(
          "px-1.5 py-1.5 text-right",
          operationalMarginAmountClass(rollups.margin_percent)
        )}
      >
        {formatPercent(rollups.margin_percent)}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("opsStatus")} className="px-1.5 py-1.5">
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
      <TableCell {...assignmentParentColDataAttr("billing")} className="px-1.5 py-1.5">
        {enableBillingPills ? (
          <LineBillingStatusBadge lineBillingStatus={viewModel.lineBillingStatus} />
        ) : (
          <span className="capitalize text-muted-foreground">{billingStatusLabel}</span>
        )}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("payout")} className="px-1.5 py-1.5">
        {line.vendor_payment_status ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status] ?? line.vendor_payment_status}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell {...assignmentParentColDataAttr("actions")} className="px-1.5 py-1.5 text-right">
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
