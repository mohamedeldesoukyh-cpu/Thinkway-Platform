"use client";

import { format } from "date-fns";
import { PencilIcon, UserIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { platformShortLabel } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { HierarchyBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { buildAssignmentDisplayName } from "@/lib/campaigns/assignment-line-naming";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { DocumentNumber } from "@/components/ui/document-number";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatPercent } from "@/features/campaigns/utils";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
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

function summarizePostingDates(group: AssignmentHierarchyGroup): string {
  const dates = group.deliverables
    .flatMap((d) => d.posts.map((p) => p.live_date).filter(Boolean) as string[])
    .sort();

  if (dates.length === 0) return "—";
  if (dates.length === 1) {
    return format(new Date(`${dates[0]}T00:00:00`), "d MMM");
  }
  const first = format(new Date(`${dates[0]}T00:00:00`), "d MMM");
  const last = format(new Date(`${dates[dates.length - 1]}T00:00:00`), "d MMM");
  return `${first}–${last}`;
}

function summarizePlatforms(group: AssignmentHierarchyGroup): string {
  const platforms = [...new Set(group.deliverables.map((d) => d.platform))];
  if (platforms.length === 0) return group.line.platform_summary ?? "—";
  return platforms.map(platformShortLabel).join(", ");
}

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
  const displayName = useMemo(
    () =>
      buildAssignmentDisplayName(line.influencer_name ?? line.name.split(" — ")[0], [
        ...group.deliverables.map((d) => ({
          platform: d.platform,
          deliverable_type: d.deliverable_type,
          posts_count: d.posts.length,
        })),
      ]) || line.name,
    [group.deliverables, line.influencer_name, line.name]
  );
  const operationalStatus = (line.operational_status ?? "draft") as CampaignLineOperationalStatus;
  const childBillingStatus: AssignmentDeliverableBillingStatus =
    operationalStatus === "invoiced"
      ? "invoiced"
      : operationalStatus === "partially_invoiced"
        ? "partially_invoiced"
        : operationalStatus === "io_generated"
          ? "ready_to_invoice"
          : "draft";
  const lineSelectable =
    (operationalStatus === "draft" && !line.vendor_io_id) ||
    (operationalStatus === "io_generated" && Boolean(line.vendor_io_id));

  const platformSummary = useMemo(() => summarizePlatforms(group), [group]);
  const postingSummary = useMemo(() => summarizePostingDates(group), [group]);

  return (
    <TableRow
      tabIndex={0}
      data-row-index={rowIndex}
      onFocus={onFocus}
      className={cn(
        "border-b border-border/25 text-[11px] font-normal hover:bg-muted/20",
        OPERATIONAL_TABLE_SURFACE,
        LINE_OPERATIONAL_ROW_CLASS[operationalStatus],
        focused && "ring-1 ring-inset ring-primary/20",
        expanded && cn("sticky top-[36px] z-[5] border-b-0 shadow-sm", OPERATIONAL_TABLE_SURFACE)
      )}
    >
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
      <TableCell className="w-8 px-1.5 py-1.5">
        {showSelection && lineSelectable ? (
          <input
            type="checkbox"
            className="size-3.5 rounded border-border"
            checked={parentSelected}
            ref={(el) => {
              if (el) el.indeterminate = parentIndeterminate;
            }}
            onChange={onToggleParentSelect}
            aria-label={`Select all deliverables for ${line.influencer_name ?? line.name}`}
          />
        ) : null}
      </TableCell>
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
      <TableCell className="px-1.5 py-1.5 text-muted-foreground">{postingSummary}</TableCell>
      <TableCell className="px-1.5 py-1.5">
        <AssignmentOperationalStatusBadge status={operationalStatus} />
        {line.vendor_io_document_number ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            <DocumentNumber value={line.vendor_io_document_number} />
          </p>
        ) : null}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        <HierarchyBillingStatusBadge
          operationalStatus={operationalStatus}
          billingStatus={childBillingStatus}
        />
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(rollups.revenue)}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.cost_received)}
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-center text-[10px] font-normal text-muted-foreground">
        {line.cost_received_currency}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(line.cost_before_vat)}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS)}>
        {formatOperationalAmount(rollups.gp)}
      </TableCell>
      <TableCell className={cn("px-1.5 py-1.5 text-right", OPERATIONAL_AMOUNT_CLASS, "text-muted-foreground")}>
        {formatPercent(rollups.margin_percent)}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        {line.vendor_payment_status ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-right">
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onEdit(line)}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit assignment</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});
