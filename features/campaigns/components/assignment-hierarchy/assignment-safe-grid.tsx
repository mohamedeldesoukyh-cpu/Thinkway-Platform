"use client";

import { PencilIcon, UserIcon } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentsEmptyState } from "@/features/campaigns/components/assignments-empty-state";
import { AssignmentSafeActionsFooter } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-actions-footer";
import { AssignmentSafeDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-deliverable-rows";
import {
  ASSIGNMENT_SAFE_GRID_COL_SPAN,
  SAFE_GRID_AMOUNT,
  SAFE_GRID_CHECKBOX,
  SAFE_GRID_CONTROL_CELL,
  SAFE_GRID_PARENT_ROW,
  SAFE_GRID_PARENT_ROW_EXPANDED,
  SAFE_GRID_SHELL,
  SAFE_GRID_TABLE,
  SAFE_GRID_TD,
  SAFE_GRID_TH,
  SAFE_GRID_HEAD,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid-styles";
import { HierarchyBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import {
  assignmentHierarchyBoundaryKey,
  logAssignmentHierarchyRows,
  logPreparedAssignmentRows,
  logRevisionHierarchyKeys,
  validateAssignmentHierarchyClient,
} from "@/lib/campaigns/assignment-row-debug";
import { resolveAssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import {
  tryBuildAssignmentRowViewModel,
  type AssignmentRowViewModel,
} from "@/lib/campaigns/assignment-row-view-model";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { sanitizeAssignmentHierarchy } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import { formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentSafeGridProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  campaignPoExceeded?: boolean;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceLines?: (lineIds: string[]) => void;
  onCreateAssignment?: () => void;
};

const PARENT_COL_SPAN = ASSIGNMENT_SAFE_GRID_COL_SPAN;

function tryRenderRowCells(lineId: string, render: () => ReactNode): ReactNode {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[Assignments] RENDER ROW", lineId);
    }
    return render();
  } catch (error) {
    console.error("[Assignments] ROW CRASH", lineId, error);
    return (
      <tr key={`fail-${lineId}`} className="bg-destructive/10">
        <td colSpan={PARENT_COL_SPAN} className="px-2 py-2 text-xs text-destructive">
          ROW FAILED {lineId}
        </td>
      </tr>
    );
  }
}

export function AssignmentSafeGrid({
  campaignId,
  hierarchy,
  campaignPoExceeded = false,
  onEditLine,
  onInvoiceLines,
  onCreateAssignment,
}: AssignmentSafeGridProps) {
  const gates = resolveAssignmentsGridGates();

  logAssignmentsStage("safe grid render start", {
    campaignId,
    groups: hierarchy.groups?.length ?? 0,
  });

  const sanitized = useMemo(
    () => sanitizeAssignmentHierarchy(hierarchy, { campaignId }),
    [hierarchy, campaignId]
  );

  useEffect(() => {
    logAssignmentHierarchyRows(hierarchy, {
      campaignId,
      layer: "safe-grid",
    });
    validateAssignmentHierarchyClient(hierarchy);
  }, [hierarchy, campaignId]);

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const hierarchySignature = useMemo(
    () => assignmentHierarchyBoundaryKey(hierarchy),
    [hierarchy]
  );

  const resetOperationalUiState = useCallback(() => {
    setSelectedLineIds(new Set());
    setExpandedIds(new Set());
  }, []);

  useEffect(() => {
    resetOperationalUiState();
    logRevisionHierarchyKeys(hierarchy, { campaignId });
  }, [hierarchySignature, hierarchy, campaignId, resetOperationalUiState]);

  const preparedRows = useMemo(() => {
    const rows: AssignmentRowViewModel[] = [];
    for (const group of sanitized.groups) {
      const vm = tryBuildAssignmentRowViewModel(group, { campaignId });
      if (vm) rows.push(vm);
    }
    return rows;
  }, [sanitized, campaignId]);

  useEffect(() => {
    if (preparedRows.length > 0) {
      logPreparedAssignmentRows(preparedRows, {
        campaignId,
        layer: "safe-grid",
      });
    }
  }, [preparedRows, campaignId]);

  const toggleLine = useCallback((lineId: string, selectable: boolean) => {
    if (!selectable) return;
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const lineMeta = useMemo(() => {
    const map = new Map<string, AssignmentRowViewModel["meta"]>();
    for (const row of preparedRows) {
      map.set(row.lineId, row.meta);
    }
    return map;
  }, [preparedRows]);

  const vioLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.vioEligible),
    [selectedLineIds, lineMeta]
  );
  const invoiceLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.invoiceEligible),
    [selectedLineIds, lineMeta]
  );
  const reviseVioLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.reviseVioEligible),
    [selectedLineIds, lineMeta]
  );
  const ungenerateIoLineIds = useMemo(
    () => [...selectedLineIds].filter((id) => lineMeta.get(id)?.ungenerateIoEligible),
    [selectedLineIds, lineMeta]
  );

  const invoiceTotal = useMemo(() => {
    let total = 0;
    for (const id of invoiceLineIds) {
      total += lineMeta.get(id)?.remaining ?? 0;
    }
    return total;
  }, [invoiceLineIds, lineMeta]);

  const selectableLineIds = useMemo(
    () => preparedRows.filter((r) => r.meta.rowSelectable).map((r) => r.lineId),
    [preparedRows]
  );

  const allSelectableSelected =
    selectableLineIds.length > 0 &&
    selectableLineIds.every((id) => selectedLineIds.has(id));
  const someSelectableSelected = selectableLineIds.some((id) => selectedLineIds.has(id));
  const headerSelectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate =
        someSelectableSelected && !allSelectableSelected;
    }
  }, [someSelectableSelected, allSelectableSelected]);

  const selectAllLines = useCallback(() => {
    setSelectedLineIds(new Set(selectableLineIds));
  }, [selectableLineIds]);

  const clearSelection = useCallback(() => {
    setSelectedLineIds(new Set());
  }, []);

  if (preparedRows.length === 0) {
    if (hierarchy.load_error) {
      return (
        <p className="px-3 py-6 text-sm text-destructive">
          Assignment data could not be loaded: {hierarchy.load_error}
        </p>
      );
    }
    return <AssignmentsEmptyState onCreateAssignment={onCreateAssignment} />;
  }

  const currency = sanitized.currency_code ?? hierarchy.currency_code;

  return (
    <div className={cn(OPERATIONAL_TABLE_FONT, "space-y-2")}>
      <div className={cn(SAFE_GRID_SHELL, "overflow-x-auto")}>
        <table className={SAFE_GRID_TABLE}>
          <thead className={SAFE_GRID_HEAD}>
            <tr>
              {gates.enableExpansion ? (
                <th className={cn(SAFE_GRID_TH, "w-9")}>{HIERARCHY_COLUMN_LABELS.expand}</th>
              ) : null}
              <th className={cn(SAFE_GRID_TH, SAFE_GRID_CONTROL_CELL)}>
                {gates.enableCheckboxes ? (
                  <input
                    ref={headerSelectRef}
                    type="checkbox"
                    className={SAFE_GRID_CHECKBOX}
                    checked={allSelectableSelected}
                    disabled={selectableLineIds.length === 0}
                    onChange={() => {
                      if (allSelectableSelected) clearSelection();
                      else selectAllLines();
                    }}
                    aria-label="Select all assignments"
                  />
                ) : null}
              </th>
              <th className={cn(SAFE_GRID_TH, "min-w-[140px]")}>
                {HIERARCHY_COLUMN_LABELS.assignment}
              </th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.creator}</th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.platforms}</th>
              <th className={cn(SAFE_GRID_TH, "text-right")}>
                {HIERARCHY_COLUMN_LABELS.deliverables}
              </th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.postingDates}</th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.opsStatus}</th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.billing}</th>
              <th className={cn(SAFE_GRID_TH, "text-right tabular-nums")}>
                {HIERARCHY_COLUMN_LABELS.revenue}
              </th>
              <th className={cn(SAFE_GRID_TH, "text-right tabular-nums")}>
                {HIERARCHY_COLUMN_LABELS.costReceived}
              </th>
              <th className={cn(SAFE_GRID_TH, "text-center")}>
                {HIERARCHY_COLUMN_LABELS.costCurrency}
              </th>
              <th className={cn(SAFE_GRID_TH, "text-right tabular-nums")}>
                {HIERARCHY_COLUMN_LABELS.costInLc}
              </th>
              <th className={cn(SAFE_GRID_TH, "text-right tabular-nums")}>
                {HIERARCHY_COLUMN_LABELS.gp}
              </th>
              <th className={cn(SAFE_GRID_TH, "text-right tabular-nums")}>
                {HIERARCHY_COLUMN_LABELS.margin}
              </th>
              <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.payout}</th>
              <th className={cn(SAFE_GRID_TH, "w-10")} />
            </tr>
          </thead>
        <tbody>
          {preparedRows.map((row) => {
            const line = row.group.line;
            const expanded = gates.enableExpansion && expandedIds.has(row.lineId);
            const meta = row.meta;
            const selectable = gates.enableCheckboxes && meta.rowSelectable;
            const deliverables = Array.isArray(row.group.deliverables)
              ? row.group.deliverables
              : [];
            const rowClass = gates.enableRowStyling
              ? (LINE_OPERATIONAL_ROW_CLASS[row.operationalStatus] ??
                LINE_OPERATIONAL_ROW_CLASS.draft)
              : "";

            return (
              <Fragment key={row.lineId}>
                    {tryRenderRowCells(row.lineId, () => (
                      <tr
                        className={cn(
                          SAFE_GRID_PARENT_ROW,
                          rowClass,
                          expanded && SAFE_GRID_PARENT_ROW_EXPANDED
                        )}
                        data-line-id={row.lineId}
                      >
                        {gates.enableExpansion ? (
                          <td className={SAFE_GRID_CONTROL_CELL}>
                            <AssignmentExpandToggle
                              expanded={expanded}
                              onToggle={() => {
                                setExpandedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.lineId)) next.delete(row.lineId);
                                  else next.add(row.lineId);
                                  return next;
                                });
                              }}
                              ariaLabel={`${expanded ? "Collapse" : "Expand"} ${row.displayName}`}
                            />
                          </td>
                        ) : null}
                        <td className={SAFE_GRID_CONTROL_CELL}>
                          {selectable ? (
                            <input
                              type="checkbox"
                              className={SAFE_GRID_CHECKBOX}
                              checked={selectedLineIds.has(row.lineId)}
                              onChange={() => toggleLine(row.lineId, selectable)}
                              aria-label={`Select ${row.displayName}`}
                            />
                          ) : null}
                        </td>
                        <td className={SAFE_GRID_TD}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">{row.displayName}</span>
                            {campaignPoExceeded || line.po_over_consumed ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/60 text-[10px] text-amber-800 dark:text-amber-200"
                              >
                                PO exceeded
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            <DocumentNumber value={line.document_number} />
                          </p>
                        </td>
                        <td className={SAFE_GRID_TD}>
                          {line.influencer_name ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <UserIcon className="size-3 shrink-0" />
                              <span>{line.influencer_name}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={SAFE_GRID_TD}>{row.platformSummary}</td>
                        <td className={cn(SAFE_GRID_TD, "text-right", SAFE_GRID_AMOUNT)}>
                          {row.rollups.deliverable_count}
                        </td>
                        <td
                          className={cn(SAFE_GRID_TD, "text-muted-foreground")}
                          suppressHydrationWarning
                        >
                          {row.postingSummary}
                        </td>
                        <td className={SAFE_GRID_TD}>
                          {gates.enablePills ? (
                            <>
                              <AssignmentOperationalStatusBadge status={row.operationalStatus} />
                              {line.vendor_io_document_number ? (
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  <DocumentNumber value={line.vendor_io_document_number} />
                                </p>
                              ) : null}
                            </>
                          ) : (
                            row.opsStatusLabel
                          )}
                        </td>
                        <td className={SAFE_GRID_TD}>
                          <HierarchyBillingStatusBadge
                            operationalStatus={row.operationalStatus}
                            billingStatus={row.childBillingStatus}
                          />
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-right", SAFE_GRID_AMOUNT)}>
                          {formatOperationalAmount(row.rollups.revenue)}
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-right", SAFE_GRID_AMOUNT)}>
                          {formatOperationalAmount(line.cost_received)}
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-center text-[10px] text-muted-foreground")}>
                          {line.cost_received_currency ?? "—"}
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-right", SAFE_GRID_AMOUNT)}>
                          {formatOperationalAmount(line.cost_before_vat)}
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-right", SAFE_GRID_AMOUNT)}>
                          {formatOperationalAmount(row.rollups.gp)}
                        </td>
                        <td
                          className={cn(
                            SAFE_GRID_TD,
                            "text-right",
                            SAFE_GRID_AMOUNT,
                            "text-muted-foreground"
                          )}
                        >
                          {formatPercent(row.rollups.margin_percent)}
                        </td>
                        <td className={SAFE_GRID_TD}>
                          {line.vendor_payment_status ? (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {VENDOR_PAYMENT_STATUS_LABELS[line.vendor_payment_status] ??
                                line.vendor_payment_status}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={cn(SAFE_GRID_TD, "text-right")}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => onEditLine(line)}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {expanded && gates.enableDeliverableChildren ? (
                      <AssignmentSafeDeliverableRows
                        campaignId={campaignId}
                        line={line}
                        deliverables={deliverables}
                        currency={currency}
                        parentColSpan={PARENT_COL_SPAN}
                      />
                    ) : null}
              </Fragment>
            );
          })}
          </tbody>
        </table>
      </div>

      {gates.enableFooter ? (
        <AssignmentSafeActionsFooter
          campaignId={campaignId}
          currency={currency}
          selectedLineIds={[...selectedLineIds]}
          selectableLineCount={selectableLineIds.length}
          onSelectAll={selectAllLines}
          onClearSelection={clearSelection}
          vioLineIds={vioLineIds}
          reviseVioLineIds={reviseVioLineIds}
          ungenerateIoLineIds={ungenerateIoLineIds}
          invoiceLineIds={invoiceLineIds}
          invoiceTotal={invoiceTotal}
          onGenerateInvoice={(lineIds) => onInvoiceLines?.(lineIds)}
          onAfterOperationalMutation={resetOperationalUiState}
        />
      ) : null}
    </div>
  );
}
