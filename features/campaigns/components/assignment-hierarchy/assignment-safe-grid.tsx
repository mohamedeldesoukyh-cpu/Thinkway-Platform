"use client";

import { PencilIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentSafeActionsFooter } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-actions-footer";
import { AssignmentSafeDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-deliverable-rows";
import { HierarchyBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import {
  getAssignmentsRenderStage,
  type AssignmentsRenderStage,
} from "@/lib/campaigns/assignments-render-stage";
import {
  logAssignmentHierarchyRows,
  logPreparedAssignmentRows,
  validateAssignmentHierarchyClient,
} from "@/lib/campaigns/assignment-row-debug";
import {
  plainLinesFromHierarchy,
  type PlainAssignmentLine,
} from "@/lib/campaigns/assignments-plain-lines";
import { resolveAssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import {
  tryBuildAssignmentRowViewModel,
  type AssignmentRowViewModel,
} from "@/lib/campaigns/assignment-row-view-model";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { effectiveLineOperationalStatusForUi } from "@/lib/campaigns/effective-operational-status";
import { sanitizeAssignmentHierarchy } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import { formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type AssignmentSafeGridProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onInvoiceLines?: (lineIds: string[]) => void;
  renderStage?: AssignmentsRenderStage;
};

const PARENT_COL_SPAN = 13;

const thClass =
  "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
const tdClass = "px-2 py-1.5 text-[11px] border-b border-border/25";

function renderPlainCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return "—";
  return String(value);
}

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

function plainUiStatus(line: PlainAssignmentLine): CampaignLineOperationalStatus {
  return effectiveLineOperationalStatusForUi({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: line.billing_status,
    invoice_id: line.invoice_id,
  });
}

type MinimalRowProps = {
  line: PlainAssignmentLine;
  enableRowStyling: boolean;
  enablePills: boolean;
  showExtraColumns: boolean;
};

function MinimalRow({ line, enableRowStyling, enablePills, showExtraColumns }: MinimalRowProps) {
  const uiStatus = plainUiStatus(line);
  const rowClass = enableRowStyling
    ? (LINE_OPERATIONAL_ROW_CLASS[uiStatus] ?? LINE_OPERATIONAL_ROW_CLASS.draft)
    : "hover:bg-muted/20";

  return (
    <tr className={cn("border-b border-border/25", rowClass)} data-line-id={line.line_id}>
      <td className={tdClass} />
      <td className={tdClass}>
        <span className="font-medium">{renderPlainCell(line.name)}</span>
        <p className="text-[10px] text-muted-foreground">
          {renderPlainCell(line.document_number)}
        </p>
      </td>
      <td className={tdClass}>{renderPlainCell(line.influencer)}</td>
      {showExtraColumns ? (
        <>
          <td className={tdClass}>—</td>
          <td className={cn(tdClass, "text-right tabular-nums")}>{line.deliverables}</td>
          <td className={tdClass}>—</td>
        </>
      ) : null}
      <td className={tdClass}>
        {enablePills ? (
          <AssignmentOperationalStatusBadge status={uiStatus} />
        ) : (
          renderPlainCell(line.operational_status)
        )}
      </td>
      <td className={tdClass}>
        {enablePills ? (
          <HierarchyBillingStatusBadge
            operationalStatus={uiStatus}
            billingStatus={
              uiStatus === "invoiced"
                ? "invoiced"
                : uiStatus === "partially_invoiced"
                  ? "partially_invoiced"
                  : uiStatus === "reopened" ||
                      uiStatus === "io_generated" ||
                      uiStatus === "moved_to_billing"
                    ? "ready_to_invoice"
                    : "draft"
            }
          />
        ) : (
          renderPlainCell(line.billing_status)
        )}
      </td>
      <td className={cn(tdClass, "text-right tabular-nums")}>{renderPlainCell(line.revenue)}</td>
      {showExtraColumns ? (
        <>
          <td className={cn(tdClass, "text-right tabular-nums")}>—</td>
          <td className={cn(tdClass, "text-right tabular-nums")}>—</td>
        </>
      ) : null}
      <td className={tdClass} />
    </tr>
  );
}

export function AssignmentSafeGrid({
  campaignId,
  hierarchy,
  onEditLine,
  onInvoiceLines,
  renderStage: renderStageProp,
}: AssignmentSafeGridProps) {
  const renderStage = renderStageProp ?? getAssignmentsRenderStage();
  const gates = resolveAssignmentsGridGates(renderStage);

  logAssignmentsStage("safe grid render start", {
    campaignId,
    renderStage,
    groups: hierarchy.groups?.length ?? 0,
    gates,
  });

  const plainLines = useMemo(
    () => plainLinesFromHierarchy(hierarchy, { campaignId }),
    [hierarchy, campaignId]
  );

  const sanitized = useMemo(
    () => (gates.usePreparedData ? sanitizeAssignmentHierarchy(hierarchy, { campaignId }) : null),
    [hierarchy, campaignId, gates.usePreparedData]
  );

  useEffect(() => {
    logAssignmentHierarchyRows(hierarchy, {
      campaignId,
      layer: `safe-grid:${renderStage}`,
    });
    validateAssignmentHierarchyClient(hierarchy);
  }, [hierarchy, campaignId, renderStage]);

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const preparedRows = useMemo(() => {
    if (!gates.usePreparedData || !sanitized) return [];
    const rows: AssignmentRowViewModel[] = [];
    for (const group of sanitized.groups) {
      const vm = tryBuildAssignmentRowViewModel(group, { campaignId });
      if (vm) rows.push(vm);
    }
    return rows;
  }, [sanitized, campaignId, gates.usePreparedData]);

  useEffect(() => {
    if (preparedRows.length > 0) {
      logPreparedAssignmentRows(preparedRows, {
        campaignId,
        layer: `safe-grid:${renderStage}`,
      });
    }
  }, [preparedRows, campaignId, renderStage]);

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

  const usePlainRowsOnly = !gates.usePreparedData;
  const displayCount = usePlainRowsOnly ? plainLines.length : preparedRows.length;

  if (displayCount === 0) {
    return (
      <p className="px-3 py-6 text-sm text-muted-foreground">
        {hierarchy.load_error
          ? `Assignment data could not be loaded: ${hierarchy.load_error}`
          : "No creator assignments yet."}
      </p>
    );
  }

  const currency = sanitized?.currency_code ?? hierarchy.currency_code;
  const showPreparedColumns = gates.usePreparedData;

  return (
    <div className={cn(OPERATIONAL_TABLE_FONT, "overflow-x-auto")}>
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80">
          <tr>
            {gates.enableExpansion ? <th className={cn(thClass, "w-8")} /> : null}
            <th className={cn(thClass, "w-8")} />
            <th className={cn(thClass, "min-w-[140px]")}>Assignment</th>
            <th className={thClass}>Creator</th>
            {showPreparedColumns ? (
              <>
                <th className={thClass}>Platforms</th>
                <th className={cn(thClass, "text-right")}>Deliv.</th>
                <th className={thClass}>Dates</th>
              </>
            ) : null}
            <th className={thClass}>Ops</th>
            <th className={thClass}>Billing</th>
            <th className={cn(thClass, "text-right")}>Revenue</th>
            {showPreparedColumns ? (
              <>
                <th className={cn(thClass, "text-right")}>GP</th>
                <th className={cn(thClass, "text-right")}>Margin</th>
              </>
            ) : null}
            <th className={cn(thClass, "w-10")} />
          </tr>
        </thead>
        <tbody>
          {usePlainRowsOnly
            ? plainLines.map((line) =>
                tryRenderRowCells(line.line_id, () => (
                  <MinimalRow
                    key={line.line_id}
                    line={line}
                    enableRowStyling={gates.enableRowStyling}
                    enablePills={gates.enablePills}
                    showExtraColumns={false}
                  />
                ))
              )
            : preparedRows.map((row) => {
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
                  : "hover:bg-muted/20";

                return (
                  <Fragment key={row.lineId}>
                    {tryRenderRowCells(row.lineId, () => (
                      <tr
                        className={cn("border-b border-border/25", rowClass, expanded && "shadow-sm")}
                        data-line-id={row.lineId}
                      >
                        {gates.enableExpansion ? (
                          <td className={tdClass}>
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
                        <td className={tdClass}>
                          {selectable ? (
                            <input
                              type="checkbox"
                              className="size-3.5 rounded border-border"
                              checked={selectedLineIds.has(row.lineId)}
                              onChange={() => toggleLine(row.lineId, selectable)}
                            />
                          ) : null}
                        </td>
                        <td className={tdClass}>
                          <span className="font-medium">{row.displayName}</span>
                          <p className="text-[10px] text-muted-foreground">
                            <DocumentNumber value={line.document_number} />
                          </p>
                        </td>
                        <td className={tdClass}>{line.influencer_name ?? "—"}</td>
                        <td className={tdClass}>{row.platformSummary}</td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>
                          {row.rollups.deliverable_count}
                        </td>
                        <td className={tdClass}>{row.postingSummary}</td>
                        <td className={tdClass}>
                          {gates.enablePills ? (
                            <AssignmentOperationalStatusBadge status={row.operationalStatus} />
                          ) : (
                            row.opsStatusLabel
                          )}
                        </td>
                        <td className={tdClass}>
                          {gates.enablePills ? (
                            <HierarchyBillingStatusBadge
                              operationalStatus={row.operationalStatus}
                              billingStatus={row.childBillingStatus}
                            />
                          ) : (
                            renderPlainCell(line.billing_status)
                          )}
                        </td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>
                          {formatOperationalAmount(row.rollups.revenue)}
                        </td>
                        <td className={cn(tdClass, "text-right tabular-nums")}>
                          {formatOperationalAmount(row.rollups.gp)}
                        </td>
                        <td className={cn(tdClass, "text-right tabular-nums text-muted-foreground")}>
                          {formatPercent(row.rollups.margin_percent)}
                        </td>
                        <td className={cn(tdClass, "text-right")}>
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

      {gates.enableFooter ? (
        <AssignmentSafeActionsFooter
          campaignId={campaignId}
          currency={currency}
          selectedLineIds={[...selectedLineIds]}
          vioLineIds={vioLineIds}
          reviseVioLineIds={reviseVioLineIds}
          ungenerateIoLineIds={ungenerateIoLineIds}
          invoiceLineIds={invoiceLineIds}
          invoiceTotal={invoiceTotal}
          onGenerateInvoice={(lineIds) => onInvoiceLines?.(lineIds)}
          className="mt-2 border-t border-border/50"
        />
      ) : null}
    </div>
  );
}
