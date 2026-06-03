"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type KeyboardEvent,
} from "react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows";
import { AssignmentParentRow } from "@/features/campaigns/components/assignment-hierarchy/assignment-parent-row";
import { AssignmentTotalsFooter } from "@/features/campaigns/components/assignment-hierarchy/assignment-totals-footer";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

const PARENT_COLUMN_COUNT = 15;

type AssignmentHierarchyTableProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceSelected?: (deliverableIds: string[]) => void;
  showInvoiceSelection?: boolean;
};

export function AssignmentHierarchyTable({
  campaignId,
  hierarchy,
  onEditLine,
  onInvoiceSelected,
  showInvoiceSelection = true,
}: AssignmentHierarchyTableProps) {
  const currency = hierarchy.currency_code;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const groups = hierarchy.groups;

  const toggleExpand = useCallback((lineId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const eligibleByLine = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of groups) {
      map.set(
        group.line.id,
        group.deliverables
          .filter((d) => d.invoice_eligible && !d.is_synthetic)
          .map((d) => d.id)
      );
    }
    return map;
  }, [groups]);

  const toggleDeliverable = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleParentSelect = useCallback(
    (lineId: string) => {
      const ids = eligibleByLine.get(lineId) ?? [];
      if (ids.length === 0) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allSelected = ids.every((id) => next.has(id));
        for (const id of ids) {
          if (allSelected) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    },
    [eligibleByLine]
  );

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const group of groups) {
      for (const d of group.deliverables) {
        if (selectedIds.has(d.id)) {
          total += d.remaining_amount;
        }
      }
    }
    return total;
  }, [groups, selectedIds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent | globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!tableRef.current?.contains(document.activeElement)) return;

      if (event.key === "ArrowRight") {
        const group = groups[focusedIndex];
        if (group) {
          setExpandedIds((prev) => new Set(prev).add(group.line.id));
          event.preventDefault();
        }
      } else if (event.key === "ArrowLeft") {
        const group = groups[focusedIndex];
        if (group) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(group.line.id);
            return next;
          });
          event.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown as EventListener);
    return () => window.removeEventListener("keydown", onKeyDown as EventListener);
  }, [focusedIndex, groups]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No creator assignments yet. Search for an influencer to build the first assignment
        package.
      </p>
    );
  }

  return (
    <div ref={tableRef} className="space-y-3">
      <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <TableRow className="text-[10px] uppercase tracking-wide">
              <TableHead className="w-8 px-2">{HIERARCHY_COLUMN_LABELS.expand}</TableHead>
              <TableHead className="w-8 px-2">{HIERARCHY_COLUMN_LABELS.select}</TableHead>
              <TableHead className="min-w-[140px] px-2">{HIERARCHY_COLUMN_LABELS.assignment}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.creator}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.platforms}</TableHead>
              <TableHead className="px-2 text-right">{HIERARCHY_COLUMN_LABELS.deliverables}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.postingDates}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.opsStatus}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.billing}</TableHead>
              <TableHead className="px-2 text-right">{HIERARCHY_COLUMN_LABELS.revenue}</TableHead>
              <TableHead className="px-2 text-right">{HIERARCHY_COLUMN_LABELS.cost}</TableHead>
              <TableHead className="px-2 text-right">{HIERARCHY_COLUMN_LABELS.gp}</TableHead>
              <TableHead className="px-2 text-right">{HIERARCHY_COLUMN_LABELS.margin}</TableHead>
              <TableHead className="px-2">{HIERARCHY_COLUMN_LABELS.payout}</TableHead>
              <TableHead className="w-10 px-2 text-right">{HIERARCHY_COLUMN_LABELS.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group, index) => {
              const lineId = group.line.id;
              const expanded = expandedIds.has(lineId);
              const eligible = eligibleByLine.get(lineId) ?? [];
              const selectedCount = eligible.filter((id) => selectedIds.has(id)).length;
              const parentSelected = eligible.length > 0 && selectedCount === eligible.length;
              const parentIndeterminate =
                selectedCount > 0 && selectedCount < eligible.length;

              return (
                <Fragment key={lineId}>
                  <AssignmentParentRow
                    group={group}
                    currency={currency}
                    expanded={expanded}
                    onToggleExpand={() => toggleExpand(lineId)}
                    onEdit={onEditLine}
                    parentSelected={parentSelected}
                    parentIndeterminate={parentIndeterminate}
                    onToggleParentSelect={() => toggleParentSelect(lineId)}
                    showSelection={showInvoiceSelection}
                    rowIndex={index}
                    focused={focusedIndex === index}
                    onFocus={() => setFocusedIndex(index)}
                  />
                  {expanded ? (
                    <AssignmentDeliverableRows
                      campaignId={campaignId}
                      line={group.line}
                      deliverables={group.deliverables}
                      currency={currency}
                      selectedIds={selectedIds}
                      onToggleDeliverable={toggleDeliverable}
                      showSelection={showInvoiceSelection}
                      parentColSpan={PARENT_COLUMN_COUNT}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>

      {showInvoiceSelection ? (
        <AssignmentTotalsFooter
          selectedCount={selectedIds.size}
          selectedTotal={selectedTotal}
          currency={currency}
          onCreateInvoice={() => onInvoiceSelected?.([...selectedIds])}
        />
      ) : null}
    </div>
  );
}
