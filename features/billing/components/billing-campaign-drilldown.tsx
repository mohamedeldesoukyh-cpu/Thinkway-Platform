"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalRowTree } from "@/features/billing/components/operational-row-tree";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import {
  filterOperationalBillingTree,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import {
  clearOperationalSelection,
  countSelection,
  createEmptySelection,
  getGlobalSelectionStatus,
  selectionToSubmitPayload,
  toggleGlobalOperationalSelection,
  toggleOperationalRowSelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import { selectionStateEqual } from "@/lib/billing/selection-state";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

type BillingCampaignDrilldownProps = {
  detail: CampaignOperationalBillingDetail;
  filter?: OperationalBillingFilter;
  onInvoice?: (selection: OperationalSelectionPayload) => void;
  selection?: OperationalSelectionState;
  onSelectionChange?: (selection: OperationalSelectionState) => void;
  showBulkSelectionControls?: boolean;
  /** Match campaign workspace assignment table typography */
  appearance?: "default" | "campaign";
};

function BillingCampaignDrilldownInner({
  detail,
  filter = "all",
  onInvoice,
  selection: controlledSelection,
  onSelectionChange,
  showBulkSelectionControls = true,
  appearance = "default",
}: BillingCampaignDrilldownProps) {
  const campaign = appearance === "campaign";
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [internalSelection, setInternalSelection] =
    useState<OperationalSelectionState>(createEmptySelection);

  const selection = controlledSelection ?? internalSelection;
  const rootRows = detail.operational_rows;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const updateSelection = useCallback(
    (updater: (prev: OperationalSelectionState) => OperationalSelectionState) => {
      const prev = selectionRef.current;
      const next = updater(prev);
      if (selectionStateEqual(prev, next)) return;
      if (onSelectionChange) {
        onSelectionChange(next);
      } else {
        setInternalSelection(next);
      }
    },
    [onSelectionChange]
  );

  const filteredRows = useMemo(
    () => filterOperationalBillingTree(rootRows, filter),
    [rootRows, filter]
  );

  const selectedCount = countSelection(selection);
  const rollup = detail.rollup;
  const globalSelectionStatus = useMemo(
    () => getGlobalSelectionStatus(filteredRows, selection),
    [filteredRows, selection]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRow = useCallback(
    (row: OperationalBillingRow) => {
      updateSelection((prev) => toggleOperationalRowSelection(row, prev, rootRows));
    },
    [updateSelection, rootRows]
  );

  const handleSelectAllToggle = useCallback(() => {
    updateSelection((prev) => toggleGlobalOperationalSelection(filteredRows, prev));
  }, [updateSelection, filteredRows]);

  const handleClearSelection = useCallback(() => {
    updateSelection(() => clearOperationalSelection());
  }, [updateSelection]);

  const handleInvoiceSelected = useCallback(() => {
    if (!onInvoice || selectedCount === 0) return;
    onInvoice(selectionToSubmitPayload(selection, rootRows));
  }, [onInvoice, selectedCount, selection, rootRows]);

  return (
    <div
      className={cn(
        OPERATIONAL_TABLE_FONT,
        "space-y-3 border-t",
        showBulkSelectionControls ? "p-4" : "px-4 py-3"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showBulkSelectionControls ? (
          <div
            className={cn(
              "grid gap-1 text-muted-foreground sm:grid-cols-2 lg:grid-cols-5",
              campaign ? "text-[11px] font-normal" : "text-xs"
            )}
          >
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
                ariaLabel="Select all eligible operational rows"
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
          {onInvoice ? (
            <Button
              type="button"
              size="sm"
              onClick={handleInvoiceSelected}
              disabled={selectedCount === 0}
            >
              Generate invoice
            </Button>
          ) : null}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <p
          className={cn(
            "text-muted-foreground",
            campaign ? "text-[11px] font-normal" : "text-sm"
          )}
        >
          No operational rows match this filter.
        </p>
      ) : (
        <div className="space-y-1">
          {filteredRows.map((assignment) => (
            <OperationalRowTree
              key={assignment.id}
              row={assignment}
              depth={0}
              currency={detail.currency_code}
              rootRows={rootRows}
              selection={selection}
              isOpen={expanded.has(assignment.id)}
              expandedIds={expanded}
              onToggleExpand={toggleExpanded}
              onToggleSelect={toggleRow}
              appearance={appearance}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const BillingCampaignDrilldown = memo(BillingCampaignDrilldownInner);
