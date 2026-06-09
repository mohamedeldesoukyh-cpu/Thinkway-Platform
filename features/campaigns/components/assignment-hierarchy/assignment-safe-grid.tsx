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
import { resolveSelectionActions } from "@/lib/billing/selection-action-engine";
import {
  AssignmentSelectionSummaryBar,
  type AssignmentSelectionTotals,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-selection-summary-bar";
import { AssignmentSafeDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-deliverable-rows";
import {
  ASSIGNMENT_SAFE_GRID_COL_SPAN,
  SAFE_GRID_AMOUNT,
  SAFE_GRID_CHECKBOX,
  SAFE_GRID_CONTROL_CELL,
  SAFE_GRID_HIGHLIGHT_COST,
  SAFE_GRID_HIGHLIGHT_GP,
  SAFE_GRID_HIGHLIGHT_REV,
  SAFE_GRID_HIGHLIGHT_TOTAL_BILLING,
  SAFE_GRID_PARENT_ROW,
  SAFE_GRID_PARENT_ROW_EXPANDED,
  SAFE_GRID_SHELL,
  SAFE_GRID_TABLE,
  SAFE_GRID_TD,
  SAFE_GRID_TH,
  SAFE_GRID_HEAD,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid-styles";
import { LineBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import { ASSIGNMENT_GRID_MONEY_COL, ASSIGNMENT_GRID_VAT_COL } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentOperationalStatusBadge } from "@/features/campaigns/components/assignment-operational-status-badge";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { LINE_OPERATIONAL_ROW_CLASS } from "@/features/campaigns/constants/operational-status";
import type {
  AssignmentHierarchy,
  AssignmentHierarchyGroup,
} from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import {
  assignmentHierarchyBoundaryKey,
  logAssignmentHierarchyRows,
  logPreparedAssignmentRows,
  logRevisionHierarchyKeys,
  validateAssignmentHierarchyClient,
} from "@/lib/campaigns/assignment-row-debug";
import { useAssignmentAudienceView } from "@/features/campaigns/components/assignment-hierarchy/assignment-audience-view-context";
import { resolveAssignmentsGridGates } from "@/lib/campaigns/assignments-grid-gates";
import {
  tryBuildAssignmentRowViewModel,
  type AssignmentRowViewModel,
} from "@/lib/campaigns/assignment-row-view-model";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { sanitizeAssignmentHierarchy } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import {
  resolveAssignmentLineCurrency,
  resolveAssignmentLineCurrencyDisplay,
} from "@/lib/campaigns/assignment-line-currency";
import { formatPercent } from "@/features/campaigns/utils";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import {
  useIsOperationalColumnVisible,
  useOperationalVisibleColumnCount,
} from "@/components/tables/operational-table-column-context";
import { cn } from "@/lib/utils";

type AssignmentSafeGridProps = {
  campaignId: string;
  hierarchy: AssignmentHierarchy;
  campaignPoExceeded?: boolean;
  onEditLine: (line: CampaignLineWorkspace) => void;
  onOpenInfluencerDetail?: (
    group: AssignmentHierarchyGroup,
    row: AssignmentRowViewModel
  ) => void;
  onInvoiceLines?: (selection: OperationalSelectionPayload) => void;
  onCreateAssignment?: () => void;
};

function tryRenderRowCells(
  lineId: string,
  colSpan: number,
  render: () => ReactNode
): ReactNode {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[Assignments] RENDER ROW", lineId);
    }
    return render();
  } catch (error) {
    console.error("[Assignments] ROW CRASH", lineId, error);
    return (
      <tr key={`fail-${lineId}`} className="bg-destructive/10">
        <td colSpan={colSpan} className="px-2 py-2 text-xs text-destructive">
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
  onOpenInfluencerDetail,
  onInvoiceLines,
  onCreateAssignment,
}: AssignmentSafeGridProps) {
  const audienceView = useAssignmentAudienceView();
  const gates = resolveAssignmentsGridGates(audienceView);
  const col = useIsOperationalColumnVisible;
  const parentColSpan = useOperationalVisibleColumnCount();

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
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const hierarchySignature = useMemo(
    () => assignmentHierarchyBoundaryKey(hierarchy),
    [hierarchy]
  );

  const resetOperationalUiState = useCallback(() => {
    setSelectedLineIds(new Set());
    setSelectedDeliverableIds(new Set());
    setExpandedIds(new Set());
  }, []);

  useEffect(() => {
    if (audienceView === "client") {
      resetOperationalUiState();
    }
  }, [audienceView, resetOperationalUiState]);

  const prevCampaignIdRef = useRef(campaignId);

  useEffect(() => {
    if (prevCampaignIdRef.current !== campaignId) {
      resetOperationalUiState();
      prevCampaignIdRef.current = campaignId;
    }
    logRevisionHierarchyKeys(hierarchy, { campaignId });
  }, [hierarchySignature, hierarchy, campaignId, resetOperationalUiState]);

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

  const toggleDeliverable = useCallback((deliverableId: string, lineId: string) => {
    setSelectedDeliverableIds((prev) => {
      const next = new Set(prev);
      if (next.has(deliverableId)) next.delete(deliverableId);
      else next.add(deliverableId);
      return next;
    });
    setSelectedLineIds((prev) => {
      if (!prev.has(lineId)) return prev;
      const next = new Set(prev);
      next.delete(lineId);
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

  const selectionActions = useMemo(
    () =>
      resolveSelectionActions({
        selectedLineIds,
        selectedDeliverableIds,
        preparedRows: preparedRows.map((row) => ({
          lineId: row.lineId,
          group: row.group,
          meta: lineMeta.get(row.lineId),
        })),
        billingContext: sanitized.billing_context,
      }),
    [selectedLineIds, selectedDeliverableIds, preparedRows, lineMeta, sanitized.billing_context]
  );
  const {
    invoiceLineIds,
    invoiceDeliverableIds,
    hasInvoiceSelection,
    invoiceActionLabel,
    ioCoverage,
    vioLineIds,
    reviseVioLineIds,
    ungenerateIoLineIds,
  } = selectionActions;

  const invoiceTotal = useMemo(() => {
    const pendingRegeneration =
      sanitized.billing_context?.regeneration_status === "pending_regeneration";
    let total = 0;

    for (const id of invoiceLineIds) {
      const row = preparedRows.find((entry) => entry.lineId === id);
      if (!row) continue;
      if (pendingRegeneration) {
        const line = row.group.line;
        total +=
          Number(row.group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue) || 0;
        continue;
      }
      total += lineMeta.get(id)?.remaining ?? 0;
    }

    for (const row of preparedRows) {
      for (const deliverable of row.group.deliverables ?? []) {
        if (!invoiceDeliverableIds.includes(deliverable.id)) continue;
        total += pendingRegeneration
          ? Number(deliverable.revenue_before_vat ?? 0)
          : Number(deliverable.remaining_amount ?? 0);
      }
    }
    return total;
  }, [
    invoiceLineIds,
    invoiceDeliverableIds,
    lineMeta,
    preparedRows,
    sanitized.billing_context?.regeneration_status,
  ]);

  const emitInvoiceSelection = useCallback(() => {
    onInvoiceLines?.({
      line_ids: invoiceLineIds,
      deliverable_ids: invoiceDeliverableIds,
      post_ids: [],
    });
  }, [onInvoiceLines, invoiceLineIds, invoiceDeliverableIds]);

  const footerCurrency = useMemo(() => {
    const lineIds =
      invoiceLineIds.length > 0 ? invoiceLineIds : [...selectedLineIds];
    if (lineIds.length === 0) return null;
    const firstLine = preparedRows.find((r) => r.lineId === lineIds[0])?.group.line;
    return firstLine ? resolveAssignmentLineCurrency(firstLine) : null;
  }, [invoiceLineIds, selectedLineIds, preparedRows]);

  const selectionTotals = useMemo((): AssignmentSelectionTotals => {
    const currencies = new Set<string>();
    let revenue = 0;
    let cost = 0;
    let gp = 0;
    for (const id of selectedLineIds) {
      const row = preparedRows.find((r) => r.lineId === id);
      if (!row) continue;
      const line = row.group.line;
      revenue += Number(line.revenue_before_vat ?? line.revenue) || 0;
      cost += Number(line.cost_before_vat ?? line.cost) || 0;
      gp += Number(line.gp) || 0;
      currencies.add(resolveAssignmentLineCurrency(line));
    }
    return {
      count: selectedLineIds.size + selectedDeliverableIds.size,
      revenue,
      cost,
      gp,
      currency: currencies.size === 1 ? [...currencies][0]! : null,
      currencyMixed: currencies.size > 1,
    };
  }, [selectedLineIds, selectedDeliverableIds, preparedRows]);

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

  return (
    <div className={cn(OPERATIONAL_TABLE_FONT, "space-y-2")}>
      {audienceView === "client" ? (
        <div className="rounded-lg border border-[var(--brand-product)]/25 bg-[var(--brand-product)]/5 px-3 py-2 text-xs text-foreground">
          Client preview — showing campaign assignments as your client sees them. Internal
          cost, margin, vendor IO, billing controls, and deliverable editing are hidden.
        </div>
      ) : null}
      {gates.enableFooter ? (
        <AssignmentSelectionSummaryBar
          campaignId={campaignId}
          totals={selectionTotals}
          vioLineIds={vioLineIds}
          invoiceLineIds={invoiceLineIds}
          onGenerateInvoice={emitInvoiceSelection}
          hasInvoiceSelection={hasInvoiceSelection}
          invoiceActionLabel={invoiceActionLabel}
          ioCoverage={ioCoverage}
          onAfterOperationalMutation={resetOperationalUiState}
        />
      ) : null}
      <div className={cn(SAFE_GRID_SHELL, "overflow-x-auto")}>
        <table className={SAFE_GRID_TABLE} data-assignment-parent-grid>
          <thead className={SAFE_GRID_HEAD}>
            <tr>
              {gates.enableExpansion && col("expand") ? (
                <th className={cn(SAFE_GRID_TH, "w-9")}>{HIERARCHY_COLUMN_LABELS.expand}</th>
              ) : null}
              {col("select") ? (
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
              ) : null}
              {col("assignment") ? (
                <th className={cn(SAFE_GRID_TH, "min-w-[140px]")}>
                  {HIERARCHY_COLUMN_LABELS.assignment}
                </th>
              ) : null}
              {col("creator") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.creator}</th>
              ) : null}
              {col("platforms") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.platforms}</th>
              ) : null}
              {col("deliverables") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.deliverables}</th>
              ) : null}
              {col("postingDates") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.postingDates}</th>
              ) : null}
              {col("costCurrency") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.costCurrency}</th>
              ) : null}
              {col("revenue") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.revenue}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("cost") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.cost}
                </th>
              ) : null}
              {col("vat") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_VAT_COL)}>
                  {HIERARCHY_COLUMN_LABELS.vat}
                </th>
              ) : null}
              {col("totalBilling") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.totalBilling}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("gp") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.gp}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("margin") ? (
                <th className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.margin}
                </th>
              ) : null}
              {col("opsStatus") ? (
                <th className={SAFE_GRID_TH}>
                  {audienceView === "client" ? "Status" : HIERARCHY_COLUMN_LABELS.opsStatus}
                </th>
              ) : null}
              {gates.showInternalBilling && col("billing") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.billing}</th>
              ) : null}
              {gates.showInternalFinancials && col("payout") ? (
                <th className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.payout}</th>
              ) : null}
              {gates.enableEditActions && col("actions") ? (
                <th className={cn(SAFE_GRID_TH, "w-10")} />
              ) : null}
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
            const lineCurrency = resolveAssignmentLineCurrency(line);
            const rowClass = gates.enableRowStyling
              ? (LINE_OPERATIONAL_ROW_CLASS[row.operationalStatus] ??
                LINE_OPERATIONAL_ROW_CLASS.draft)
              : "";

            return (
              <Fragment key={row.lineId}>
                    {tryRenderRowCells(row.lineId, parentColSpan, () => (
                      <tr
                        className={cn(
                          SAFE_GRID_PARENT_ROW,
                          rowClass,
                          expanded && SAFE_GRID_PARENT_ROW_EXPANDED
                        )}
                        data-line-id={row.lineId}
                      >
                        {gates.enableExpansion && col("expand") ? (
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
                        {col("select") ? (
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
                        ) : null}
                        {col("assignment") ? (
                        <td className={SAFE_GRID_TD}>
                          <button
                            type="button"
                            onClick={() => onOpenInfluencerDetail?.(row.group, row)}
                            className="mx-auto block w-full text-center transition-colors hover:text-primary"
                            title={`View ${row.displayName} details`}
                          >
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <span className="font-medium text-foreground underline-offset-2 hover:underline">
                                {row.displayName}
                              </span>
                              {gates.showInternalFinancials &&
                              (campaignPoExceeded || line.po_over_consumed) ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/60 text-[10px] text-amber-800 dark:text-amber-200"
                                >
                                  PO exceeded
                                </Badge>
                              ) : null}
                            </div>
                            {gates.showLineDocumentNumber ? (
                              <p className="text-[10px] text-muted-foreground">
                                <DocumentNumber value={line.document_number} />
                              </p>
                            ) : null}
                          </button>
                        </td>
                        ) : null}
                        {col("creator") ? (
                        <td className={SAFE_GRID_TD}>
                          {line.influencer_name || row.displayName ? (
                            <button
                              type="button"
                              onClick={() => onOpenInfluencerDetail?.(row.group, row)}
                              className="mx-auto flex items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                              title={`View ${line.influencer_name ?? row.displayName} details`}
                            >
                              <UserIcon className="size-3 shrink-0" />
                              <span className="font-medium underline-offset-2 hover:underline">
                                {line.influencer_name ?? row.displayName}
                              </span>
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        ) : null}
                        {col("platforms") ? (
                          <td className={SAFE_GRID_TD}>{row.platformSummary}</td>
                        ) : null}
                        {col("deliverables") ? (
                          <td className={cn(SAFE_GRID_TD, SAFE_GRID_AMOUNT)}>
                            {row.rollups.deliverable_count}
                          </td>
                        ) : null}
                        {col("postingDates") ? (
                          <td
                            className={cn(SAFE_GRID_TD, "text-center text-muted-foreground")}
                            suppressHydrationWarning
                          >
                            {row.postingSummary}
                          </td>
                        ) : null}
                        {col("costCurrency") ? (
                          <td className={cn(SAFE_GRID_TD, "text-center text-[10px] font-medium text-foreground/80")}>
                            {resolveAssignmentLineCurrencyDisplay(line)}
                          </td>
                        ) : null}
                        {col("revenue") ? (
                          <td className={cn(SAFE_GRID_HIGHLIGHT_REV, ASSIGNMENT_GRID_MONEY_COL)}>
                            {formatOperationalAmount(row.rollups.revenue)}
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("cost") ? (
                          <td className={cn(SAFE_GRID_HIGHLIGHT_COST, ASSIGNMENT_GRID_MONEY_COL)}>
                            {formatOperationalAmount(line.cost_before_vat)}
                          </td>
                        ) : null}
                        {col("vat") ? (
                          <td className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_VAT_COL, SAFE_GRID_AMOUNT)}>
                            {formatOperationalAmount(line.revenue_vat_amount)}
                          </td>
                        ) : null}
                        {col("totalBilling") ? (
                          <td className={cn(SAFE_GRID_HIGHLIGHT_TOTAL_BILLING, ASSIGNMENT_GRID_MONEY_COL)}>
                            {formatOperationalAmount(line.revenue_after_vat)}
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("gp") ? (
                          <td className={cn(SAFE_GRID_HIGHLIGHT_GP, ASSIGNMENT_GRID_MONEY_COL)}>
                            {formatOperationalAmount(row.rollups.gp)}
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("margin") ? (
                          <td
                            className={cn(
                              SAFE_GRID_TD,
                              ASSIGNMENT_GRID_MONEY_COL,
                              SAFE_GRID_AMOUNT,
                              "text-muted-foreground"
                            )}
                          >
                            {formatPercent(row.rollups.margin_percent)}
                          </td>
                        ) : null}
                        {col("opsStatus") ? (
                        <td className={SAFE_GRID_TD}>
                          {gates.enablePills ? (
                            <>
                              <AssignmentOperationalStatusBadge status={row.operationalStatus} />
                              {gates.showInternalFinancials && line.vendor_io_document_number ? (
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  <DocumentNumber value={line.vendor_io_document_number} />
                                </p>
                              ) : null}
                            </>
                          ) : (
                            row.opsStatusLabel
                          )}
                        </td>
                        ) : null}
                        {gates.showInternalBilling && col("billing") ? (
                          <td className={SAFE_GRID_TD}>
                            <LineBillingStatusBadge lineBillingStatus={row.lineBillingStatus} />
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("payout") ? (
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
                        ) : null}
                        {gates.enableEditActions && col("actions") ? (
                          <td className={cn(SAFE_GRID_TD, "text-center")}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mx-auto size-7"
                              onClick={() => onEditLine(line)}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {expanded && gates.enableDeliverableChildren ? (
                      <AssignmentSafeDeliverableRows
                        campaignId={campaignId}
                        line={line}
                        deliverables={deliverables}
                        currency={lineCurrency}
                        parentColSpan={parentColSpan}
                        selectedIds={selectedDeliverableIds}
                        onToggleDeliverable={(deliverableId) =>
                          toggleDeliverable(deliverableId, row.lineId)
                        }
                        showSelection={
                          (line.assignment?.pricing_mode ?? "package") === "per_deliverable"
                        }
                        showExpandColumn={gates.enableExpansion}
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
          currency={footerCurrency ?? "USD"}
          selectedLineIds={[...selectedLineIds]}
          selectableLineCount={selectableLineIds.length}
          onSelectAll={selectAllLines}
          onClearSelection={clearSelection}
          vioLineIds={vioLineIds}
          reviseVioLineIds={reviseVioLineIds}
          ungenerateIoLineIds={ungenerateIoLineIds}
          invoiceLineIds={invoiceLineIds}
          invoiceTotal={invoiceTotal}
          onGenerateInvoice={emitInvoiceSelection}
          hasInvoiceSelection={hasInvoiceSelection}
          invoiceActionLabel={invoiceActionLabel}
          ioCoverage={ioCoverage}
          onAfterOperationalMutation={resetOperationalUiState}
        />
      ) : null}
    </div>
  );
}
