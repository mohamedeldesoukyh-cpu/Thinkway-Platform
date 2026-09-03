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
import {
  InvoiceConfirmDialog,
  type InvoiceConfirmCampaignPreview,
} from "@/features/billing/components/invoice-confirm-dialog";
import type { InvoiceTargetMode } from "@/features/billing/components/invoice-target-choice-dialog";
import {
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
import {
  buildInvoiceConfirmPreview,
  CAMPAIGN_INVOICE_DRAFT_ID,
  cascadeInvoiceDraftPercent,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
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
  { id: "bill_percent", label: "Bill %" },
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
      {cols.showSelect ? <span title="Select all billable lines" /> : null}
      {cols.showExpand ? <span /> : null}
      {cols.showCampaignNo ? <span title="Campaign number">Campaign no</span> : null}
      {cols.showClient ? <span>Client</span> : null}
      {cols.showBrand ? <span>Brand</span> : null}
      {cols.showCampaign ? <span>Campaign</span> : null}
      {cols.showCurrency ? <span title="Currency">Ccy</span> : null}
      {cols.showTotal ? <span title="Campaign total">Total</span> : null}
      {cols.showAchieved ? <span title="Achieved / billable">Achieved</span> : null}
      {cols.showInvoiced ? <span title="Already invoiced plus this draft">Invoiced</span> : null}
      {cols.showRemaining ? <span title="Amount still to invoice">Remaining</span> : null}
      {cols.showBillPercent ? (
        <span title="Share of remaining to bill now. Changing this updates every line.">Bill %</span>
      ) : null}
      {cols.showUnachieved ? (
        <span title="Achieved value not yet eligible to invoice">Unachieved</span>
      ) : null}
      {cols.showStatus ? <span>Status</span> : null}
      {cols.showActions ? <span>Actions</span> : null}
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
  const [reviewOpen, setReviewOpen] = useState(false);
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
  const [confirmCampaigns, setConfirmCampaigns] = useState<InvoiceConfirmCampaignPreview[]>([]);
  const [confirmJobs, setConfirmJobs] = useState<
    Array<{ campaignId: string; selection: OperationalSelectionPayload }>
  >([]);
  const [pending, startTransition] = useTransition();
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;
  const queueSelectionsRef = useRef(queueSelections);
  queueSelectionsRef.current = queueSelections;
  const invoiceDraftPercentsRef = useRef(invoiceDraftPercentsByCampaign);
  invoiceDraftPercentsRef.current = invoiceDraftPercentsByCampaign;
  const confirmJobsRef = useRef(confirmJobs);
  confirmJobsRef.current = confirmJobs;
  const bulkRemainingRef = useRef<
    Array<{ campaignId: string; selection: OperationalSelectionPayload }>
  >([]);
  const submitInvoiceDraftRef = useRef<
    | ((input: {
        campaignId: string;
        rows: CampaignOperationalBillingDetail["operational_rows"];
        percents: InvoiceDraftPercents;
        selection: OperationalSelectionPayload;
        mode: InvoiceTargetMode;
        existingInvoiceId?: string;
      }) => boolean)
    | null
  >(null);

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

  const selectedInvoiceJobs = useMemo(() => {
    return Object.entries(queueSelections)
      .filter(([, selection]) => countSelection(selection) > 0)
      .map(([campaignId, selection]) => ({ campaignId, selection }));
  }, [queueSelections]);

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
      const next = bulkRemainingRef.current.shift();
      if (next) {
        const detail = detailCacheRef.current[next.campaignId];
        if (!detail) return;
        submitInvoiceDraftRef.current?.({
          campaignId: next.campaignId,
          rows: detail.operational_rows,
          percents: invoiceDraftPercentsRef.current[next.campaignId] ?? {},
          selection: next.selection,
          mode: "new",
        });
        return;
      }
      router.refresh();
    },
    [router, selectedCampaignId]
  );

  const { submit: submitInvoiceDraft, pending: invoicePending, pendingCampaignId } =
    useOperationalInvoiceCreate({
      onComplete: handleInvoiceComplete,
      onError: () => {
        bulkRemainingRef.current = [];
      },
    });
  submitInvoiceDraftRef.current = submitInvoiceDraft;

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
      mode: InvoiceTargetMode,
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

  const buildCampaignConfirmPreview = useCallback(
    async (
      campaignId: string,
      selection?: OperationalSelectionPayload
    ): Promise<{
      preview: InvoiceConfirmCampaignPreview;
      payload: OperationalSelectionPayload;
    } | null> => {
      const detail = await ensureDetailLoaded(campaignId);
      const campaign = campaigns.find((row) => row.campaign_header_id === campaignId);
      if (!detail || !campaign) return null;
      const payload = resolveInvoiceSelection(campaignId, selection);
      const totals = buildInvoiceConfirmPreview({
        rows: detail.operational_rows,
        percents: invoiceDraftPercentsRef.current[campaignId] ?? {},
        selection: payload,
        campaignTotal: campaign.total_campaign_amount,
        alreadyInvoiced: campaign.already_invoiced,
        remainingToInvoice: campaign.remaining_to_invoice,
      });
      if (totals.lines.length === 0) {
        showErrorToastOnce("Set Invoice % above 0 on at least one selected row.", {
          id: "invoice-generation",
        });
        return null;
      }
      return {
        payload,
        preview: {
          campaignId,
          campaignName: campaign.campaign_name,
          campaignNo: campaign.campaign_document_number,
          currency: campaign.currency_code,
          ...totals,
        },
      };
    },
    [campaigns, ensureDetailLoaded, resolveInvoiceSelection]
  );

  const openInvoiceConfirm = useCallback(
    (previews: InvoiceConfirmCampaignPreview[], jobs: typeof confirmJobs) => {
      setConfirmCampaigns(previews);
      setConfirmJobs(jobs);
      setInvoiceChoiceOpen(true);
    },
    []
  );

  const beginInvoiceFlow = useCallback(
    async (
      campaignId: string,
      selection?: OperationalSelectionPayload,
      _mode: InvoiceTargetMode | "ask" = "ask"
    ) => {
      const built = await buildCampaignConfirmPreview(campaignId, selection);
      if (!built) return;
      openInvoiceConfirm([built.preview], [{ campaignId, selection: built.payload }]);
    },
    [buildCampaignConfirmPreview, openInvoiceConfirm]
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
      setSelectedCampaignId(campaignId);
      setReviewOpen(false);
      loadDetailIfNeeded(campaignId);
    },
    [loadDetailIfNeeded]
  );

  const onOpenInvoice = useCallback(
    (campaignId: string) => {
      void beginInvoiceFlow(campaignId);
    },
    [beginInvoiceFlow]
  );

  const handleQueueInvoiceSelected = useCallback(
    async (mode: InvoiceTargetMode) => {
      if (selectedInvoiceJobs.length === 0) {
        toast.error("Select operational rows to invoice.");
        return;
      }
      if (mode === "append" && selectedInvoiceJobs.length !== 1) {
        toast.error("Append to an open invoice works on one campaign at a time.");
        return;
      }
      const previews: InvoiceConfirmCampaignPreview[] = [];
      const jobs: Array<{ campaignId: string; selection: OperationalSelectionPayload }> = [];
      for (const job of selectedInvoiceJobs) {
        const payload = buildInvoiceSelectionBatch(
          job.selection,
          detailCacheRef.current[job.campaignId]?.operational_rows ?? []
        );
        const built = await buildCampaignConfirmPreview(job.campaignId, payload);
        if (!built) return;
        previews.push(built.preview);
        jobs.push({ campaignId: job.campaignId, selection: built.payload });
      }
      openInvoiceConfirm(previews, jobs);
    },
    [buildCampaignConfirmPreview, openInvoiceConfirm, selectedInvoiceJobs]
  );

  const setCampaignInvoicePercents = useCallback(
    (campaignId: string, next: InvoiceDraftPercents) => {
      setInvoiceDraftPercentsByCampaign((prev) => ({ ...prev, [campaignId]: next }));
    },
    []
  );

  const handleCampaignPercentChange = useCallback(
    (campaignId: string, percent: number) => {
      const current = invoiceDraftPercentsRef.current[campaignId] ?? {};
      setCampaignInvoicePercents(campaignId, {
        ...current,
        [CAMPAIGN_INVOICE_DRAFT_ID]: percent,
      });
      startTransition(async () => {
        const detail = await ensureDetailLoaded(campaignId);
        if (!detail) return;
        const rows = filterOperationalBillingTree(detail.operational_rows, operationalFilter);
        setCampaignInvoicePercents(
          campaignId,
          cascadeInvoiceDraftPercent(
            rows,
            CAMPAIGN_INVOICE_DRAFT_ID,
            percent,
            invoiceDraftPercentsRef.current[campaignId] ?? {}
          )
        );
      });
    },
    [ensureDetailLoaded, operationalFilter, setCampaignInvoicePercents]
  );

  const handleClearQueueSelection = useCallback(() => {
    setQueueSelections({});
  }, []);

  const reviewDetail = selectedCampaignId ? detailCache[selectedCampaignId] : null;
  const reviewLoading =
    pending && selectedCampaignId !== null && !detailCache[selectedCampaignId ?? ""];
  const confirmAppendableInvoices =
    confirmJobs.length === 1
      ? (detailCache[confirmJobs[0]!.campaignId]?.appendable_invoices ?? [])
      : [];

  useEffect(() => {
    if (!selectedCampaignId || !reviewOpen) return;
    reviewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCampaignId, reviewOpen, reviewDetail]);

  return (
    <div>
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
                    onCampaignPercentChange={(percent) =>
                      handleCampaignPercentChange(campaignId, percent)
                    }
                    invoicePending={pendingCampaignId === campaignId}
                    invoiceDisabled={Boolean(pendingCampaignId)}
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
              invoicePending={pendingCampaignId === selectedCampaignId}
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
          {selectedInvoiceJobs.length === 0
            ? "Select rows to invoice"
            : selectedInvoiceJobs.length === 1
              ? (campaigns.find((c) => c.campaign_header_id === selectedInvoiceJobs[0]!.campaignId)
                  ?.campaign_name ?? "Campaign")
              : `${selectedInvoiceJobs.length} campaigns selected`}
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
              label: invoicePending
                ? "Generating…"
                : selectedInvoiceJobs.length > 1
                  ? `Invoice ${selectedInvoiceJobs.length} campaigns`
                  : "Create new invoice",
              disabled: selectedInvoiceJobs.length === 0 || invoicePending,
              onClick: () => void handleQueueInvoiceSelected("new"),
            }}
          />
          <PlatformFloatingBarSecondaryLink
            action={{
              id: "append-invoice",
              label: invoicePending ? "Generating…" : "Append to open invoice",
              disabled: selectedInvoiceJobs.length !== 1 || invoicePending,
              onClick: () => void handleQueueInvoiceSelected("append"),
            }}
          />
        </div>
      </OperationalFloatingActionBar>

      <InvoiceConfirmDialog
        open={invoiceChoiceOpen && confirmCampaigns.length > 0}
        onOpenChange={(open) => {
          setInvoiceChoiceOpen(open);
          if (!open) {
            setConfirmCampaigns([]);
            setConfirmJobs([]);
          }
        }}
        campaigns={confirmCampaigns}
        appendableInvoices={confirmAppendableInvoices}
        pending={invoicePending}
        onConfirm={(mode, existingInvoiceId) => {
          const jobs = confirmJobsRef.current;
          if (jobs.length === 0) return;
          setInvoiceChoiceOpen(false);
          const [first, ...rest] = jobs;
          bulkRemainingRef.current = rest;
          void submitForCampaign(
            first!.campaignId,
            first!.selection,
            rest.length > 0 ? "new" : mode,
            rest.length > 0 ? undefined : existingInvoiceId
          );
        }}
      />
    </div>
  );
}
