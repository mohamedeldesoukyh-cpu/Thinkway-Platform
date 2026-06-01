"use client";

import { format } from "date-fns";
import { PencilIcon, UserIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { platformShortLabel } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
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
  const eligibleCount = group.deliverables.filter(
    (d) => d.invoice_eligible && !d.is_synthetic
  ).length;

  const platformSummary = useMemo(() => summarizePlatforms(group), [group]);
  const postingSummary = useMemo(() => summarizePostingDates(group), [group]);

  return (
    <TableRow
      tabIndex={0}
      data-row-index={rowIndex}
      onFocus={onFocus}
      className={cn(
        "bg-background text-xs hover:bg-muted/30",
        focused && "ring-1 ring-inset ring-primary/30",
        expanded && "sticky top-[41px] z-[5] border-b-0 bg-background shadow-sm"
      )}
    >
      <TableCell className="w-8 px-2 py-2">
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
      <TableCell className="w-8 px-2 py-2">
        {showSelection && eligibleCount > 0 ? (
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
      <TableCell className="min-w-[140px] px-2 py-2">
        <div>
          <span className="font-medium">{line.name}</span>
          <p className="font-mono text-[10px] text-muted-foreground">{line.document_number}</p>
        </div>
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.influencer_name ? (
          <div className="flex items-center gap-1">
            <UserIcon className="size-3 text-muted-foreground" />
            <span>{line.influencer_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">{platformSummary}</TableCell>
      <TableCell className="px-2 py-2 text-right">{rollups.deliverable_count}</TableCell>
      <TableCell className="px-2 py-2 text-muted-foreground">{postingSummary}</TableCell>
      <TableCell className="px-2 py-2">
        <AssignmentStatusBadge status={line.assignment_status} />
      </TableCell>
      <TableCell className="px-2 py-2">
        <Badge variant="outline" className="text-[10px] font-normal">
          {LINE_BILLING_STATUS_LABELS[line.billing_status]}
        </Badge>
        {rollups.invoiced_value > 0 ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatMoney(rollups.invoiced_value, currency)} inv
          </p>
        ) : null}
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-mono font-medium">
        {formatMoney(rollups.revenue, currency)}
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-mono">
        {formatMoney(rollups.cost, currency)}
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-mono">
        {formatMoney(rollups.gp, currency)}
      </TableCell>
      <TableCell className="px-2 py-2 text-right">
        {formatPercent(rollups.margin_percent)}
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.vendor_payment_status ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2 text-right">
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onEdit(line)}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Edit assignment</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});
