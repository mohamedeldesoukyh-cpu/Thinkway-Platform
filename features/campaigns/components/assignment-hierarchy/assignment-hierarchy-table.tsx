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

import { ClientOnly } from "@/components/ui/client-only";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { AssignmentDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-deliverable-rows";
import { AssignmentMinimalRow } from "@/features/campaigns/components/assignment-hierarchy/assignment-minimal-row";
import { AssignmentParentRow } from "@/features/campaigns/components/assignment-hierarchy/assignment-parent-row";
import { AssignmentRowErrorBoundary } from "@/features/campaigns/components/assignment-hierarchy/assignment-row-error-boundary";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import dynamic from "next/dynamic";

const AssignmentOperationalActionsFooter = dynamic(
  () =>
    import("@/features/campaigns/components/assignment-operational-actions-footer").then(
      (m) => m.AssignmentOperationalActionsFooter
    ),
  { ssr: false }
);
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import {
  assignmentsLayerAtLeast,
  assignmentsLayerLabel,
  getAssignmentsUiLayer,
} from "@/lib/campaigns/assignments-ui-layer";
import {
  tryBuildAssignmentRowViewModel,
  type AssignmentRowViewModel,
} from "@/lib/campaigns/assignment-row-view-model";
import { sanitizeAssignmentHierarchy } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import { resolveAssignmentLineCurrency } from "@/lib/campaigns/assignment-line-currency";
import { resolveSelectionActions } from "@/lib/billing/selection-action-engine";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { cn } from "@/lib/utils";

const PARENT_COLUMN_COUNT = 18;

type AssignmentHierarchyTableProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceLines?: (lineIds: string[]) => void;
};

/** @deprecated Prefer AssignmentSafeGrid — heavy table crashes some production bundles. */
export function AssignmentHierarchyTable({
  campaignId,
  hierarchy,
  onEditLine,
  onInvoiceLines,
}: AssignmentHierarchyTableProps) {
  logAssignmentsStage("table render start", {
    campaignId,
    rawGroups: hierarchy.groups?.length ?? 0,
  });

  const uiLayer = getAssignmentsUiLayer();
  const enableExpansion = assignmentsLayerAtLeast(uiLayer, "expansion");
  const enableBillingPills = assignmentsLayerAtLeast(uiLayer, "billing_pills");
  const enableOperationalActions = assignmentsLayerAtLeast(uiLayer, "operational_actions");
  const isMinimal = uiLayer === "minimal";

  const sanitized = useMemo(
    () => sanitizeAssignmentHierarchy(hierarchy, { campaignId }),
    [hierarchy, campaignId]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const preparedRows = useMemo(() => {
    const rows: AssignmentRowViewModel[] = [];
    for (const group of sanitized.groups) {
      const vm = tryBuildAssignmentRowViewModel(group, {
        campaignId,
        billingContext: sanitized.billing_context,
      });
      if (vm) rows.push(vm);
    }
    return rows;
  }, [sanitized.groups, sanitized.billing_context, campaignId]);

  const lineMeta = useMemo(() => {
    const map = new Map<string, AssignmentRowViewModel["meta"]>();
    for (const row of preparedRows) {
      map.set(row.lineId, row.meta);
    }
    return map;
  }, [preparedRows]);

  const selectableLineIds = useMemo(() => {
    if (!enableOperationalActions) return [];
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
  }, [lineMeta, enableOperationalActions]);

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
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.vioEligible),
    [selectedLineIds, lineMeta]
  );

  const { invoiceLineIds } = useMemo(
    () =>
      resolveSelectionActions({
        selectedLineIds,
        selectedDeliverableIds: [],
        preparedRows: preparedRows.map((row) => ({
          lineId: row.lineId,
          group: row.group,
          meta: lineMeta.get(row.lineId),
        })),
        billingContext: sanitized.billing_context,
      }),
    [selectedLineIds, preparedRows, lineMeta, sanitized.billing_context]
  );

  const ungenerateIoLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.ungenerateIoEligible),
    [selectedLineIds, lineMeta]
  );

  const reviseVioLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.reviseVioEligible),
    [selectedLineIds, lineMeta]
  );

  const invoiceTotal = useMemo(() => {
    let total = 0;
    for (const id of invoiceLineIds) {
      total += lineMeta.get(id)?.remaining ?? 0;
    }
    return total;
  }, [invoiceLineIds, lineMeta]);

  const footerCurrency = useMemo(() => {
    const lineIds =
      invoiceLineIds.length > 0 ? invoiceLineIds : [...selectedLineIds];
    if (lineIds.length === 0) return null;
    const firstLine = preparedRows.find((r) => r.lineId === lineIds[0])?.group.line;
    return firstLine ? resolveAssignmentLineCurrency(firstLine) : null;
  }, [invoiceLineIds, selectedLineIds, preparedRows]);

  useEffect(() => {
    if (!enableExpansion) return;

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
        const row = preparedRows[focusedIndex];
        if (row) {
          setExpandedIds((prev) => new Set(prev).add(row.lineId));
          event.preventDefault();
        }
      } else if (event.key === "ArrowLeft") {
        const row = preparedRows[focusedIndex];
        if (row) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(row.lineId);
            return next;
          });
          event.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown as EventListener);
    return () => window.removeEventListener("keydown", onKeyDown as EventListener);
  }, [focusedIndex, preparedRows, enableExpansion]);

  const skippedCount = sanitized.skipped_line_ids.length;
  const sanitizeWarning =
    sanitized.sanitize_warnings.length > 0
      ? sanitized.sanitize_warnings.slice(0, 3).join(" ")
      : null;

  if (preparedRows.length === 0) {
    if (sanitized.load_error) {
      return (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
          Assignment data could not be loaded: {sanitized.load_error}
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        No creator assignments yet. Search for an influencer to build the first assignment
        package.
      </p>
    );
  }

  return (
    <div ref={tableRef} className={cn(OPERATIONAL_TABLE_FONT)}>
      <p className="border-b border-border/40 bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        Assignments UI layer: <span className="font-medium">{assignmentsLayerLabel(uiLayer)}</span>
        {skippedCount > 0 ? ` · ${skippedCount} row(s) skipped (data sanitize)` : null}
      </p>

      {sanitizeWarning ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-900 dark:text-amber-200">
          {sanitizeWarning}
        </p>
      ) : null}

      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            {isMinimal ? (
              <>
                <CampaignOperationalTableHead className="min-w-[160px]">
                  Assignment
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Creator</CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="text-right">Revenue</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Ops status</CampaignOperationalTableHead>
              </>
            ) : (
              <>
                {enableExpansion ? (
                  <CampaignOperationalTableHead className="w-8">
                    {HIERARCHY_COLUMN_LABELS.expand}
                  </CampaignOperationalTableHead>
                ) : null}
                {enableOperationalActions ? (
                  <CampaignOperationalTableHead className="w-8">
                    {HIERARCHY_COLUMN_LABELS.select}
                  </CampaignOperationalTableHead>
                ) : null}
                <CampaignOperationalTableHead className="min-w-[140px]">
                  {HIERARCHY_COLUMN_LABELS.assignment}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.creator}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.platforms}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>
                  {HIERARCHY_COLUMN_LABELS.deliverables}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.postingDates}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>
                  {HIERARCHY_COLUMN_LABELS.costCurrency}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.revenue}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.usageRights}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.agencyFeePercent}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.agencyFee}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.cost}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.vat}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.totalBilling}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.gp}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="tabular-nums">
                  {HIERARCHY_COLUMN_LABELS.margin}
                </CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.opsStatus}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.billing}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>{HIERARCHY_COLUMN_LABELS.payout}</CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="w-10 text-right">
                  {HIERARCHY_COLUMN_LABELS.actions}
                </CampaignOperationalTableHead>
              </>
            )}
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
        <CampaignOperationalTableBody>
          {preparedRows.map((row, index) => {
            const lineId = row.lineId;
            const expanded = enableExpansion && expandedIds.has(lineId);
            const meta = row.meta;
            const parentSelected = selectedLineIds.has(lineId);
            const deliverables = Array.isArray(row.group.deliverables)
              ? row.group.deliverables
              : [];
            const lineCurrency = resolveAssignmentLineCurrency(row.group.line);
            const colSpan = isMinimal ? 4 : PARENT_COLUMN_COUNT;

            return (
              <AssignmentRowErrorBoundary key={lineId} lineId={lineId} colSpan={colSpan}>
                {isMinimal ? (
                  <AssignmentMinimalRow viewModel={row} />
                ) : (
                  <Fragment>
                    <AssignmentParentRow
                      group={row.group}
                      viewModel={row}
                      currency={lineCurrency}
                      expanded={expanded}
                      enableExpansion={enableExpansion}
                      enableBillingPills={enableBillingPills}
                      enableSelection={enableOperationalActions}
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
                      rowSelectable={meta.rowSelectable}
                      rowIndex={index}
                      focused={focusedIndex === index}
                      onFocus={() => setFocusedIndex(index)}
                    />
                    {expanded ? (
                      <AssignmentDeliverableRows
                        campaignId={campaignId}
                        line={row.group.line}
                        deliverables={deliverables}
                        currency={lineCurrency}
                        selectedIds={new Set()}
                        onToggleDeliverable={() => {}}
                        showSelection={false}
                        parentColSpan={PARENT_COLUMN_COUNT}
                        showExpandColumn={enableExpansion}
                      />
                    ) : null}
                  </Fragment>
                )}
              </AssignmentRowErrorBoundary>
            );
          })}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>

      {enableOperationalActions && selectableLineIds.length === 0 ? (
        <p className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
          No lines are eligible for Vendor IO or invoicing. Assign a creator first, ensure the line
          has no Vendor IO yet (see Ops status / IO #), or use the Vendor IO tab to un-generate an
          existing IO before regenerating.
        </p>
      ) : null}

      {enableOperationalActions ? (
        <ClientOnly>
          <AssignmentOperationalActionsFooter
            campaignId={campaignId}
            currency={footerCurrency ?? "USD"}
            selectedLineIds={[...selectedLineIds]}
            vioLineIds={vioLineIds}
            reviseVioLineIds={reviseVioLineIds}
            ungenerateIoLineIds={ungenerateIoLineIds}
            invoiceLineIds={invoiceLineIds}
            invoiceTotal={invoiceTotal}
            onGenerateInvoice={(lineIds) => onInvoiceLines?.(lineIds)}
            className="rounded-none border-x-0 border-b-0 border-t border-border/50"
          />
        </ClientOnly>
      ) : null}
    </div>
  );
}
