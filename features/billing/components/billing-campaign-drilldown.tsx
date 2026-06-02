"use client";

import { Fragment, useMemo, useState } from "react";
import { useActionState, useEffect } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  bulkApproveOperationalBillingAction,
  bulkMoveOperationalBillingAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import {
  isOperationalRowActionEligible,
  isOperationalRowInvoiceEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  filterOperationalBillingTree,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import {
  buildInvoiceSelectionBatch,
  clearOperationalSelection,
  countSelection,
  createEmptySelection,
  getGlobalSelectionStatus,
  getRowSelectionStatus,
  selectionToPayload,
  toggleGlobalOperationalSelection,
  toggleOperationalRowSelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import { cn } from "@/lib/utils";

type BillingCampaignDrilldownProps = {
  detail: CampaignOperationalBillingDetail;
  filter?: OperationalBillingFilter;
  onInvoice?: (selection: OperationalSelectionPayload) => void;
  /** Controlled selection for queue-level partial invoicing. */
  selection?: OperationalSelectionState;
  onSelectionChange?: (selection: OperationalSelectionState) => void;
  /** Approve / move to billing bulk actions (review panel). Default true. */
  showOperationalActions?: boolean;
  /** Select all / Clear toolbar inside expanded hierarchy. Default true (review panel). */
  showBulkSelectionControls?: boolean;
};

export function BillingCampaignDrilldown({
  detail,
  filter = "all",
  onInvoice,
  selection: controlledSelection,
  onSelectionChange,
  showOperationalActions = true,
  showBulkSelectionControls = true,
}: BillingCampaignDrilldownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [internalSelection, setInternalSelection] =
    useState<OperationalSelectionState>(createEmptySelection());

  const selection = controlledSelection ?? internalSelection;

  function updateSelection(
    updater: (prev: OperationalSelectionState) => OperationalSelectionState
  ) {
    const next = updater(selection);
    if (onSelectionChange) {
      onSelectionChange(next);
    } else {
      setInternalSelection(next);
    }
  }

  const [approveState, approveAction, approvePending] = useActionState(
    bulkApproveOperationalBillingAction,
    { ok: false } satisfies BillingActionState
  );
  const [moveState, moveAction, movePending] = useActionState(
    bulkMoveOperationalBillingAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    for (const state of [approveState, moveState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [approveState, moveState]);

  const filteredRows = useMemo(
    () => filterOperationalBillingTree(detail.operational_rows, filter),
    [detail.operational_rows, filter]
  );

  const selectedCount = countSelection(selection);
  const rollup = detail.rollup;
  const globalSelectionStatus = getGlobalSelectionStatus(filteredRows, selection);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRow(row: OperationalBillingRow) {
    updateSelection((prev) =>
      toggleOperationalRowSelection(row, prev, detail.operational_rows)
    );
  }

  function handleSelectAllToggle() {
    updateSelection((prev) => toggleGlobalOperationalSelection(filteredRows, prev));
  }

  function handleClearSelection() {
    updateSelection(() => clearOperationalSelection());
  }

  const hiddenFormFields = useMemo(() => {
    const payload = selectionToPayload(selection);
    return {
      campaign_id: detail.campaign_header_id,
      line_ids: payload.line_ids.join(","),
      deliverable_ids: payload.deliverable_ids.join(","),
      post_ids: payload.post_ids.join(","),
    };
  }, [detail.campaign_header_id, selection]);

  function handleInvoiceSelected() {
    if (!onInvoice || selectedCount === 0) return;
    const batch = buildInvoiceSelectionBatch(selection, detail.operational_rows);
    onInvoice(batch);
  }

  return (
    <div className={cn("space-y-3 border-t", showBulkSelectionControls ? "p-4" : "px-4 py-3")}>
      {showBulkSelectionControls || showOperationalActions || onInvoice ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showBulkSelectionControls ? (
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
              <span>
                Total:{" "}
                <strong className="text-foreground">
                  {formatBillingMoney(rollup.total_campaign_amount, detail.currency_code)}
                </strong>
              </span>
              <span>
                Achieved:{" "}
                <strong className="text-foreground">
                  {formatBillingMoney(rollup.achieved_revenue, detail.currency_code)}
                </strong>
              </span>
              <span>
                Invoiced:{" "}
                <strong className="text-foreground">
                  {formatBillingMoney(rollup.already_invoiced, detail.currency_code)}
                </strong>
              </span>
              <span>
                Remaining:{" "}
                <strong className="text-foreground">
                  {formatBillingMoney(rollup.remaining_to_invoice, detail.currency_code)}
                </strong>
              </span>
              <span>
                Unachieved:{" "}
                <strong className="text-foreground">
                  {formatBillingMoney(rollup.unachieved_revenue, detail.currency_code)}
                </strong>
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {showBulkSelectionControls ? (
              <div className="flex items-center gap-2 rounded-2xl border px-2 py-1">
                <OperationalSelectionCheckbox
                  status={globalSelectionStatus}
                  onToggle={handleSelectAllToggle}
                  ariaLabel="Select all operational rows"
                />
                <Button type="button" size="sm" variant="ghost" onClick={handleSelectAllToggle}>
                  Select all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSelection}
                  disabled={selectedCount === 0}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          {showOperationalActions ? (
            <>
              <form action={approveAction}>
                <input type="hidden" name="campaign_id" value={hiddenFormFields.campaign_id} />
                <input type="hidden" name="line_ids" value={hiddenFormFields.line_ids} />
                <input type="hidden" name="deliverable_ids" value={hiddenFormFields.deliverable_ids} />
                <input type="hidden" name="post_ids" value={hiddenFormFields.post_ids} />
                <Button type="submit" size="sm" variant="outline" disabled={approvePending || selectedCount === 0}>
                  Bulk approve
                </Button>
              </form>
              <form action={moveAction}>
                <input type="hidden" name="campaign_id" value={hiddenFormFields.campaign_id} />
                <input type="hidden" name="line_ids" value={hiddenFormFields.line_ids} />
                <input type="hidden" name="deliverable_ids" value={hiddenFormFields.deliverable_ids} />
                <input type="hidden" name="post_ids" value={hiddenFormFields.post_ids} />
                <Button type="submit" size="sm" variant="outline" disabled={movePending || selectedCount === 0}>
                  Move to billing
                </Button>
              </form>
            </>
          ) : null}
          {onInvoice ? (
            <Button type="button" size="sm" onClick={handleInvoiceSelected} disabled={selectedCount === 0}>
              Invoice selected
            </Button>
          ) : null}
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No operational rows match this filter.</p>
      ) : (
        <div className="space-y-1">
          {filteredRows.map((assignment) => (
            <OperationalRowTree
              key={assignment.id}
              row={assignment}
              depth={0}
              currency={detail.currency_code}
              rootRows={detail.operational_rows}
              selection={selection}
              expanded={expanded}
              onToggleExpand={toggleExpanded}
              onToggleSelect={toggleRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OperationalRowTree({
  row,
  depth,
  currency,
  rootRows,
  selection,
  expanded,
  onToggleExpand,
  onToggleSelect,
}: {
  row: OperationalBillingRow;
  depth: number;
  currency: string;
  rootRows: OperationalBillingRow[];
  selection: OperationalSelectionState;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (row: OperationalBillingRow) => void;
}) {
  const hasChildren = row.children.length > 0;
  const isOpen = expanded.has(row.id);
  const eligible =
    isOperationalRowActionEligible(row) || isOperationalRowInvoiceEligible(row);
  const selectionStatus = getRowSelectionStatus(row, selection);
  const indent = depth * 16;

  return (
    <Fragment>
      <div
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: indent + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => onToggleExpand(row.id)}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <OperationalSelectionCheckbox
          status={selectionStatus}
          disabled={!eligible && selectionStatus === "unchecked"}
          onToggle={() => onToggleSelect(row)}
          ariaLabel={`Select ${row.label}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{row.label}</p>
            {row.document_number ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {row.document_number}
              </span>
            ) : null}
            {row.kind === "assignment" ? (
              <BillingStatusBadge status={row.line_billing_status} />
            ) : (
              <DeliverableBillingStatusBadge
                status={row.billing_status as import("@/features/billing/types").AssignmentDeliverableBillingStatus}
              />
            )}
            {row.is_locked ? (
              <span className="text-[10px] text-muted-foreground">Locked</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatBillingMoney(row.remaining_amount, currency)} remaining ·{" "}
            {formatBillingMoney(row.invoiced_amount, currency)} invoiced
            {row.invoice_document_number ? ` · ${row.invoice_document_number}` : ""}
          </p>
        </div>
      </div>
      {isOpen
        ? row.children.map((child) => (
            <OperationalRowTree
              key={child.id}
              row={child}
              depth={depth + 1}
              currency={currency}
              rootRows={rootRows}
              selection={selection}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
            />
          ))
        : null}
    </Fragment>
  );
}
