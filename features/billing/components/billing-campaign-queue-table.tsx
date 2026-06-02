"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { BillingCampaignReviewPanel } from "@/features/billing/components/billing-campaign-review-panel";
import { BillingFinanceFilterBar } from "@/features/billing/components/billing-finance-filter-bar";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import { loadCampaignBillingDetailAction } from "@/features/billing/actions";
import type {
  CampaignBillingQueueRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import {
  filterCampaignQueueRows,
  type CampaignBillingQueueFilter,
} from "@/lib/billing/campaign-billing-queue";
import { cn } from "@/lib/utils";

type BillingCampaignQueueTableProps = {
  campaigns: CampaignBillingQueueRow[];
};

export function BillingCampaignQueueTable({ campaigns }: BillingCampaignQueueTableProps) {
  const [filter, setFilter] = useState<CampaignBillingQueueFilter>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [detailCache, setDetailCache] = useState<
    Record<string, CampaignOperationalBillingDetail>
  >({});
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [invoiceCampaignId, setInvoiceCampaignId] = useState<string | null>(null);
  const [invoiceSelection, setInvoiceSelection] = useState<OperationalSelectionPayload | undefined>();
  const [pending, startTransition] = useTransition();

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

  const loadDetail = useCallback(
    (campaignId: string) => {
      if (detailCache[campaignId]) return;
      if (process.env.NODE_ENV === "development") {
        console.debug("[queue-drilldown] loading campaign operational billing", {
          campaignId,
        });
      }
      startTransition(async () => {
        const result = await loadCampaignBillingDetailAction(campaignId);
        if (result.ok && result.detail) {
          setDetailCache((prev) => ({ ...prev, [campaignId]: result.detail! }));
          if (process.env.NODE_ENV === "development") {
            console.debug("[queue-drilldown] campaign detail ready", {
              campaignId,
              assignments: result.detail!.operational_rows.length,
            });
          }
        } else {
          toast.error(result.ok ? "No detail returned." : result.message);
        }
      });
    },
    [detailCache]
  );

  const openInvoiceWorkflow = useCallback(
    async (campaignId: string, selection?: OperationalSelectionPayload) => {
      setInvoiceSelection(selection);
      if (!detailCache[campaignId]) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[queue-drilldown] loading detail for invoice workflow", {
            campaignId,
          });
        }
        const result = await loadCampaignBillingDetailAction(campaignId);
        if (result.ok && result.detail) {
          setDetailCache((prev) => ({ ...prev, [campaignId]: result.detail! }));
          setInvoiceCampaignId(campaignId);
        } else {
          toast.error(result.ok ? "No detail returned." : result.message);
        }
        return;
      }
      setInvoiceCampaignId(campaignId);
    },
    [detailCache]
  );

  function selectCampaignForReview(campaignId: string) {
    if (selectedCampaignId === campaignId) {
      setReviewOpen((prev) => !prev);
      if (process.env.NODE_ENV === "development") {
        console.debug("[billing-review-table] toggled review panel", {
          campaignId,
          open: !reviewOpen,
        });
      }
      return;
    }

    setSelectedCampaignId(campaignId);
    setReviewOpen(true);
    loadDetail(campaignId);

    if (process.env.NODE_ENV === "development") {
      console.debug("[billing-review-table] campaign selected for review", { campaignId });
    }
  }

  function toggleCampaignSelect(campaignId: string) {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  }

  const invoiceDetail = invoiceCampaignId ? detailCache[invoiceCampaignId] : null;
  const reviewDetail = selectedCampaignId ? detailCache[selectedCampaignId] : null;
  const reviewLoading = pending && selectedCampaignId !== null && !reviewDetail;

  return (
    <div className="space-y-4">
      <BillingFinanceFilterBar
        value={filter}
        onChange={(value) => {
          setFilter(value);
          if (process.env.NODE_ENV === "development") {
            console.debug("[queue-filter] billing queue filter changed", { filter: value });
          }
        }}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Billing queue</CardTitle>
            <p className="text-sm text-muted-foreground">
              One row per campaign — select a row to review assignments, deliverables, and post
              lines below.
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
                    const selected = selectedCampaignId === row.campaign_header_id;
                    const cur = row.currency_code;

                    return (
                      <TableRow
                        key={row.campaign_header_id}
                        className={cn(
                          "cursor-pointer bg-muted/10 hover:bg-muted/20",
                          selected && "bg-primary/5 ring-1 ring-primary/20"
                        )}
                        onClick={() => selectCampaignForReview(row.campaign_header_id)}
                        aria-selected={selected}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border"
                            checked={selectedCampaignIds.has(row.campaign_header_id)}
                            onChange={() => toggleCampaignSelect(row.campaign_header_id)}
                            aria-label={`Select ${row.campaign_name}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.campaign_document_number}
                        </TableCell>
                        <TableCell>{row.client_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.brand_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/campaigns/${row.campaign_header_id}?tab=billing`}
                            className="font-medium hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.campaign_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.currency_code}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBillingMoneyCompact(row.total_campaign_amount, cur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoneyCompact(row.achieved_revenue, cur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoneyCompact(row.already_invoiced, cur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBillingMoneyCompact(row.remaining_to_invoice, cur)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatBillingMoneyCompact(row.unachieved_revenue, cur)}
                        </TableCell>
                        <TableCell>
                          <BillingStatusBadge status={row.billing_status} />
                        </TableCell>
                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openInvoiceWorkflow(row.campaign_header_id)}
                            >
                              Invoice
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/campaigns/${row.campaign_header_id}?tab=billing`}>
                                <ExternalLinkIcon className="size-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCampaign ? (
        <BillingCampaignReviewPanel
          campaignName={selectedCampaign.campaign_name}
          campaignDocumentNumber={selectedCampaign.campaign_document_number}
          detail={reviewDetail}
          loading={reviewLoading}
          filter={filter}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onInvoice={(selection) => {
            if (selectedCampaignId) {
              openInvoiceWorkflow(selectedCampaignId, selection);
            }
          }}
        />
      ) : null}

      {invoiceCampaignId && invoiceDetail ? (
        <InvoiceGenerationSheet
          campaignId={invoiceCampaignId}
          currency={invoiceDetail.currency_code}
          rollup={invoiceDetail.rollup}
          operationalRows={invoiceDetail.operational_rows}
          appendableInvoices={invoiceDetail.appendable_invoices}
          initialSelection={invoiceSelection}
          open={Boolean(invoiceCampaignId)}
          onOpenChange={(open) => {
            if (!open) {
              setInvoiceCampaignId(null);
              setInvoiceSelection(undefined);
            }
          }}
        />
      ) : null}
    </div>
  );
}
