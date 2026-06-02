"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
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

const FILTER_OPTIONS: { value: CampaignBillingQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_invoiced", label: "Not invoiced" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "fully_achieved", label: "Fully achieved" },
  { value: "partially_achieved", label: "Partially achieved" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "moved_to_billing", label: "Moved to billing" },
];

type BillingCampaignQueueTableProps = {
  campaigns: CampaignBillingQueueRow[];
};

export function BillingCampaignQueueTable({ campaigns }: BillingCampaignQueueTableProps) {
  const [filter, setFilter] = useState<CampaignBillingQueueFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const loadDetail = useCallback(
    (campaignId: string) => {
      if (detailCache[campaignId]) return;
      if (process.env.NODE_ENV === "development") {
        console.debug("[drilldown-load] loading campaign operational billing", { campaignId });
      }
      startTransition(async () => {
        const result = await loadCampaignBillingDetailAction(campaignId);
        if (result.ok && result.detail) {
          setDetailCache((prev) => ({ ...prev, [campaignId]: result.detail! }));
          if (process.env.NODE_ENV === "development") {
            console.debug("[drilldown-load] campaign detail ready", {
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
          console.debug("[drilldown-load] loading detail for invoice workflow", { campaignId });
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

  function toggleExpand(campaignId: string) {
    if (expandedId === campaignId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaignId);
    loadDetail(campaignId);
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Billing queue</CardTitle>
            <p className="text-sm text-muted-foreground">
              One row per campaign — expand to review operational assignments, deliverables, and
              post rows.
            </p>
          </div>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as CampaignBillingQueueFilter);
              if (process.env.NODE_ENV === "development") {
                console.debug("[queue-filter] billing queue filter changed", { filter: value });
              }
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns in the billing queue yet. Campaigns appear here once they have billing
              lines or operational revenue.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns match the &quot;{FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter}&quot; filter.
              {filter !== "all" ? " Try switching to All." : null}
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
                    const expanded = expandedId === row.campaign_header_id;
                    const detail = detailCache[row.campaign_header_id];
                    const cur = row.currency_code;

                    return (
                      <Fragment key={row.campaign_header_id}>
                        <TableRow className="bg-muted/10">
                          <TableCell>
                            <button
                              type="button"
                              className="rounded p-1 hover:bg-muted"
                              onClick={() => toggleExpand(row.campaign_header_id)}
                              aria-expanded={expanded}
                            >
                              {expanded ? (
                                <ChevronDownIcon className="size-4" />
                              ) : (
                                <ChevronRightIcon className="size-4" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
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
                          <TableCell className="text-right">
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
                        {expanded ? (
                          <TableRow>
                            <TableCell colSpan={14} className="bg-background p-0">
                              {pending && !detail ? (
                                <p className="p-4 text-sm text-muted-foreground">
                                  Loading operational billing…
                                </p>
                              ) : detail ? (
                                <BillingCampaignDrilldown
                                  detail={detail}
                                  onInvoice={(selection) => {
                                    openInvoiceWorkflow(row.campaign_header_id, selection);
                                  }}
                                />
                              ) : (
                                <p className="p-4 text-sm text-muted-foreground">
                                  Unable to load drill-down.
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
