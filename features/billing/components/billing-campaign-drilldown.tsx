"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSelection,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import {
  OperationalInvoiceDraftCells,
  OperationalRowTree,
} from "@/features/billing/components/operational-row-tree";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import {
  CAMPAIGN_INVOICE_DRAFT_ID,
  cascadeInvoiceDraftPercent,
  cascadeInvoiceDraftToBeInvoiced,
  computeCampaignInvoiceDraft,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
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
  invoicePercents?: InvoiceDraftPercents;
  onInvoicePercentsChange?: (next: InvoiceDraftPercents) => void;
  invoicePending?: boolean;
};

function BillingCampaignDrilldownInner({
  detail,
  filter = "all",
  onInvoice,
  selection: controlledSelection,
  onSelectionChange,
  showBulkSelectionControls = true,
  appearance = "default",
  invoicePercents: controlledPercents,
  onInvoicePercentsChange,
  invoicePending = false,
}: BillingCampaignDrilldownProps) {
  const campaign = appearance === "campaign";
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([CAMPAIGN_INVOICE_DRAFT_ID])
  );
  const [internalSelection, setInternalSelection] =
    useState<OperationalSelectionState>(createEmptySelection);
  const [internalPercents, setInternalPercents] = useState<InvoiceDraftPercents>({});

  const selection = controlledSelection ?? internalSelection;
  const percents = controlledPercents ?? internalPercents;
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

  const setPercents = useCallback(
    (next: InvoiceDraftPercents) => {
      if (onInvoicePercentsChange) onInvoicePercentsChange(next);
      else setInternalPercents(next);
    },
    [onInvoicePercentsChange]
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
  const campaignDraft = useMemo(
    () => computeCampaignInvoiceDraft(filteredRows, percents),
    [filteredRows, percents]
  );
  const campaignExpanded = expanded.has(CAMPAIGN_INVOICE_DRAFT_ID);
  const campaignEditable = campaignDraft.amount > 0.01;

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

  const handlePercentChange = useCallback(
    (rowId: string, percent: number) => {
      setPercents(cascadeInvoiceDraftPercent(filteredRows, rowId, percent, percents));
    },
    [filteredRows, percents, setPercents]
  );

  const handleToBeInvoicedChange = useCallback(
    (rowId: string, amount: number) => {
      setPercents(cascadeInvoiceDraftToBeInvoiced(filteredRows, rowId, amount, percents));
    },
    [filteredRows, percents, setPercents]
  );

  const handleInvoiceSelected = useCallback(() => {
    if (!onInvoice || selectedCount === 0) return;
    onInvoice(selectionToSubmitPayload(selection, rootRows));
  }, [onInvoice, selectedCount, selection, rootRows]);

  const showFloatingBar = showBulkSelectionControls && selectedCount > 0;

  return (
    <div
      className={cn(
        OPERATIONAL_TABLE_FONT,
        "space-y-3 border-t",
        showBulkSelectionControls ? "p-4" : "px-4 py-3",
        operationalFloatingBarContentClass(showFloatingBar)
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
        <CampaignOperationalTable>
          <CampaignOperationalTableHeader>
            <CampaignOperationalTableHeaderRow>
              <CampaignOperationalTableHead className="w-8" />
              <CampaignOperationalTableHead className="w-10" />
              <CampaignOperationalTableHead>Line</CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">
                Invoice amount
              </CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">
                Invoice %
              </CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">
                To be invoiced
              </CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">VAT</CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">
                Total invoice
              </CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">
                Remaining
              </CampaignOperationalTableHead>
            </CampaignOperationalTableHeaderRow>
          </CampaignOperationalTableHeader>
          <CampaignOperationalTableBody>
            <CampaignOperationalTableRow className="bg-muted/20 font-medium">
              <CampaignOperationalTableCell className="w-8 pr-0">
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={() => toggleExpanded(CAMPAIGN_INVOICE_DRAFT_ID)}
                  aria-expanded={campaignExpanded}
                  aria-label={
                    campaignExpanded ? "Collapse campaign assignments" : "Expand campaign assignments"
                  }
                >
                  {campaignExpanded ? (
                    <ChevronDownIcon className="size-3.5" />
                  ) : (
                    <ChevronRightIcon className="size-3.5" />
                  )}
                </button>
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="w-10 pr-0">
                <OperationalSelectionCheckbox
                  status={globalSelectionStatus}
                  onToggle={handleSelectAllToggle}
                  ariaLabel="Select all eligible operational rows"
                />
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                <p className={campaign ? "text-[11px]" : "text-sm"}>Campaign</p>
              </CampaignOperationalTableCell>
              <OperationalInvoiceDraftCells
                draft={campaignDraft}
                currency={detail.currency_code}
                editable={campaignEditable}
                percentAriaLabel="Invoice percent for campaign"
                amountAriaLabel="To be invoiced for campaign"
                onPercentChange={(percent) =>
                  handlePercentChange(CAMPAIGN_INVOICE_DRAFT_ID, percent)
                }
                onToBeInvoicedChange={(amount) =>
                  handleToBeInvoicedChange(CAMPAIGN_INVOICE_DRAFT_ID, amount)
                }
              />
            </CampaignOperationalTableRow>
            {campaignExpanded
              ? filteredRows.map((assignment) => (
                  <OperationalRowTree
                    key={assignment.id}
                    row={assignment}
                    depth={0}
                    currency={detail.currency_code}
                    rootRows={rootRows}
                    selection={selection}
                    isOpen={expanded.has(assignment.id)}
                    expandedIds={expanded}
                    percents={percents}
                    onPercentChange={handlePercentChange}
                    onToBeInvoicedChange={handleToBeInvoicedChange}
                    onToggleExpand={toggleExpanded}
                    onToggleSelect={toggleRow}
                    appearance={appearance}
                  />
                ))
              : null}
          </CampaignOperationalTableBody>
        </CampaignOperationalTable>
      )}

      {showBulkSelectionControls ? (
        <OperationalFloatingActionBar visible={showFloatingBar}>
          <PlatformFloatingBarSelection
            selectedCount={selectedCount}
            selectionLabel="row"
            onClearSelection={handleClearSelection}
          />

          <PlatformFloatingBarDivider />

          <div className="flex shrink-0 items-center gap-1.5 px-2">
            <OperationalSelectionCheckbox
              status={globalSelectionStatus}
              onToggle={handleSelectAllToggle}
              ariaLabel="Select all eligible operational rows"
            />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="hidden shrink-0 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
              onClick={handleSelectAllToggle}
            >
              Select all
            </Button>
          </div>

          {onInvoice ? (
            <>
              <PlatformFloatingBarDivider className="ml-auto" />
              <div className="pl-2">
                <PlatformFloatingBarPrimaryButton
                  action={{
                    id: "invoice",
                    label: invoicePending ? "Generating…" : "Generate invoice",
                    onClick: handleInvoiceSelected,
                    disabled: invoicePending,
                  }}
                />
              </div>
            </>
          ) : null}
        </OperationalFloatingActionBar>
      ) : null}
    </div>
  );
}

export const BillingCampaignDrilldown = memo(BillingCampaignDrilldownInner);
