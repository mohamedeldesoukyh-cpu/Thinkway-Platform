"use client";

import { FileTextIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows";
import { AssignmentParentRow } from "@/features/campaigns/components/assignment-hierarchy/assignment-parent-row";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentHierarchyTableProps = {
  hierarchy: AssignmentHierarchy;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceSelected?: (deliverableIds: string[]) => void;
  showInvoiceSelection?: boolean;
};

export function AssignmentHierarchyTable({
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
      <div className="overflow-x-auto rounded-3xl border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-10" />
              <TableHead>Assignment</TableHead>
              <TableHead>Influencer</TableHead>
              <TableHead>Platforms</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">GP</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead>Ops</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                      deliverables={group.deliverables}
                      currency={currency}
                      selectedIds={selectedIds}
                      onToggleDeliverable={toggleDeliverable}
                      showSelection={showInvoiceSelection}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showInvoiceSelection && selectedIds.size > 0 ? (
        <div
          className={cn(
            "sticky bottom-2 flex flex-wrap items-center justify-between gap-3",
            "rounded-3xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur"
          )}
        >
          <div className="text-sm">
            <span className="font-medium">{selectedIds.size}</span> deliverable
            {selectedIds.size === 1 ? "" : "s"} selected · Invoice{" "}
            <span className="font-semibold">{formatMoney(selectedTotal, currency)}</span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onInvoiceSelected?.([...selectedIds])}
          >
            <FileTextIcon data-icon="inline-start" />
            Create invoice from selection
          </Button>
        </div>
      ) : null}
    </div>
  );
}
