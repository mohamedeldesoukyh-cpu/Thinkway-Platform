"use client";

import { PencilIcon } from "lucide-react";
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
import { AssignmentCreatorCell } from "@/features/campaigns/components/assignment-hierarchy/assignment-creator-cell";
import { AssignmentPlatformPills } from "@/features/campaigns/components/assignment-hierarchy/assignment-platform-pills";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentsEmptyState } from "@/features/campaigns/components/assignments-empty-state";
import {
  FloatingSelectionBar,
  type AssignmentSelectionTotals,
} from "@/features/campaigns/components/assignment-hierarchy/floating-selection-bar";
import { operationalFloatingBarContentClass } from "@/components/workspace/operational-floating-action-bar";
import { resolveSelectionActions } from "@/lib/billing/selection-action-engine";
import { AssignmentSafeDeliverableRows } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-deliverable-rows";
import {
  ASSIGNMENT_SAFE_GRID_COL_SPAN,
  SAFE_GRID_AMOUNT,
  SAFE_GRID_CHECKBOX,
  SAFE_GRID_CONTROL_CELL,
  SAFE_GRID_HIGHLIGHT_GP,
  SAFE_GRID_PARENT_ROW,
  SAFE_GRID_PARENT_ROW_EXPANDED,
  SAFE_GRID_SHELL,
  SAFE_GRID_TABLE,
  SAFE_GRID_TD,
  SAFE_GRID_TH,
  SAFE_GRID_HEAD,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid-styles";
import { AssignmentHighlightAmount } from "@/features/campaigns/components/assignment-hierarchy/assignment-highlight-amount";
import {
  AssignmentLineBillingBadge,
  AssignmentOpsStatusBadge,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-status-badges";
import { ASSIGNMENT_GRID_MONEY_COL, ASSIGNMENT_GRID_VAT_COL } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import { AssignmentParentTableColGroup } from "@/features/campaigns/components/assignment-hierarchy/assignment-parent-table-colgroup";
import {
  fallbackChildTableWidthPx,
  getChildLeadingParentColumnIds,
  getFallbackLeadingWidths,
  sumVisibleParentColumnWidths,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import { HIERARCHY_COLUMN_LABELS, assignmentParentColDataAttr } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_TABLE_FONT, operationalMarginAmountClass } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
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
import { computeClientBilling } from "@/lib/assignments/client-billing-commercial";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import {
  useOperationalChildColumnVisibleChecker,
  useOperationalColumnVisibleChecker,
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
  const col = useOperationalColumnVisibleChecker();
  const childCol = useOperationalChildColumnVisibleChecker();
  const parentColSpan = useOperationalVisibleColumnCount();

  const childGridAlignment = useMemo(
    () => ({
      leadingParentColumnIds: getChildLeadingParentColumnIds(col, gates),
      fallbackLeadingWidths: getFallbackLeadingWidths(col, gates),
      fallbackChildTableWidthPx: fallbackChildTableWidthPx(col, gates, childCol),
    }),
    [col, childCol, gates]
  );

  const parentTableMinWidthPx = useMemo(
    () => sumVisibleParentColumnWidths(col, gates),
    [col, gates]
  );

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

  const emitInvoiceSelection = useCallback(() => {
    onInvoiceLines?.({
      line_ids: invoiceLineIds,
      deliverable_ids: invoiceDeliverableIds,
      post_ids: [],
    });
  }, [onInvoiceLines, invoiceLineIds, invoiceDeliverableIds]);

  const selectionTotals = useMemo((): AssignmentSelectionTotals => {
    const currencies = new Set<string>();
    let revenue = 0;
    let cost = 0;
    let gp = 0;
    let totalBilling = 0;
    for (const id of selectedLineIds) {
      const row = preparedRows.find((r) => r.lineId === id);
      if (!row) continue;
      const line = row.group.line;
      const revenueBeforeVat = Number(line.revenue_before_vat ?? line.revenue) || 0;
      const costBeforeVat = Number(line.cost_before_vat ?? line.cost) || 0;
      const billing = computeClientBilling({
        revenueBeforeVat,
        usageRightsAmount: Number(line.usage_rights_amount ?? 0),
        usageRightsCost: Number(line.usage_rights_cost ?? 0),
        agencyFeePercent: Number(line.agency_fee_percent ?? 0),
        vatPercent: Number(line.revenue_vat_percent ?? 0),
        vatExempt: Boolean(line.revenue_vat_exempt),
        costBeforeVat,
      });
      revenue += billing.revenueBeforeVat;
      cost += costBeforeVat;
      gp += billing.gp;
      totalBilling += billing.totalBilling;
      currencies.add(resolveAssignmentLineCurrency(line));
    }
    return {
      count: selectedLineIds.size + selectedDeliverableIds.size,
      revenue,
      cost,
      gp,
      totalBilling,
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

  const hasSelection = selectionTotals.count > 0;
  const showFloatingBar = gates.enableFooter && hasSelection;

  if (preparedRows.length === 0) {
    if (hierarchy.load_error) {
      return (
        <p className="px-3 py-6 text-sm text-destructive">
          Assignment data could not be loaded: {hierarchy.load_error}
        </p>
      );
    }
    return (
      <AssignmentsEmptyState
        campaignId={campaignId}
        onCreateAssignment={onCreateAssignment}
      />
    );
  }

  return (
    <div
      className={cn(
        OPERATIONAL_TABLE_FONT,
        "min-w-0 space-y-2",
        operationalFloatingBarContentClass(showFloatingBar)
      )}
    >
      {audienceView === "client" ? (
        <div className="rounded-lg border border-[var(--brand-product)]/25 bg-[var(--brand-product)]/5 px-3 py-2 text-xs text-foreground">
          Client preview — showing campaign assignments as your client sees them. Internal
          cost, margin, vendor IO, billing controls, and deliverable editing are hidden.
        </div>
      ) : null}
      <div className={SAFE_GRID_SHELL}>
        <table
          className={SAFE_GRID_TABLE}
          data-assignment-parent-grid
          style={{ minWidth: Math.max(parentTableMinWidthPx, 1300) }}
        >
          <AssignmentParentTableColGroup col={col} gates={gates} />
          <thead className={SAFE_GRID_HEAD}>
            <tr>
              {col("select") ? (
                <th {...assignmentParentColDataAttr("select")} className={cn(SAFE_GRID_TH, SAFE_GRID_CONTROL_CELL)}>
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
                <th {...assignmentParentColDataAttr("assignment")} className={cn(SAFE_GRID_TH, "min-w-[160px]")}>
                  {HIERARCHY_COLUMN_LABELS.assignment}
                </th>
              ) : null}
              {col("creator") ? (
                <th {...assignmentParentColDataAttr("creator")} className={cn(SAFE_GRID_TH, "w-[108px] max-w-[120px]")}>
                  {HIERARCHY_COLUMN_LABELS.creator}
                </th>
              ) : null}
              {col("platforms") ? (
                <th {...assignmentParentColDataAttr("platforms")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.platforms}</th>
              ) : null}
              {col("deliverables") ? (
                <th {...assignmentParentColDataAttr("deliverables")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.deliverables}</th>
              ) : null}
              {col("postingDates") ? (
                <th {...assignmentParentColDataAttr("postingDates")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.postingDates}</th>
              ) : null}
              {col("costCurrency") ? (
                <th {...assignmentParentColDataAttr("costCurrency")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.costCurrency}</th>
              ) : null}
              {col("revenue") ? (
                <th {...assignmentParentColDataAttr("revenue")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.revenue}
                </th>
              ) : null}
              {col("usageRights") ? (
                <th {...assignmentParentColDataAttr("usageRights")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.usageRights}
                </th>
              ) : null}
              {col("agencyFeePercent") ? (
                <th {...assignmentParentColDataAttr("agencyFeePercent")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_VAT_COL)}>
                  {HIERARCHY_COLUMN_LABELS.agencyFeePercent}
                </th>
              ) : null}
              {col("agencyFee") ? (
                <th {...assignmentParentColDataAttr("agencyFee")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.agencyFee}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("cost") ? (
                <th {...assignmentParentColDataAttr("cost")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.cost}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("usageRightsCost") ? (
                <th {...assignmentParentColDataAttr("usageRightsCost")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.usageRightsCost}
                </th>
              ) : null}
              {col("vat") ? (
                <th {...assignmentParentColDataAttr("vat")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_VAT_COL)}>
                  {HIERARCHY_COLUMN_LABELS.vat}
                </th>
              ) : null}
              {col("totalBilling") ? (
                <th {...assignmentParentColDataAttr("totalBilling")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.totalBilling}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("gp") ? (
                <th {...assignmentParentColDataAttr("gp")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.gp}
                </th>
              ) : null}
              {gates.showInternalFinancials && col("margin") ? (
                <th {...assignmentParentColDataAttr("margin")} className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.margin}
                </th>
              ) : null}
              {col("opsStatus") ? (
                <th {...assignmentParentColDataAttr("opsStatus")} className={SAFE_GRID_TH}>
                  {audienceView === "client" ? "Status" : HIERARCHY_COLUMN_LABELS.opsStatus}
                </th>
              ) : null}
              {gates.showInternalBilling && col("billing") ? (
                <th {...assignmentParentColDataAttr("billing")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.billing}</th>
              ) : null}
              {gates.showInternalFinancials && col("payout") ? (
                <th {...assignmentParentColDataAttr("payout")} className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.payout}</th>
              ) : null}
              {gates.enableEditActions && col("actions") ? (
                <th {...assignmentParentColDataAttr("actions")} className={cn(SAFE_GRID_TH, "w-10")} />
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
                  .split(" ")
                  .filter((c) => !c.startsWith("border-l"))
                  .join(" ")
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
                        {col("select") ? (
                          <td {...assignmentParentColDataAttr("select")} className={SAFE_GRID_CONTROL_CELL}>
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
                        <td {...assignmentParentColDataAttr("assignment")} className={cn(SAFE_GRID_TD, "thinkway-campaign-asgn-assignment-cell")}>
                          <div className="flex min-w-0 items-center gap-1.5">
                            {gates.enableExpansion && col("expand") ? (
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
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onOpenInfluencerDetail?.(row.group, row)}
                              className="min-w-0 flex-1 text-left transition-colors hover:text-primary"
                              title={`View ${row.displayName} details`}
                            >
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="min-w-0 whitespace-normal break-words text-[11px] font-semibold leading-tight text-[var(--camp-text)]">
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
                                <p className="text-[10px] text-[var(--camp-text-3)]">
                                  <DocumentNumber value={line.document_number} />
                                </p>
                              ) : null}
                            </button>
                          </div>
                        </td>
                        ) : null}
                        {col("creator") ? (
                        <td
                          {...assignmentParentColDataAttr("creator")}
                          className={cn(SAFE_GRID_TD, "w-[108px] max-w-[120px]")}
                        >
                          {line.influencer_name || row.displayName ? (
                            <AssignmentCreatorCell
                              name={line.influencer_name ?? row.displayName}
                              avatarUrl={line.creator_avatar_url}
                              onClick={
                                onOpenInfluencerDetail
                                  ? () => onOpenInfluencerDetail(row.group, row)
                                  : undefined
                              }
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        ) : null}
                        {col("platforms") ? (
                          <td {...assignmentParentColDataAttr("platforms")} className={SAFE_GRID_TD}>
                            <AssignmentPlatformPills platforms={row.platforms} />
                          </td>
                        ) : null}
                        {col("deliverables") ? (
                          <td {...assignmentParentColDataAttr("deliverables")} className={cn(SAFE_GRID_TD, SAFE_GRID_AMOUNT)}>
                            {row.rollups.deliverable_count}
                          </td>
                        ) : null}
                        {col("postingDates") ? (
                          <td
                            {...assignmentParentColDataAttr("postingDates")}
                            className={cn(SAFE_GRID_TD, "text-center text-muted-foreground")}
                            suppressHydrationWarning
                          >
                            {row.postingSummary}
                          </td>
                        ) : null}
                        {col("costCurrency") ? (
                          <td {...assignmentParentColDataAttr("costCurrency")} className={cn(SAFE_GRID_TD, "text-center text-[10px] font-medium text-foreground/80")}>
                            {resolveAssignmentLineCurrencyDisplay(line)}
                          </td>
                        ) : null}
                        {col("revenue") ? (
                          <td {...assignmentParentColDataAttr("revenue")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount variant="rev">
                              {formatOperationalAmount(row.rollups.revenue)}
                            </AssignmentHighlightAmount>
                          </td>
                        ) : null}
                        {col("usageRights") ? (
                          <td {...assignmentParentColDataAttr("usageRights")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT)}>
                            {formatOperationalAmount(line.usage_rights_amount)}
                          </td>
                        ) : null}
                        {col("agencyFeePercent") ? (
                          <td {...assignmentParentColDataAttr("agencyFeePercent")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_VAT_COL, SAFE_GRID_AMOUNT, "text-muted-foreground")}>
                            {formatPercent(line.agency_fee_percent)}
                          </td>
                        ) : null}
                        {col("agencyFee") ? (
                          <td {...assignmentParentColDataAttr("agencyFee")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT)}>
                            {formatOperationalAmount(line.agency_fee_amount)}
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("cost") ? (
                          <td {...assignmentParentColDataAttr("cost")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount variant="cost">
                              {formatOperationalAmount(line.cost_before_vat)}
                            </AssignmentHighlightAmount>
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("usageRightsCost") ? (
                          <td {...assignmentParentColDataAttr("usageRightsCost")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT)}>
                            {formatOperationalAmount(line.usage_rights_cost)}
                          </td>
                        ) : null}
                        {col("vat") ? (
                          <td {...assignmentParentColDataAttr("vat")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_VAT_COL, SAFE_GRID_AMOUNT)}>
                            {formatOperationalAmount(line.revenue_vat_amount)}
                          </td>
                        ) : null}
                        {col("totalBilling") ? (
                          <td {...assignmentParentColDataAttr("totalBilling")} className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount variant="billing">
                              {formatOperationalAmount(line.revenue_after_vat)}
                            </AssignmentHighlightAmount>
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("gp") ? (
                          <td
                            {...assignmentParentColDataAttr("gp")}
                            className={cn(SAFE_GRID_HIGHLIGHT_GP, ASSIGNMENT_GRID_MONEY_COL)}
                          >
                            {formatOperationalAmount(row.rollups.gp)}
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("margin") ? (
                          <td
                            {...assignmentParentColDataAttr("margin")}
                            className={cn(
                              SAFE_GRID_TD,
                              ASSIGNMENT_GRID_MONEY_COL,
                              operationalMarginAmountClass(row.rollups.margin_percent)
                            )}
                          >
                            {formatPercent(row.rollups.margin_percent)}
                          </td>
                        ) : null}
                        {col("opsStatus") ? (
                        <td {...assignmentParentColDataAttr("opsStatus")} className={SAFE_GRID_TD}>
                          {gates.enablePills ? (
                            <AssignmentOpsStatusBadge status={row.operationalStatus} />
                          ) : (
                            row.opsStatusLabel
                          )}
                        </td>
                        ) : null}
                        {gates.showInternalBilling && col("billing") ? (
                          <td {...assignmentParentColDataAttr("billing")} className={SAFE_GRID_TD}>
                            <AssignmentLineBillingBadge lineBillingStatus={row.lineBillingStatus} />
                          </td>
                        ) : null}
                        {gates.showInternalFinancials && col("payout") ? (
                          <td {...assignmentParentColDataAttr("payout")} className={SAFE_GRID_TD}>
                            {line.vendor_io_document_number ? (
                              <DocumentNumber
                                value={line.vendor_io_document_number}
                                className="text-[10px] text-[var(--camp-blue)]"
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        {gates.enableEditActions && col("actions") ? (
                          <td {...assignmentParentColDataAttr("actions")} className={cn(SAFE_GRID_TD, "text-center")}>
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
                        showExpandColumn={false}
                        leadingParentColumnIds={childGridAlignment.leadingParentColumnIds}
                        fallbackLeadingWidths={childGridAlignment.fallbackLeadingWidths}
                        fallbackChildTableWidthPx={childGridAlignment.fallbackChildTableWidthPx}
                      />
                    ) : null}
              </Fragment>
            );
          })}
          </tbody>
        </table>
      </div>

      {gates.enableFooter ? (
        <FloatingSelectionBar
          campaignId={campaignId}
          totals={selectionTotals}
          selectedLineIds={[...selectedLineIds]}
          selectableLineCount={selectableLineIds.length}
          onSelectAll={selectAllLines}
          onClearSelection={clearSelection}
          vioLineIds={vioLineIds}
          reviseVioLineIds={reviseVioLineIds}
          ungenerateIoLineIds={ungenerateIoLineIds}
          invoiceLineIds={invoiceLineIds}
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
