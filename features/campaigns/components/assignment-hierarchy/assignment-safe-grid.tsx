"use client";

import { PencilIcon } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { AssignmentCreatorCell } from "@/features/campaigns/components/assignment-hierarchy/assignment-creator-cell";
import { AssignmentFullDescriptionCell } from "@/features/campaigns/components/assignment-hierarchy/assignment-full-description-cell";
import { AssignmentPlatformPills } from "@/features/campaigns/components/assignment-hierarchy/assignment-platform-pills";
import { AssignmentExpandToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-expand-toggle";
import { AssignmentRowCircleControl } from "@/features/campaigns/components/assignment-hierarchy/assignment-row-circle-control";
import { createAssignmentDeliverableAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import { AssignmentsEmptyState } from "@/features/campaigns/components/assignments-empty-state";
import {
  FloatingSelectionBar,
  type AssignmentSelectionTotals,
} from "@/features/campaigns/components/assignment-hierarchy/floating-selection-bar";
import {
  AssignmentPricingCalculator,
  type AssignmentCalculatorLine,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-pricing-calculator";
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
import {
  AssignmentGridCell,
  AssignmentGridRow,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-cell";
import { buildAssignmentCssGridCols } from "@/features/campaigns/components/assignment-hierarchy/assignment-css-grid";
import {
  fallbackChildTableWidthPx,
  getChildLeadingParentColumnIds,
  getFallbackLeadingWidths,
  getVisibleAssignmentGridColumns,
  sumVisibleParentColumnWidths,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import { HIERARCHY_COLUMN_LABELS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { formatOperationalAmount, operationalZeroClass } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_TABLE_FONT, operationalMarginAmountClass } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
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
import { useAssignmentGridEditSession } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
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
import { resolveAssignmentPrimaryHandle } from "@/lib/campaigns/assignment-detail-presenters";
import { cn } from "@/lib/utils";
import { computeClientBilling } from "@/lib/assignments/client-billing-commercial";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import {
  useOperationalChildColumnVisibleChecker,
  useOperationalColumnVisibleChecker,
  useOperationalVisibleColumnCount,
} from "@/components/tables/operational-table-column-context";
import {
  getCreatorConnectedPlatformOptions,
  getDeliverableTypeCodesForPlatform,
} from "@/lib/campaigns/deliverable-taxonomy";

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
  invoicePending?: boolean;
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
      <div key={`fail-${lineId}`} className="bg-destructive/10 px-2 py-2 text-xs text-destructive">
        ROW FAILED {lineId}
      </div>
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
  invoicePending = false,
  onCreateAssignment,
}: AssignmentSafeGridProps) {
  const audienceView = useAssignmentAudienceView();
  const gridEdit = useAssignmentGridEditSession();
  const router = useRouter();
  const [pendingAdd, startAddTransition] = useTransition();
  const gates = resolveAssignmentsGridGates(audienceView);
  const col = useOperationalColumnVisibleChecker();
  const childCol = useOperationalChildColumnVisibleChecker();
  const parentColSpan = useOperationalVisibleColumnCount();

  const visibleParentColumns = useMemo(
    () => getVisibleAssignmentGridColumns(col, gates),
    [col, gates]
  );
  const gridCols = useMemo(
    () => buildAssignmentCssGridCols(visibleParentColumns),
    [visibleParentColumns]
  );

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
  const [calculatorOpen, setCalculatorOpen] = useState(false);

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

  useEffect(() => {
    if (!gridEdit.isEditing) return;
    setExpandedIds(new Set(preparedRows.map((row) => row.lineId)));
  }, [gridEdit.isEditing, preparedRows]);

  const addChildDeliverable = useCallback(
    (line: CampaignLineWorkspace) => {
      if (!gridEdit.isEditing || line.vendor_assignment_locked || pendingAdd) return;
      const platformOptions = getCreatorConnectedPlatformOptions({
        creatorPlatformAccounts: line.creator_platform_accounts,
        assignment: line.assignment,
      });
      const defaultPlatform = platformOptions[0]?.value ?? "instagram";
      const defaultTypes = getDeliverableTypeCodesForPlatform(defaultPlatform);
      startAddTransition(async () => {
        const result = await createAssignmentDeliverableAction({
          campaign_id: campaignId,
          campaign_line_id: line.id,
          platform: defaultPlatform,
          deliverable_type: defaultTypes[0] ?? "other",
          quantity: 1,
          unit_cost: 0,
          unit_revenue: 0,
          revenue_vat_percent: line.revenue_vat_percent,
          cost_vat_percent: line.cost_vat_percent,
        });
        if (result.ok) {
          setExpandedIds((prev) => new Set(prev).add(line.id));
          router.refresh();
        }
      });
    },
    [campaignId, gridEdit.isEditing, pendingAdd, router]
  );

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
      deliverables: selectedDeliverableIds.size,
      currency: currencies.size === 1 ? [...currencies][0]! : null,
      currencyMixed: currencies.size > 1,
    };
  }, [selectedLineIds, selectedDeliverableIds, preparedRows]);

  const calculatorLines = useMemo((): AssignmentCalculatorLine[] => {
    const rows: AssignmentCalculatorLine[] = [];
    for (const id of selectedLineIds) {
      const row = preparedRows.find((item) => item.lineId === id);
      if (!row) continue;
      const line = row.group.line;
      rows.push({
        lineId: line.id,
        name: row.displayName,
        cost: Number(line.cost_before_vat ?? line.cost) || 0,
        revenue: Number(line.revenue_before_vat ?? line.revenue) || 0,
        vatPercent: Number(line.revenue_vat_percent ?? 0) || 0,
        usage_rights_amount: Number(line.usage_rights_amount ?? 0) || 0,
        usage_rights_cost: Number(line.usage_rights_cost ?? 0) || 0,
        agency_fee_percent: Number(line.agency_fee_percent ?? 0) || 0,
        locked: Boolean(line.vendor_assignment_locked),
      });
    }
    return rows;
  }, [selectedLineIds, preparedRows]);

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
    setCalculatorOpen(false);
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
      <div className={cn(SAFE_GRID_SHELL, "overflow-x-auto")}>
        <div
          className={SAFE_GRID_TABLE}
          data-assignment-parent-grid
          style={{
            minWidth: Math.max(parentTableMinWidthPx, 1300),
            ["--cols" as string]: gridCols,
          }}
        >
          <AssignmentGridRow cols={gridCols} className={cn("tw-hr", SAFE_GRID_HEAD)}>
              {col("select") ? (
                <AssignmentGridCell header columnId="select" className={cn(SAFE_GRID_TH, SAFE_GRID_CONTROL_CELL)}>
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
                      title="Select all assignments"
                    />
                  ) : null}
                </AssignmentGridCell>
              ) : null}
              {col("assignment") ? (
                <AssignmentGridCell header columnId="assignment" className={cn(SAFE_GRID_TH, "min-w-[160px]")}>
                  {HIERARCHY_COLUMN_LABELS.assignment}
                </AssignmentGridCell>
              ) : null}
              {col("creator") ? (
                <AssignmentGridCell header columnId="creator" className={cn(SAFE_GRID_TH, "w-[108px] max-w-[120px]")}>
                  {HIERARCHY_COLUMN_LABELS.creator}
                </AssignmentGridCell>
              ) : null}
              {col("platforms") ? (
                <AssignmentGridCell header columnId="platforms" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.platforms}</AssignmentGridCell>
              ) : null}
              {col("deliverables") ? (
                <AssignmentGridCell header columnId="deliverables" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.deliverables}</AssignmentGridCell>
              ) : null}
              {col("fullDescription") ? (
                <AssignmentGridCell header
                  columnId="fullDescription"
                  className={cn(SAFE_GRID_TH, "min-w-[160px] max-w-[220px]")}
                >
                  {HIERARCHY_COLUMN_LABELS.fullDescription}
                </AssignmentGridCell>
              ) : null}
              {col("postingDates") ? (
                <AssignmentGridCell header columnId="postingDates" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.postingDates}</AssignmentGridCell>
              ) : null}
              {col("costCurrency") ? (
                <AssignmentGridCell header columnId="costCurrency" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.costCurrency}</AssignmentGridCell>
              ) : null}
              {col("revenue") ? (
                <AssignmentGridCell header columnId="revenue" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.revenue}
                </AssignmentGridCell>
              ) : null}
              {col("usageRights") ? (
                <AssignmentGridCell header columnId="usageRights" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.usageRights}
                </AssignmentGridCell>
              ) : null}
              {col("agencyFeePercent") ? (
                <AssignmentGridCell header columnId="agencyFeePercent" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_VAT_COL)}>
                  {HIERARCHY_COLUMN_LABELS.agencyFeePercent}
                </AssignmentGridCell>
              ) : null}
              {col("agencyFee") ? (
                <AssignmentGridCell header columnId="agencyFee" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.agencyFee}
                </AssignmentGridCell>
              ) : null}
              {gates.showInternalFinancials && col("cost") ? (
                <AssignmentGridCell header columnId="cost" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.cost}
                </AssignmentGridCell>
              ) : null}
              {gates.showInternalFinancials && col("usageRightsCost") ? (
                <AssignmentGridCell header columnId="usageRightsCost" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.usageRightsCost}
                </AssignmentGridCell>
              ) : null}
              {col("vat") ? (
                <AssignmentGridCell header columnId="vat" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_VAT_COL)}>
                  {HIERARCHY_COLUMN_LABELS.vat}
                </AssignmentGridCell>
              ) : null}
              {col("totalBilling") ? (
                <AssignmentGridCell header columnId="totalBilling" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.totalBilling}
                </AssignmentGridCell>
              ) : null}
              {gates.showInternalFinancials && col("gp") ? (
                <AssignmentGridCell header columnId="gp" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.gp}
                </AssignmentGridCell>
              ) : null}
              {gates.showInternalFinancials && col("margin") ? (
                <AssignmentGridCell header columnId="margin" className={cn(SAFE_GRID_TH, ASSIGNMENT_GRID_MONEY_COL)}>
                  {HIERARCHY_COLUMN_LABELS.margin}
                </AssignmentGridCell>
              ) : null}
              {col("opsStatus") ? (
                <AssignmentGridCell header columnId="opsStatus" className={SAFE_GRID_TH}>
                  {audienceView === "client" ? "Status" : HIERARCHY_COLUMN_LABELS.opsStatus}
                </AssignmentGridCell>
              ) : null}
              {gates.showInternalBilling && col("billing") ? (
                <AssignmentGridCell header columnId="billing" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.billing}</AssignmentGridCell>
              ) : null}
              {gates.showInternalFinancials && col("payout") ? (
                <AssignmentGridCell header columnId="payout" className={SAFE_GRID_TH}>{HIERARCHY_COLUMN_LABELS.payout}</AssignmentGridCell>
              ) : null}
              {gates.enableEditActions && col("actions") ? (
                <AssignmentGridCell header columnId="actions" className={cn(SAFE_GRID_TH, "w-10")} />
              ) : null}
          </AssignmentGridRow>
          {preparedRows.map((row) => {
            const line = row.group.line;
            const expanded = gates.enableExpansion && expandedIds.has(row.lineId);
            const meta = row.meta;
            const selectable = gates.enableCheckboxes && meta.rowSelectable;
            const deliverables = Array.isArray(row.group.deliverables)
              ? row.group.deliverables
              : [];
            const lineCurrency = resolveAssignmentLineCurrency(line);
            return (
              <Fragment key={row.lineId}>
                    {tryRenderRowCells(row.lineId, parentColSpan, () => (
                      <AssignmentGridRow
                        cols={gridCols}
                        className={cn(
                          "tw-r",
                          SAFE_GRID_PARENT_ROW,
                          selectedLineIds.has(row.lineId) && "sel",
                          expanded && SAFE_GRID_PARENT_ROW_EXPANDED
                        )}
                        data-line-id={row.lineId}
                        data-selected={selectedLineIds.has(row.lineId) ? "true" : undefined}
                      >
                        {col("select") ? (
                          <AssignmentGridCell columnId="select" className={SAFE_GRID_CONTROL_CELL}>
                            {selectable ? (
                              <input
                                type="checkbox"
                                className={SAFE_GRID_CHECKBOX}
                                checked={selectedLineIds.has(row.lineId)}
                                onChange={() => toggleLine(row.lineId, selectable)}
                                aria-label={`Select ${row.displayName}`}
                                title={`Select ${row.displayName}`}
                              />
                            ) : null}
                          </AssignmentGridCell>
                        ) : null}
                        {col("assignment") ? (
                        <AssignmentGridCell columnId="assignment" className={cn(SAFE_GRID_TD, "thinkway-campaign-asgn-assignment-cell")}>
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
                            {gridEdit.isEditing &&
                            gates.enableEditActions &&
                            !line.vendor_assignment_locked ? (
                              <AssignmentRowCircleControl
                                kind="add"
                                disabled={pendingAdd || gridEdit.saving}
                                label={`Add deliverable to ${row.displayName}`}
                                onClick={() => addChildDeliverable(line)}
                              />
                            ) : null}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="tw-id">
                                <DocumentNumber value={line.document_number} />
                              </p>
                              {gates.showInternalFinancials &&
                              (campaignPoExceeded || line.po_over_consumed) ? (
                                <Badge
                                  variant="outline"
                                  className="mt-1 border-amber-500/60 text-[10px] text-amber-800 dark:text-amber-200"
                                >
                                  PO exceeded
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </AssignmentGridCell>
                        ) : null}
                        {col("creator") ? (
                        <AssignmentGridCell
                          columnId="creator"
                          className={cn(SAFE_GRID_TD, "w-[108px] max-w-[120px]")}
                        >
                          {line.influencer_name || row.displayName ? (
                            <AssignmentCreatorCell
                              name={line.influencer_name ?? row.displayName}
                              avatarUrl={
                                line.creator_avatar_url ??
                                line.influencer_avatar_url ??
                                line.creator_profile_image_url
                              }
                              profileUrl={
                                line.creator_platform_accounts.find((account) =>
                                  Boolean(account.profile_url?.trim())
                                )?.profile_url ??
                                line.assignment?.platforms.find((platform) =>
                                  Boolean(platform.profile_url?.trim())
                                )?.profile_url ??
                                null
                              }
                              handle={resolveAssignmentPrimaryHandle(line)}
                              onClick={
                                onOpenInfluencerDetail
                                  ? () => onOpenInfluencerDetail(row.group, row)
                                  : undefined
                              }
                            />
                          ) : (
                            "—"
                          )}
                        </AssignmentGridCell>
                        ) : null}
                        {col("platforms") ? (
                          <AssignmentGridCell columnId="platforms" className={SAFE_GRID_TD}>
                            <AssignmentPlatformPills platforms={row.platforms} />
                          </AssignmentGridCell>
                        ) : null}
                        {col("deliverables") ? (
                          <AssignmentGridCell columnId="deliverables" className={cn(SAFE_GRID_TD, SAFE_GRID_AMOUNT)}>
                            {row.rollups.deliverable_count}
                          </AssignmentGridCell>
                        ) : null}
                        {col("fullDescription") ? (
                          <AssignmentGridCell
                            columnId="fullDescription"
                            className={cn(SAFE_GRID_TD, "min-w-[160px] max-w-[220px] align-top")}
                          >
                            <AssignmentFullDescriptionCell
                              campaignId={campaignId}
                              lineId={line.id}
                              value={line.description}
                              readOnly={!gates.enableEditActions}
                            />
                          </AssignmentGridCell>
                        ) : null}
                        {col("postingDates") ? (
                          <AssignmentGridCell
                            columnId="postingDates"
                            className={cn(
                              SAFE_GRID_TD,
                              "text-center",
                              row.postingSummary === "not set"
                                ? "tw-miss"
                                : "tw-dt text-muted-foreground"
                            )}
                            suppressHydrationWarning
                          >
                            {row.postingSummary}
                          </AssignmentGridCell>
                        ) : null}
                        {col("costCurrency") ? (
                          <AssignmentGridCell columnId="costCurrency" className={cn(SAFE_GRID_TD, "text-center text-[10px] font-medium text-foreground/80")}>
                            {resolveAssignmentLineCurrencyDisplay(line)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("revenue") ? (
                          <AssignmentGridCell columnId="revenue" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount
                              variant="rev"
                              className={operationalZeroClass(row.rollups.revenue)}
                            >
                              {formatOperationalAmount(row.rollups.revenue)}
                            </AssignmentHighlightAmount>
                          </AssignmentGridCell>
                        ) : null}
                        {col("usageRights") ? (
                          <AssignmentGridCell columnId="usageRights" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT, operationalZeroClass(line.usage_rights_amount))}>
                            {formatOperationalAmount(line.usage_rights_amount)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("agencyFeePercent") ? (
                          <AssignmentGridCell columnId="agencyFeePercent" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_VAT_COL, SAFE_GRID_AMOUNT, "text-muted-foreground")}>
                            {formatPercent(line.agency_fee_percent)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("agencyFee") ? (
                          <AssignmentGridCell columnId="agencyFee" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT, operationalZeroClass(line.agency_fee_amount))}>
                            {formatOperationalAmount(line.agency_fee_amount)}
                          </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalFinancials && col("cost") ? (
                          <AssignmentGridCell columnId="cost" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount
                              variant="cost"
                              className={operationalZeroClass(line.cost_before_vat)}
                            >
                              {formatOperationalAmount(line.cost_before_vat)}
                            </AssignmentHighlightAmount>
                          </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalFinancials && col("usageRightsCost") ? (
                          <AssignmentGridCell columnId="usageRightsCost" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL, SAFE_GRID_AMOUNT, operationalZeroClass(line.usage_rights_cost))}>
                            {formatOperationalAmount(line.usage_rights_cost)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("vat") ? (
                          <AssignmentGridCell columnId="vat" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_VAT_COL, SAFE_GRID_AMOUNT, operationalZeroClass(line.revenue_vat_amount))}>
                            {formatOperationalAmount(line.revenue_vat_amount)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("totalBilling") ? (
                          <AssignmentGridCell columnId="totalBilling" className={cn(SAFE_GRID_TD, ASSIGNMENT_GRID_MONEY_COL)}>
                            <AssignmentHighlightAmount
                              variant="billing"
                              className={operationalZeroClass(line.revenue_after_vat)}
                            >
                              {formatOperationalAmount(line.revenue_after_vat)}
                            </AssignmentHighlightAmount>
                          </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalFinancials && col("gp") ? (
                          <AssignmentGridCell
                            columnId="gp"
                            className={cn(
                              SAFE_GRID_HIGHLIGHT_GP,
                              ASSIGNMENT_GRID_MONEY_COL,
                              operationalZeroClass(row.rollups.gp)
                            )}
                          >
                            {formatOperationalAmount(row.rollups.gp)}
                          </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalFinancials && col("margin") ? (
                          <AssignmentGridCell
                            columnId="margin"
                            className={cn(
                              SAFE_GRID_TD,
                              ASSIGNMENT_GRID_MONEY_COL,
                              operationalMarginAmountClass(row.rollups.margin_percent)
                            )}
                          >
                            {formatPercent(row.rollups.margin_percent)}
                          </AssignmentGridCell>
                        ) : null}
                        {col("opsStatus") ? (
                        <AssignmentGridCell columnId="opsStatus" className={SAFE_GRID_TD}>
                          {gates.enablePills ? (
                            <AssignmentOpsStatusBadge status={row.operationalStatus} />
                          ) : (
                            row.opsStatusLabel
                          )}
                        </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalBilling && col("billing") ? (
                          <AssignmentGridCell columnId="billing" className={SAFE_GRID_TD}>
                            <AssignmentLineBillingBadge lineBillingStatus={row.lineBillingStatus} />
                          </AssignmentGridCell>
                        ) : null}
                        {gates.showInternalFinancials && col("payout") ? (
                          <AssignmentGridCell columnId="payout" className={SAFE_GRID_TD}>
                            {line.vendor_io_document_number ? (
                              <DocumentNumber
                                value={line.vendor_io_document_number}
                                className="text-[10px] text-[var(--camp-blue)]"
                              />
                            ) : (
                              "—"
                            )}
                          </AssignmentGridCell>
                        ) : null}
                        {gates.enableEditActions && col("actions") ? (
                          <AssignmentGridCell columnId="actions" className={cn(SAFE_GRID_TD, "text-center")}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mx-auto size-7"
                              onClick={() => onEditLine(line)}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                          </AssignmentGridCell>
                        ) : null}
                      </AssignmentGridRow>
                    ))}
                    {expanded && gates.enableDeliverableChildren ? (
                      <AssignmentSafeDeliverableRows
                        campaignId={campaignId}
                        line={line}
                        deliverables={deliverables}
                        currency={lineCurrency}
                        parentColSpan={parentColSpan}
                        gridCols={gridCols}
                        parentTrackIds={visibleParentColumns}
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
        </div>
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
          invoicePending={invoicePending}
          ioCoverage={ioCoverage}
          onAfterOperationalMutation={() => {
            resetOperationalUiState();
          }}
          onOpenCalculator={() => setCalculatorOpen(true)}
        />
      ) : null}
      <AssignmentPricingCalculator
        campaignId={campaignId}
        currency={(selectionTotals.currency ?? hierarchy.currency_code ?? "EGP").toUpperCase()}
        currencyMixed={selectionTotals.currencyMixed}
        lines={calculatorLines}
        open={calculatorOpen && calculatorLines.length > 0}
        onClose={() => setCalculatorOpen(false)}
        onApplied={() => {
          resetOperationalUiState();
          setCalculatorOpen(false);
        }}
      />
    </div>
  );
}
