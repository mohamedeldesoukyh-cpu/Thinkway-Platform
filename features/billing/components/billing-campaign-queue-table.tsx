"use client";

import type { ReactNode } from "react";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSecondaryLink,
  PlatformFloatingBarSelection,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
} from "@/features/campaigns/components/campaign-operational-table";
import {
  BillingQueueCampaignRow,
  computeCampaignMasterStatus,
} from "@/features/billing/components/billing-queue-campaign-row";
import {
  BILLING_CAMPAIGN_REVIEW_LINES_COLUMN_METAS,
  BillingCampaignReviewPanel,
} from "@/features/billing/components/billing-campaign-review-panel";
import { BillingFinanceFilterBar } from "@/features/billing/components/billing-finance-filter-bar";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import {
  loadCampaignBillingDetailAction,
  refreshBillingAfterInvoiceAction,
} from "@/features/billing/actions";
import type {
  CampaignBillingQueueRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import {
  buildInvoiceSelectionBatch,
  clearOperationalSelection,
  countSelection,
  createEmptySelection,
  selectAllOperationalRows,
  selectionToSubmitPayload,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import {
  filterOperationalBillingTree,
  mapCampaignQueueFilterToOperational,
} from "@/lib/billing/operational-row-filters";
import { selectionStateEqual } from "@/lib/billing/selection-state";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  filterCampaignQueueRows,
  type CampaignBillingQueueFilter,
} from "@/lib/billing/campaign-billing-queue";
import { devLog } from "@/lib/dev-log";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import {
  BILLING_CAMPAIGN_QUEUE_FILTER_ACCESSORS,
  BILLING_CAMPAIGN_REVIEW_LINES_FILTER_ACCESSORS,
} from "@/lib/tables/workspace-table-filter-fields";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

export const BILLING_CAMPAIGN_QUEUE_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "expand", label: "Expand", locked: true },
  { id: "select", label: "Select", locked: true },
  { id: "campaign_no", label: "Campaign No" },
  { id: "client", label: "Client" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "currency", label: "Currency" },
  { id: "total", label: "Total" },
  { id: "achieved", label: "Achieved" },
  { id: "invoiced", label: "Invoiced" },
  { id: "remaining", label: "Remaining" },
  { id: "unachieved", label: "Unachieved" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions", locked: true },
];

type BillingCampaignQueueTableProps = {
  campaigns: CampaignBillingQueueRow[];
  settingsSlot?: ReactNode;
};

function BillingCampaignQueueTableHeader() {
  const showExpand = useIsOperationalColumnVisible("expand");
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNo = useIsOperationalColumnVisible("campaign_no");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showCampaign = useIsOperationalColumnVisible("campaign");
  const showCurrency = useIsOperationalColumnVisible("currency");
  const showTotal = useIsOperationalColumnVisible("total");
  const showAchieved = useIsOperationalColumnVisible("achieved");
  const showInvoiced = useIsOperationalColumnVisible("invoiced");
  const showRemaining = useIsOperationalColumnVisible("remaining");
  const showUnachieved = useIsOperationalColumnVisible("unachieved");
  const showStatus = useIsOperationalColumnVisible("status");
  const showActions = useIsOperationalColumnVisible("actions");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showExpand ? <CampaignOperationalTableHead className="w-8" /> : null}
        {showSelect ? <CampaignOperationalTableHead className="w-8" /> : null}
        {showCampaignNo ? <CampaignOperationalTableHead>Campaign No</CampaignOperationalTableHead> : null}
        {showClient ? <CampaignOperationalTableHead>Client</CampaignOperationalTableHead> : null}
        {showBrand ? <CampaignOperationalTableHead>Brand</CampaignOperationalTableHead> : null}
        {showCampaign ? <CampaignOperationalTableHead>Campaign</CampaignOperationalTableHead> : null}
        {showCurrency ? <CampaignOperationalTableHead>Currency</CampaignOperationalTableHead> : null}
        {showTotal ? (
          <CampaignOperationalTableHead className="text-right">Total</CampaignOperationalTableHead>
        ) : null}
        {showAchieved ? (
          <CampaignOperationalTableHead className="text-right">Achieved</CampaignOperationalTableHead>
        ) : null}
        {showInvoiced ? (
          <CampaignOperationalTableHead className="text-right">Invoiced</CampaignOperationalTableHead>
        ) : null}
        {showRemaining ? (
          <CampaignOperationalTableHead className="text-right">Remaining</CampaignOperationalTableHead>
        ) : null}
        {showUnachieved ? (
          <CampaignOperationalTableHead className="text-right">Unachieved</CampaignOperationalTableHead>
        ) : null}
        {showStatus ? <CampaignOperationalTableHead>Status</CampaignOperationalTableHead> : null}
        {showActions ? (
          <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

export function BillingCampaignQueueTable({
  campaigns,
  settingsSlot,
}: BillingCampaignQueueTableProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<CampaignBillingQueueFilter>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<
    Record<string, CampaignOperationalBillingDetail>
  >({});
  const [queueSelections, setQueueSelections] = useState<
    Record<string, OperationalSelectionState>
  >({});
  const [invoiceCampaignId, setInvoiceCampaignId] = useState<string | null>(null);
  const [invoiceSelection, setInvoiceSelection] = useState<OperationalSelectionPayload | undefined>();
  const [invoiceTargetMode, setInvoiceTargetMode] = useState<"new" | "append">("new");
  const [pending, startTransition] = useTransition();
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;
  const queueSelectionsRef = useRef(queueSelections);
  queueSelectionsRef.current = queueSelections;

  const operationalFilter = mapCampaignQueueFilterToOperational(filter);

  const suiteRows =
    useOperationalTableDataContextOptional<CampaignBillingQueueRow>()?.processedRows ??
    campaigns;

  const filtered = useMemo(
    () => filterCampaignQueueRows(suiteRows, filter),
    [suiteRows, filter]
  );

  const filteredRollup = useMemo(() => {
    return filtered.reduce(
      (acc, row) => ({
        total: acc.total + row.total_campaign_amount,
        achieved: acc.achieved + row.achieved_revenue,
        invoiced: acc.invoiced + row.already_invoiced,
        remaining: acc.remaining + row.remaining_to_invoice,
      }),
      { total: 0, achieved: 0, invoiced: 0, remaining: 0 }
    );
  }, [filtered]);

  const filteredRollupCurrency = useMemo(() => {
    const codes = [...new Set(filtered.map((row) => row.currency_code))];
    return codes.length === 1 ? codes[0] : null;
  }, [filtered]);

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => row.campaign_header_id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const totalQueueSelected = useMemo(() => {
    return Object.values(queueSelections).reduce(
      (sum, selection) => sum + countSelection(selection),
      0
    );
  }, [queueSelections]);

  const invoiceContext = useMemo(() => {
    const active = Object.entries(queueSelections).filter(
      ([, selection]) => countSelection(selection) > 0
    );
    if (active.length !== 1) return null;
    const [campaignId, selection] = active[0]!;
    return {
      campaignId,
      payload: buildInvoiceSelectionBatch(
        selection,
        detailCache[campaignId]?.operational_rows ?? []
      ),
    };
  }, [queueSelections, detailCache]);

  const ensureDetailLoaded = useCallback(
    async (campaignId: string): Promise<CampaignOperationalBillingDetail | null> => {
      const cached = detailCacheRef.current[campaignId];
      if (cached) return cached;
      const result = await loadCampaignBillingDetailAction(campaignId);
      if (result.ok && result.detail) {
        setDetailCache((prev) => ({ ...prev, [campaignId]: result.detail! }));
        return result.detail;
      }
      toast.error(result.ok ? "No detail returned." : result.message);
      return null;
    },
    []
  );

  const loadDetailIfNeeded = useCallback(
    (campaignId: string) => {
      if (detailCacheRef.current[campaignId]) return;
      devLog("[queue-drilldown] loading campaign operational billing", { campaignId });
      startTransition(async () => {
        await ensureDetailLoaded(campaignId);
      });
    },
    [ensureDetailLoaded]
  );

  const openInvoiceWorkflow = useCallback(
    async (
      campaignId: string,
      selection?: OperationalSelectionPayload,
      mode: "new" | "append" = "new"
    ) => {
      setInvoiceSelection(selection);
      setInvoiceTargetMode(mode);
      const detail = await ensureDetailLoaded(campaignId);
      if (detail) setInvoiceCampaignId(campaignId);
    },
    [ensureDetailLoaded]
  );

  const setQueueSelection = useCallback(
    (campaignId: string, selection: OperationalSelectionState) => {
      setQueueSelections((prev) => {
        const existing = prev[campaignId];
        if (existing && selectionStateEqual(existing, selection)) return prev;
        return { ...prev, [campaignId]: selection };
      });
    },
    []
  );

  const onToggleExpand = useCallback(
    (campaignId: string) => {
      setExpandedCampaignIds((prev) => {
        const next = new Set(prev);
        if (next.has(campaignId)) next.delete(campaignId);
        else next.add(campaignId);
        return next;
      });
      loadDetailIfNeeded(campaignId);
    },
    [loadDetailIfNeeded]
  );

  const handleInvoiceComplete = useCallback(
    async (completedCampaignId: string) => {
      devLog("[queue-refresh] reloading billing data after invoice", {
        campaignId: completedCampaignId,
      });
      setDetailCache((prev) => {
        const next = { ...prev };
        delete next[completedCampaignId];
        return next;
      });
      setQueueSelections((prev) => {
        const next = { ...prev };
        delete next[completedCampaignId];
        return next;
      });
      setExpandedCampaignIds((prev) => new Set(prev).add(completedCampaignId));
      const result = await refreshBillingAfterInvoiceAction(completedCampaignId);
      if (result.ok && result.detail) {
        setDetailCache((prev) => ({
          ...prev,
          [completedCampaignId]: result.detail!,
        }));
        if (selectedCampaignId === completedCampaignId) {
          devLog("[queue-refresh] review panel detail refreshed", {
            campaignId: completedCampaignId,
          });
        }
      }
      router.refresh();
    },
    [router, selectedCampaignId]
  );

  const onMasterSelect = useCallback(
    async (campaignId: string) => {
      const detail = await ensureDetailLoaded(campaignId);
      if (!detail) return;

      const filteredRows = filterOperationalBillingTree(
        detail.operational_rows,
        operationalFilter
      );
      const current = queueSelectionsRef.current[campaignId] ?? createEmptySelection();
      const status = computeCampaignMasterStatus(detail, current, operationalFilter);

      if (status === "checked") {
        setQueueSelection(campaignId, clearOperationalSelection());
      } else {
        setQueueSelection(campaignId, selectAllOperationalRows(filteredRows));
      }
    },
    [ensureDetailLoaded, operationalFilter, setQueueSelection]
  );

  const onSelectForReview = useCallback(
    (campaignId: string) => {
      if (selectedCampaignId === campaignId) {
        setReviewOpen((prev) => !prev);
        return;
      }
      setSelectedCampaignId(campaignId);
      setReviewOpen(true);
      loadDetailIfNeeded(campaignId);
    },
    [selectedCampaignId, loadDetailIfNeeded]
  );

  const onOpenInvoice = useCallback(
    (campaignId: string) => {
      const selection = queueSelectionsRef.current[campaignId] ?? createEmptySelection();
      const rows = detailCacheRef.current[campaignId]?.operational_rows ?? [];
      openInvoiceWorkflow(campaignId, selectionToSubmitPayload(selection, rows));
    },
    [openInvoiceWorkflow]
  );

  const handleQueueInvoiceSelected = useCallback(
    (mode: "new" | "append") => {
      if (!invoiceContext) {
        toast.error("Select operational rows within one campaign to invoice.");
        return;
      }
      devLog("[queue-drilldown] invoice selected from billing queue", {
        campaignId: invoiceContext.campaignId,
        mode,
      });
      openInvoiceWorkflow(invoiceContext.campaignId, invoiceContext.payload, mode);
    },
    [invoiceContext, openInvoiceWorkflow]
  );

  const handleClearQueueSelection = useCallback(() => {
    setQueueSelections({});
  }, []);

  const invoiceDetail = invoiceCampaignId ? detailCache[invoiceCampaignId] : null;
  const reviewDetail = selectedCampaignId ? detailCache[selectedCampaignId] : null;
  const reviewLoading =
    pending && selectedCampaignId !== null && !detailCache[selectedCampaignId ?? ""];

  useEffect(() => {
    if (!selectedCampaignId || !reviewOpen) return;
    reviewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCampaignId, reviewOpen, reviewDetail]);

  return (
    <div className="space-y-4">
      <BillingFinanceFilterBar
        value={filter}
        onChange={(value) => {
          setFilter(value);
          devLog("[queue-filter] billing queue filter changed", { filter: value });
        }}
      />

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        className={operationalFloatingBarContentClass(totalQueueSelected > 0)}
        leading={
          <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Billing queue
                </h2>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  One row per campaign — check a campaign to select all billable rows, or expand to
                  adjust individual lines.
                </p>
                {filter !== "all" && filtered.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Filtered rollup ({filtered.length} campaign{filtered.length === 1 ? "" : "s"}):{" "}
                    achieved{" "}
                    {filteredRollupCurrency
                      ? formatBillingMoneyCompact(filteredRollup.achieved, filteredRollupCurrency)
                      : filteredRollup.achieved.toLocaleString()}{" "}
                    · invoiced{" "}
                    {filteredRollupCurrency
                      ? formatBillingMoneyCompact(filteredRollup.invoiced, filteredRollupCurrency)
                      : filteredRollup.invoiced.toLocaleString()}{" "}
                    · remaining{" "}
                    {filteredRollupCurrency
                      ? formatBillingMoneyCompact(filteredRollup.remaining, filteredRollupCurrency)
                      : filteredRollup.remaining.toLocaleString()}
                    {!filteredRollupCurrency ? " (mixed currencies)" : null}
                  </p>
                ) : null}
              </div>
              {settingsSlot}
            </div>
          </div>
        }
      >
        {campaigns.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No campaigns in the billing queue yet. Campaigns appear here once they have billing
            lines or operational revenue.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No campaigns match this finance filter.
          </p>
        ) : (
          <CampaignOperationalTable>
            <BillingCampaignQueueTableHeader />
            <CampaignOperationalTableBody>
              {filtered.map((row) => {
                const campaignId = row.campaign_header_id;
                const detail = detailCache[campaignId];
                const selection = queueSelections[campaignId] ?? createEmptySelection();

                return (
                  <BillingQueueCampaignRow
                    key={campaignId}
                    row={row}
                    operationalFilter={operationalFilter}
                    expanded={expandedCampaignIds.has(campaignId)}
                    selectedForReview={selectedCampaignId === campaignId}
                    detail={detail}
                    detailLoading={pending}
                    selection={selection}
                    onToggleExpand={onToggleExpand}
                    onMasterSelect={onMasterSelect}
                    onSelectForReview={onSelectForReview}
                    onSelectionChange={setQueueSelection}
                    onOpenInvoice={onOpenInvoice}
                  />
                );
              })}
            </CampaignOperationalTableBody>
          </CampaignOperationalTable>
        )}
      </OperationalTableSection>

      {selectedCampaign ? (
        <div ref={reviewPanelRef}>
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.billingCampaignReviewLines}
            columns={operationalColumnsFromMetas(
              BILLING_CAMPAIGN_REVIEW_LINES_COLUMN_METAS,
              BILLING_CAMPAIGN_REVIEW_LINES_FILTER_ACCESSORS
            )}
            rows={reviewDetail?.operational_rows ?? []}
            filterAccessors={BILLING_CAMPAIGN_REVIEW_LINES_FILTER_ACCESSORS}
          >
            <BillingCampaignReviewPanel
              campaignName={selectedCampaign.campaign_name}
              campaignDocumentNumber={selectedCampaign.campaign_document_number}
              detail={reviewDetail}
              loading={reviewLoading}
              filter={filter}
              open={reviewOpen}
              onOpenChange={setReviewOpen}
            />
          </OperationalTableSuiteProvider>
        </div>
      ) : null}

      <OperationalFloatingActionBar visible={totalQueueSelected > 0}>
        <PlatformFloatingBarSelection
          selectedCount={totalQueueSelected}
          selectionLabel="row"
          onClearSelection={handleClearQueueSelection}
        />

        <PlatformFloatingBarDivider />

        <span className="shrink-0 px-2 text-xs text-muted-foreground">
          {invoiceContext
            ? (campaigns.find((c) => c.campaign_header_id === invoiceContext.campaignId)
                ?.campaign_name ?? "Campaign")
            : "Select rows in one campaign only"}
        </span>

        <PlatformFloatingBarDivider className="ml-auto" />

        <div className="flex shrink-0 items-center gap-1 pl-2">
          <PlatformFloatingBarPrimaryButton
            action={{
              id: "new-invoice",
              label: "Create new invoice",
              disabled: !invoiceContext,
              onClick: () => handleQueueInvoiceSelected("new"),
            }}
          />
          <PlatformFloatingBarSecondaryLink
            action={{
              id: "append-invoice",
              label: "Append to open invoice",
              disabled: !invoiceContext,
              onClick: () => handleQueueInvoiceSelected("append"),
            }}
          />
        </div>
      </OperationalFloatingActionBar>

      {invoiceCampaignId && invoiceDetail ? (
        <InvoiceGenerationSheet
          campaignId={invoiceCampaignId}
          currency={invoiceDetail.currency_code}
          rollup={invoiceDetail.rollup}
          operationalRows={invoiceDetail.operational_rows}
          appendableInvoices={invoiceDetail.appendable_invoices}
          defaultVatPercent={invoiceDetail.default_vat_percent}
          initialSelection={invoiceSelection}
          targetMode={invoiceTargetMode}
          open
          onInvoiceComplete={handleInvoiceComplete}
          onOpenChange={(open) => {
            if (!open) {
              setInvoiceCampaignId(null);
              setInvoiceSelection(undefined);
              setInvoiceTargetMode("new");
            }
          }}
        />
      ) : null}
    </div>
  );
}
