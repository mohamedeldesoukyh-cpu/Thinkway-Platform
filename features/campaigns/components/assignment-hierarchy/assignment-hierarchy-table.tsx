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
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { AssignmentDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows";
import { AssignmentParentRow } from "@/features/campaigns/components/assignment-hierarchy/assignment-parent-row";
import { AssignmentOperationalActionsFooter } from "@/features/campaigns/components/assignment-operational-actions-footer";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { effectiveLineOperationalStatus } from "@/lib/campaigns/effective-operational-status";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { isLineInvoiceEligible } from "@/lib/billing/line-invoice-eligibility";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { isLineUngenerateIoEligible } from "@/lib/io/vendor-io-ungenerate-eligibility";
import { cn } from "@/lib/utils";

const PARENT_COLUMN_COUNT = 17;

type AssignmentHierarchyTableProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceLines?: (lineIds: string[]) => void;
};

export function AssignmentHierarchyTable({
  campaignId,
  hierarchy,
  onEditLine,
  onInvoiceLines,
}: AssignmentHierarchyTableProps) {
  const currency = hierarchy.currency_code;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const groups = hierarchy.groups;

  const lineMeta = useMemo(() => {
    const map = new Map<
      string,
      {
        vioEligible: boolean;
        invoiceEligible: boolean;
        reviseVioEligible: boolean;
        ungenerateIoEligible: boolean;
        remaining: number;
      }
    >();
    for (const group of groups) {
      const status = effectiveLineOperationalStatus({
        operational_status: group.line.operational_status,
        vendor_io_id: group.line.vendor_io_id,
        billing_status: group.line.billing_status,
        invoice_id: group.line.invoice_id,
      }) as CampaignLineOperationalStatus;
      const vioEligible = status === "draft" && !group.line.vendor_io_id;
      const invoiceEligible = isLineInvoiceEligible({
        operational_status: status,
        vendor_io_id: group.line.vendor_io_id,
        billing_status: group.line.billing_status,
        is_locked: group.line.revenue_locked,
      });
      const reviseVioEligible =
        status === "reopened" && Boolean(group.line.vendor_io_id);
      const ungenerateIoEligible = isLineUngenerateIoEligible({
        vendor_io_id: group.line.vendor_io_id,
        operational_status: status,
        invoice_id: group.line.invoice_id ?? null,
        billing_status: group.line.billing_status,
      });
      map.set(group.line.id, {
        vioEligible,
        invoiceEligible,
        reviseVioEligible,
        ungenerateIoEligible,
        remaining: group.rollups.remaining_value,
      });
    }
    return map;
  }, [groups]);

  const selectableLineIds = useMemo(() => {
    const ids: string[] = [];
    for (const [lineId, meta] of lineMeta) {
      if (
        meta.vioEligible ||
        meta.invoiceEligible ||
        meta.reviseVioEligible ||
        meta.ungenerateIoEligible
      ) {
        ids.push(lineId);
      }
    }
    return ids;
  }, [lineMeta]);

  const toggleLine = useCallback((lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const toggleParentSelect = useCallback(
    (lineId: string) => {
      const meta = lineMeta.get(lineId);
      if (
        !meta?.vioEligible &&
        !meta?.invoiceEligible &&
        !meta?.reviseVioEligible &&
        !meta?.ungenerateIoEligible
      ) {
        return;
      }
      toggleLine(lineId);
    },
    [lineMeta, toggleLine]
  );

  const vioLineIds = useMemo(
    () =>
      [...selectedLineIds].filter((id) => lineMeta.get(id)?.vioEligible),
    [selectedLineIds, lineMeta]
  );

  const invoiceLineIds = useMemo(
    () =>
      [...selectedLineIds].filter((id) => lineMeta.get(id)?.invoiceEligible),
    [selectedLineIds, lineMeta]
  );

  const ungenerateIoLineIds = useMemo(
    () =>
      [...selectedLineIds].filter((id) => lineMeta.get(id)?.ungenerateIoEligible),
    [selectedLineIds, lineMeta]
  );

  const reviseVioLineIds = useMemo(
    () =>
      [...selectedLineIds].filter((id) => lineMeta.get(id)?.reviseVioEligible),
    [selectedLineIds, lineMeta]
  );

  const invoiceTotal = useMemo(() => {
    let total = 0;
    for (const id of invoiceLineIds) {
      total += lineMeta.get(id)?.remaining ?? 0;
    }
    return total;
  }, [invoiceLineIds, lineMeta]);

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
    <div ref={tableRef} className={cn(OPERATIONAL_TABLE_FONT)}>
      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            <CampaignOperationalTableHead className="w-8">{HIERARCHY_COLUMN_LABELS.expand}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="w-8">{HIERARCHY_COLUMN_LABELS.select}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="min-w-[140px]">
              {HIERARCHY_COLUMN_LABELS.assignment}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.creator}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.platforms}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">
              {HIERARCHY_COLUMN_LABELS.deliverables}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.postingDates}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.opsStatus}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.billing}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right tabular-nums">
              {HIERARCHY_COLUMN_LABELS.revenue}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right tabular-nums">
              {HIERARCHY_COLUMN_LABELS.costReceived}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-center">
              {HIERARCHY_COLUMN_LABELS.costCurrency}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right tabular-nums">
              {HIERARCHY_COLUMN_LABELS.costInLc}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right tabular-nums">
              {HIERARCHY_COLUMN_LABELS.gp}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right tabular-nums">
              {HIERARCHY_COLUMN_LABELS.margin}
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.payout}</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="w-10 text-right">
              {HIERARCHY_COLUMN_LABELS.actions}
            </CampaignOperationalTableHead>
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
        <CampaignOperationalTableBody>
          {groups.map((group, index) => {
            const lineId = group.line.id;
            const expanded = expandedIds.has(lineId);
            const meta = lineMeta.get(lineId);
            const canSelect = Boolean(
              meta?.vioEligible || meta?.invoiceEligible || meta?.ungenerateIoEligible
            );
            const parentSelected = selectedLineIds.has(lineId);

            return (
              <Fragment key={lineId}>
                <AssignmentParentRow
                  group={group}
                  currency={currency}
                  expanded={expanded}
                  onToggleExpand={() => {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(lineId)) next.delete(lineId);
                      else next.add(lineId);
                      return next;
                    });
                  }}
                  onEdit={onEditLine}
                  parentSelected={parentSelected}
                  parentIndeterminate={false}
                  onToggleParentSelect={() => toggleParentSelect(lineId)}
                  showSelection={canSelect}
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
                    selectedIds={new Set()}
                    onToggleDeliverable={() => {}}
                    showSelection={false}
                    parentColSpan={PARENT_COLUMN_COUNT}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>

      <AssignmentOperationalActionsFooter
        campaignId={campaignId}
        currency={currency}
        selectedLineIds={[...selectedLineIds]}
        vioLineIds={vioLineIds}
        reviseVioLineIds={reviseVioLineIds}
        ungenerateIoLineIds={ungenerateIoLineIds}
        invoiceLineIds={invoiceLineIds}
        invoiceTotal={invoiceTotal}
        onGenerateInvoice={(lineIds) => onInvoiceLines?.(lineIds)}
        className="rounded-none border-x-0 border-b-0 border-t border-border/50"
      />
    </div>
  );
}
