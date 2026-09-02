"use client";

import type { ReactNode } from "react";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSecondaryLink,
  PlatformFloatingBarSelection,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import { BillingCardHeader } from "@/features/billing/components/billing-card-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import {
  BillingQueueCampaignRow,
  computeCampaignMasterStatus,
} from "@/features/billing/components/billing-queue-campaign-row";
import {
  BILLING_CAMPAIGN_REVIEW_LINES_COLUMN_METAS,
  BillingCampaignReviewPanel,
} from "@/features/billing/components/billing-campaign-review-panel";
import {
  BILLING_FINANCE_FILTER_OPTIONS,
  BillingFinanceFilterBar,
} from "@/features/billing/components/billing-finance-filter-bar";
import {
  BillingQueueGrid,
  BillingQueueGridRow,
  BillingQueueTotalsRow,
  useBillingQueueGridTemplate,
} from "@/features/billing/components/billing-queue-assignment-row";
import { InvoiceTargetChoiceDialog } from "@/features/billing/components/invoice-target-choice-dialog";
import {
  eligibleAppendableInvoices,
  useOperationalInvoiceCreate,
} from "@/features/billing/hooks/use-operational-invoice-create";
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
  countSubmitPayload,
  createEmptySelection,
  payloadToSelection,
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
import { buildConsolidatedQueueInvoiceSelection } from "@/lib/billing/consolidated-invoice-queue";
import type { InvoiceDraftPercents } from "@/lib/billing/operational-invoice-draft";
import { showErrorToastOnce } from "@/lib/ui/toast-once";
import { devLog } from "@/lib/dev-log";
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
  const { cols, template } = useBillingQueueGridTemplate();

  return (
    <BillingQueueGridRow className="bq-hrow" template={template}>
      {cols.showSelect ? <span /> : null}
      {cols.showExpand ? <span /> : null}
      {cols.showCampaignNo ? <span>Campaign no</span> : null}
      {cols.showClient ? <span>Client</span> : null}
      {cols.showBrand ? <span>Brand</span> : null}
      {cols.showCampaign ? <span>Campaign</span> : null}
      {cols.showCurrency ? <span>Ccy</span> : null}
      {cols.showTotal ? <span className="bq-rr">Total</span> : null}
      {cols.showAchieved ? <span className="bq-rr">Achieved</span> : null}
      {cols.showInvoiced ? <span className="bq-rr">Invoiced</span> : null}
      {cols.showRemaining ? <span className="bq-rr">Remaining</span> : null}
      {cols.showUnachieved ? <span className="bq-rr">Unachieved</span> : null}
      {cols.showStatus ? <span>Status</span> : null}
      {cols.showActions ? <span className="bq-rr">Actions</span> : null}
    </BillingQueueGridRow>
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
  const [invoiceDraftPercentsByCampaign, setInvoiceDraftPercentsByCampaign] = useState<
    Record<string, InvoiceDraftPercents>
  >({});
  const [invoiceChoiceOpen, setInvoiceChoiceOpen] = useState(false);
  const [invoiceChoiceCampaignId, setInvoiceChoiceCampaignId] = useState<string | null>(null);
  const [invoiceSelection, setInvoiceSelection] = useState<OperationalSelectionPayload | undefined>();
  const [pending, startTransition] = useTransition();
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;
  const queueSelectionsRef = useRef(queueSelections);
  queueSelectionsRef.current = queueSelections;
  const invoiceDraftPercentsRef = useRef(invoiceDraftPercentsByCampaign);
  invoiceDraftPercentsRef.current = invoiceDraftPercentsByCampaign;

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

  const filterCounts = useMemo(() => {
    return Object.fromEntries(
      BILLING_FINANCE_FILTER_OPTIONS.map((opt) => [
        opt.value,
        filterCampaignQueueRows(suiteRows, opt.value).length,
      ])
    ) as Record<CampaignBillingQueueFilter, number>;
  }, [suiteRows]);

  const selectedRemainingByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const [campaignId, selection] of Object.entries(queueSelections)) {
      if (countSelection(selection) === 0) continue;
      const campaign = campaigns.find((row) => row.campaign_header_id === campaignId);
      if (!campaign) continue;
      map.set(
        campaign.currency_code,
        (map.get(campaign.currency_code) ?? 0) + campaign.remaining_to_invoice
      );
    }
    return [...map.entries()];
  }, [campaigns, queueSelections]);

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
      setInvoiceDraftPercentsByCampaign((prev) => {
        const next = { ...prev };
        delete next[completedCampaignId];
        return next;
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

  const { submit: submitInvoiceDraft, pending: invoicePending } = useOperationalInvoiceCreate({
    onComplete: handleInvoiceComplete,
  });

  const resolveInvoiceSelection = useCallback(
    (campaignId: string, selection?: OperationalSelectionPayload): OperationalSelectionPayload => {
      const rows = detailCacheRef.current[campaignId]?.operational_rows ?? [];
      if (selection && countSubmitPayload(selection) > 0) {
        return selectionToSubmitPayload(payloadToSelection(selection), rows);
      }
      const queued = queueSelectionsRef.current[campaignId];
      if (queued && countSelection(queued) > 0) {
        return selectionToSubmitPayload(queued, rows);
      }
      return buildConsolidatedQueueInvoiceSelection(rows);
    },
    []
  );

  const submitForCampaign = useCallback(
    async (
      campaignId: string,
      selection: OperationalSelectionPayload | undefined,
      mode: "new" | "append",
      existingInvoiceId?: string
    ) => {
      const detail = await ensureDetailLoaded(campaignId);
      if (!detail) return;
      submitInvoiceDraft({
        campaignId,
        rows: detail.operational_rows,
        percents: invoiceDraftPercentsRef.current[campaignId] ?? {},
        selection: resolveInvoiceSelection(campaignId, selection),
        mode,
        existingInvoiceId,
      });
    },
    [ensureDetailLoaded, resolveInvoiceSelection, submitInvoiceDraft]
  );

  const beginInvoiceFlow = useCallback(
    async (
      campaignId: string,
      selection?: OperationalSelectionPayload,
      mode: "new" | "append" | "ask" = "ask"
    ) => {
      const detail = await ensureDetailLoaded(campaignId);
      if (!detail) return;
      const payload = resolveInvoiceSelection(campaignId, selection);
      const eligible = eligibleAppendableInvoices(detail.appendable_invoices);

      if (mode === "new") {
        await submitForCampaign(campaignId, payload, "new");
        return;
      }

      if (mode === "append") {
        if (eligible.length === 0) {
          showErrorToastOnce("No open invoice to append to. Create a new invoice instead.", {
            id: "invoice-generation",
          });
          return;
        }
        setInvoiceSelection(payload);
        setInvoiceChoiceCampaignId(campaignId);
        setInvoiceChoiceOpen(true);
        return;
      }

      if (eligible.length > 0) {
        setInvoiceSelection(payload);
        setInvoiceChoiceCampaignId(campaignId);
        setInvoiceChoiceOpen(true);
        return;
      }

      await submitForCampaign(campaignId, payload, "new");
    },
    [ensureDetailLoaded, resolveInvoiceSelection, submitForCampaign]
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
      void beginInvoiceFlow(campaignId);
    },
    [beginInvoiceFlow]
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
      void beginInvoiceFlow(invoiceContext.campaignId, invoiceContext.payload, mode);
    },
    [invoiceContext, beginInvoiceFlow]
  );

  const setCampaignInvoicePercents = useCallback(
    (campaignId: string, next: InvoiceDraftPercents) => {
      setInvoiceDraftPercentsByCampaign((prev) => ({ ...prev, [campaignId]: next }));
    },
    []
  );

  const handleClearQueueSelection = useCallback(() => {
    setQueueSelections({});
  }, []);

  const reviewDetail = selectedCampaignId ? detailCache[selectedCampaignId] : null;
  const reviewLoading =
    pending && selectedCampaignId !== null && !detailCache[selectedCampaignId ?? ""];
  const invoiceChoiceDetail = invoiceChoiceCampaignId
    ? detailCache[invoiceChoiceCampaignId]
    : null;

  useEffect(() => {
    if (!selectedCampaignId || !reviewOpen) return;
    reviewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCampaignId, reviewOpen, reviewDetail]);

  return (
    <div className="space-y-4">
      <BillingFinanceFilterBar
        value={filter}
        counts={filterCounts}
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
          <>
            <BillingCardHeader
              title="Billing queue"
              subtitle="One row per campaign — check a campaign to select all billable lines, or expand to adjust individual lines"
              actions={settingsSlot}
            />
            {filter !== "all" && filtered.length > 0 ? (
              <span className="bq-card__s" style={{ flexBasis: "100%" }}>
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
              </span>
            ) : null}
          </>
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
          <BillingQueueGrid>
            <BillingCampaignQueueTableHeader />
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
                    invoicePercents={invoiceDraftPercentsByCampaign[campaignId] ?? {}}
                    onInvoicePercentsChange={(next) =>
                      setCampaignInvoicePercents(campaignId, next)
                    }
                    invoicePending={invoicePending}
                    onToggleExpand={onToggleExpand}
                    onMasterSelect={onMasterSelect}
                    onSelectForReview={onSelectForReview}
                    onSelectionChange={setQueueSelection}
                    onOpenInvoice={onOpenInvoice}
                  />
                );
              })}
              <BillingQueueTotalsRow
                campaignCount={filtered.length}
                currency={filteredRollupCurrency}
                total={filteredRollup.total}
                invoiced={filteredRollup.invoiced}
                remaining={filteredRollup.remaining}
              />
          </BillingQueueGrid>
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
              selection={
                selectedCampaignId
                  ? (queueSelections[selectedCampaignId] ?? createEmptySelection())
                  : createEmptySelection()
              }
              onSelectionChange={(next) => {
                if (selectedCampaignId) setQueueSelection(selectedCampaignId, next);
              }}
              invoicePercents={
                selectedCampaignId
                  ? (invoiceDraftPercentsByCampaign[selectedCampaignId] ?? {})
                  : {}
              }
              onInvoicePercentsChange={(next) => {
                if (selectedCampaignId) setCampaignInvoicePercents(selectedCampaignId, next);
              }}
              invoicePending={invoicePending}
              onInvoice={(payload) => {
                if (selectedCampaignId) void beginInvoiceFlow(selectedCampaignId, payload);
              }}
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
        {selectedRemainingByCurrency.length > 0 ? (
          <span className="flex gap-4 border-l border-border/60 pl-3">
            {selectedRemainingByCurrency.map(([code, amount]) => (
              <span key={code} className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {code} remaining
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {formatBillingMoneyCompact(amount, code)}
                </span>
              </span>
            ))}
          </span>
        ) : null}
        {selectedRemainingByCurrency.length > 1 ? (
          <span className="bq-mix">
            {selectedRemainingByCurrency.length} currencies — one invoice per currency
          </span>
        ) : null}

        <PlatformFloatingBarDivider className="ml-auto" />

        <div className="flex shrink-0 items-center gap-1 pl-2">
          <PlatformFloatingBarPrimaryButton
            action={{
              id: "new-invoice",
              label: invoicePending ? "Generating…" : "Create new invoice",
              disabled: !invoiceContext || invoicePending,
              onClick: () => handleQueueInvoiceSelected("new"),
            }}
          />
          <PlatformFloatingBarSecondaryLink
            action={{
              id: "append-invoice",
              label: invoicePending ? "Generating…" : "Append to open invoice",
              disabled: !invoiceContext || invoicePending,
              onClick: () => handleQueueInvoiceSelected("append"),
            }}
          />
        </div>
      </OperationalFloatingActionBar>

      <InvoiceTargetChoiceDialog
        open={invoiceChoiceOpen && Boolean(invoiceChoiceDetail)}
        onOpenChange={(open) => {
          setInvoiceChoiceOpen(open);
          if (!open) {
            setInvoiceChoiceCampaignId(null);
            setInvoiceSelection(undefined);
          }
        }}
        appendableInvoices={invoiceChoiceDetail?.appendable_invoices ?? []}
        onConfirm={(mode, existingInvoiceId) => {
          if (!invoiceChoiceCampaignId) return;
          void submitForCampaign(
            invoiceChoiceCampaignId,
            invoiceSelection,
            mode,
            existingInvoiceId
          );
        }}
      />
    </div>
  );
}
