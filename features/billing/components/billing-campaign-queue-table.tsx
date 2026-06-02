"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BillingQueueCampaignRow,
  computeCampaignMasterStatus,
} from "@/features/billing/components/billing-queue-campaign-row";
import { BillingCampaignReviewPanel } from "@/features/billing/components/billing-campaign-review-panel";
import { BillingFinanceFilterBar } from "@/features/billing/components/billing-finance-filter-bar";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import { loadCampaignBillingDetailAction } from "@/features/billing/actions";
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
  selectionToPayload,
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

type BillingCampaignQueueTableProps = {
  campaigns: CampaignBillingQueueRow[];
};

export function BillingCampaignQueueTable({ campaigns }: BillingCampaignQueueTableProps) {
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
  const [invoiceInitialMode, setInvoiceInitialMode] = useState<"new" | "append">("new");
  const [pending, startTransition] = useTransition();
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const detailCacheRef = useRef(detailCache);
  detailCacheRef.current = detailCache;
  const queueSelectionsRef = useRef(queueSelections);
  queueSelectionsRef.current = queueSelections;

  const operationalFilter = mapCampaignQueueFilterToOperational(filter);

  const filtered = useMemo(
    () => filterCampaignQueueRows(campaigns, filter),
    [campaigns, filter]
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
      setInvoiceInitialMode(mode);
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
      openInvoiceWorkflow(campaignId, selectionToPayload(selection));
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

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Billing queue</CardTitle>
              <p className="text-sm text-muted-foreground">
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
          </div>

          {totalQueueSelected > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2">
              <span className="px-2 text-xs font-medium text-muted-foreground">
                {totalQueueSelected} row{totalQueueSelected === 1 ? "" : "s"} selected
                {invoiceContext
                  ? ` · ${campaigns.find((c) => c.campaign_header_id === invoiceContext.campaignId)?.campaign_name ?? "Campaign"}`
                  : " · select rows in one campaign only"}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!invoiceContext}
                onClick={() => handleQueueInvoiceSelected("new")}
              >
                Invoice selected
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!invoiceContext}
                onClick={() => handleQueueInvoiceSelected("append")}
              >
                Append to existing invoice
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleClearQueueSelection}>
                Clear selection
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns in the billing queue yet. Campaigns appear here once they have billing
              lines or operational revenue.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns match this finance filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="w-8" />
                    <TableHead>Campaign No</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Achieved</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Unachieved</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const campaignId = row.campaign_header_id;
                    const detail = detailCache[campaignId];
                    const selection =
                      queueSelections[campaignId] ?? createEmptySelection();

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
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCampaign ? (
        <div ref={reviewPanelRef}>
          <BillingCampaignReviewPanel
            campaignName={selectedCampaign.campaign_name}
            campaignDocumentNumber={selectedCampaign.campaign_document_number}
            detail={reviewDetail}
            loading={reviewLoading}
            filter={filter}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
          />
        </div>
      ) : null}

      {invoiceCampaignId && invoiceDetail ? (
        <InvoiceGenerationSheet
          campaignId={invoiceCampaignId}
          currency={invoiceDetail.currency_code}
          rollup={invoiceDetail.rollup}
          operationalRows={invoiceDetail.operational_rows}
          appendableInvoices={invoiceDetail.appendable_invoices}
          initialSelection={invoiceSelection}
          initialInvoiceMode={invoiceInitialMode}
          open
          onOpenChange={(open) => {
            if (!open) {
              setInvoiceCampaignId(null);
              setInvoiceSelection(undefined);
              setInvoiceInitialMode("new");
            }
          }}
        />
      ) : null}
    </div>
  );
}
