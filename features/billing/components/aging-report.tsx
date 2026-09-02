"use client";

import { Fragment, useMemo, useState } from "react";

import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { DocumentNumber } from "@/components/ui/document-number";
import type { BillingDashboard, BillingInvoiceRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import {
  AGING_BUCKET_LABELS,
  AGING_BUCKET_ORDER,
  daysPastDue,
  type AgingBucket,
} from "@/lib/collections/aging";
import { cn } from "@/lib/utils";

type AgingReportProps = {
  aging: BillingDashboard["aging"];
  invoices?: BillingInvoiceRow[];
  currency?: string;
  mixedCurrency?: boolean;
};

type AgingDisplayBucket = AgingBucket | "no_due_date";

const DISPLAY_BUCKETS: { id: AgingDisplayBucket; label: string }[] = [
  { id: "current", label: AGING_BUCKET_LABELS.current },
  { id: "1_30", label: AGING_BUCKET_LABELS["1_30"] },
  { id: "31_60", label: AGING_BUCKET_LABELS["31_60"] },
  { id: "61_90", label: AGING_BUCKET_LABELS["61_90"] },
  { id: "90_plus", label: AGING_BUCKET_LABELS["90_plus"] },
  { id: "no_due_date", label: "No due date" },
];

function resolveDisplayBucket(invoice: BillingInvoiceRow): AgingDisplayBucket {
  if (!invoice.due_date) return "no_due_date";
  return invoice.aging_bucket;
}

function formatAgingAmount(
  amount: number,
  invoiceCurrency: string,
  mixedCurrency: boolean,
  displayCurrency?: string
) {
  if (mixedCurrency || !displayCurrency) {
    return `${invoiceCurrency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
  return formatBillingMoney(amount, displayCurrency);
}

export function AgingReport({
  aging,
  invoices = [],
  currency,
  mixedCurrency = false,
}: AgingReportProps) {
  const [mode, setMode] = useState<"open" | "all">("open");
  const [openClients, setOpenClients] = useState<Set<string>>(() => new Set());

  const source = useMemo(
    () => (mode === "open" ? invoices.filter((inv) => inv.outstanding > 0) : invoices),
    [invoices, mode]
  );

  const grouped = useMemo(() => {
    const byClient = new Map<
      string,
      {
        name: string;
        invoices: BillingInvoiceRow[];
        buckets: Record<AgingDisplayBucket, number>;
        total: number;
      }
    >();

    for (const invoice of source) {
      const amount = mode === "all" ? invoice.total : invoice.outstanding;
      const bucket = resolveDisplayBucket(invoice);
      const existing = byClient.get(invoice.client_id);
      if (!existing) {
        const buckets = Object.fromEntries(
          DISPLAY_BUCKETS.map((b) => [b.id, 0])
        ) as Record<AgingDisplayBucket, number>;
        buckets[bucket] = amount;
        byClient.set(invoice.client_id, {
          name: invoice.client_name,
          invoices: [invoice],
          buckets,
          total: amount,
        });
      } else {
        existing.invoices.push(invoice);
        existing.buckets[bucket] += amount;
        existing.total += amount;
      }
    }

    return [...byClient.values()].sort((a, b) => b.total - a.total);
  }, [mode, source]);

  const grand = grouped.reduce((sum, row) => sum + row.total, 0);
  const bucketTotals = Object.fromEntries(
    DISPLAY_BUCKETS.map((bucket) => [
      bucket.id,
      grouped.reduce((sum, row) => sum + row.buckets[bucket.id], 0),
    ])
  ) as Record<AgingDisplayBucket, number>;
  const overdue = AGING_BUCKET_ORDER.filter((b) => b !== "current").reduce(
    (sum, bucket) => sum + (bucketTotals[bucket] ?? 0),
    0
  );

  const formatSummary = (amount: number) =>
    mixedCurrency || !currency
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
      : formatBillingMoney(amount, currency);

  const totalOutstanding = aging.reduce((s, b) => s + b.amount, 0);

  const toggleClient = (name: string) => {
    setOpenClients((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="bq-card">
      <div className="bq-card__h">
        <span className="bq-card__t">A/R aging</span>
        <span className="bq-card__s">
          by client, then by invoice · {grouped.length} client
          {grouped.length === 1 ? "" : "s"} · {source.length} invoice
          {source.length === 1 ? "" : "s"}
        </span>
        <span className="flex-1" />
        <span className="bq-seg">
          <button
            type="button"
            aria-pressed={mode === "open"}
            onClick={() => setMode("open")}
          >
            Outstanding only
          </button>
          <button
            type="button"
            aria-pressed={mode === "all"}
            onClick={() => setMode("all")}
          >
            All invoices
          </button>
        </span>
      </div>

      <div className="bq-pad px-4 pt-3">
        <div className="bq-st">
          <span>
            <i>Total A/R</i>
            <b>{formatSummary(mode === "open" ? grand : grand)}</b>
          </span>
          <span>
            <i>Not yet due</i>
            <b>{formatSummary(bucketTotals.current)}</b>
          </span>
          <span>
            <i>Overdue</i>
            <b className={overdue > 0 ? "bad" : undefined}>{formatSummary(overdue)}</b>
          </span>
          <span>
            <i>No due date</i>
            <b className={bucketTotals.no_due_date > 0 ? "bad" : undefined}>
              {formatSummary(bucketTotals.no_due_date)}
            </b>
          </span>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
          {aging.map((bucket) => {
            const pct =
              totalOutstanding > 0 ? Math.round((bucket.amount / totalOutstanding) * 100) : 0;
            return (
              <div key={bucket.bucket} className="rounded-xl bg-muted/50 p-4">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  {bucket.label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatSummary(bucket.amount)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {bucket.count} invoice{bucket.count === 1 ? "" : "s"} · {pct}%
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <CampaignOperationalTable className="min-w-[1100px]">
            <CampaignOperationalTableHeader>
              <CampaignOperationalTableHeaderRow>
                <CampaignOperationalTableHead className="w-8" />
                <CampaignOperationalTableHead>Client / invoice</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Due date</CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="text-right">Days</CampaignOperationalTableHead>
                {DISPLAY_BUCKETS.map((bucket) => (
                  <CampaignOperationalTableHead key={bucket.id} className="text-right">
                    {bucket.label}
                  </CampaignOperationalTableHead>
                ))}
                <CampaignOperationalTableHead className="text-right">Total</CampaignOperationalTableHead>
              </CampaignOperationalTableHeaderRow>
            </CampaignOperationalTableHeader>
            <CampaignOperationalTableBody>
              {grouped.map((client) => {
                const open = openClients.has(client.name);
                const late = AGING_BUCKET_ORDER.some(
                  (bucket) => bucket !== "current" && client.buckets[bucket] > 0
                );
                return (
                  <Fragment key={client.name}>
                    <CampaignOperationalTableRow
                      className={late ? "shadow-[inset_3px_0_0_#c82121]" : undefined}
                    >
                      <CampaignOperationalTableCell>
                        <button
                          type="button"
                          className="grid size-5 place-items-center rounded border border-border text-[9px]"
                          aria-expanded={open}
                          aria-label={`Expand ${client.name}`}
                          onClick={() => toggleClient(client.name)}
                        >
                          {open ? "▾" : "▸"}
                        </button>
                      </CampaignOperationalTableCell>
                      <CampaignOperationalTableCell className="font-semibold">
                        {client.name}
                      </CampaignOperationalTableCell>
                      <CampaignOperationalTableCell className="text-muted-foreground">
                        {client.invoices.length} invoice
                        {client.invoices.length === 1 ? "" : "s"}
                      </CampaignOperationalTableCell>
                      <CampaignOperationalTableCell />
                      {DISPLAY_BUCKETS.map((bucket) => (
                        <CampaignOperationalTableCellAmount
                          key={bucket.id}
                          className={cn(
                            client.buckets[bucket.id] > 0 &&
                              bucket.id !== "current" &&
                              "bq-v-neg",
                            client.buckets[bucket.id] <= 0 && "bq-v-z"
                          )}
                        >
                          {formatSummary(client.buckets[bucket.id])}
                        </CampaignOperationalTableCellAmount>
                      ))}
                      <CampaignOperationalTableCellAmount>
                        {formatSummary(client.total)}
                      </CampaignOperationalTableCellAmount>
                    </CampaignOperationalTableRow>
                    {open
                      ? client.invoices.map((invoice) => {
                          const amount = mode === "all" ? invoice.total : invoice.outstanding;
                          const bucket = resolveDisplayBucket(invoice);
                          const days = invoice.due_date ? daysPastDue(invoice.due_date) : null;
                          return (
                            <CampaignOperationalTableRow key={invoice.id} className="bq-krow">
                              <CampaignOperationalTableCell />
                              <CampaignOperationalTableCell>
                                <p className="tabular-nums">
                                  <DocumentNumber
                                    value={invoice.document_number}
                                    showCanonicalTitle={false}
                                  />
                                </p>
                                <p className="text-[10.5px] text-muted-foreground">
                                  {invoice.campaign_name ?? "—"}
                                </p>
                              </CampaignOperationalTableCell>
                              <CampaignOperationalTableCell
                                className={invoice.due_date ? "tabular-nums" : "italic text-muted-foreground"}
                              >
                                {invoice.due_date ?? "not set"}
                              </CampaignOperationalTableCell>
                              <CampaignOperationalTableCellAmount
                                className={days !== null && days > 0 ? "bq-v-neg" : "bq-v-z"}
                              >
                                {days === null ? "—" : days}
                              </CampaignOperationalTableCellAmount>
                              {DISPLAY_BUCKETS.map((item) => (
                                <CampaignOperationalTableCellAmount
                                  key={item.id}
                                  className={cn(
                                    item.id === bucket
                                      ? item.id === "current"
                                        ? undefined
                                        : "bq-v-neg"
                                      : "bq-v-z"
                                  )}
                                >
                                  {item.id === bucket
                                    ? formatAgingAmount(
                                        amount,
                                        invoice.currency,
                                        mixedCurrency,
                                        currency
                                      )
                                    : "·"}
                                </CampaignOperationalTableCellAmount>
                              ))}
                              <CampaignOperationalTableCellAmount>
                                {formatAgingAmount(
                                  amount,
                                  invoice.currency,
                                  mixedCurrency,
                                  currency
                                )}
                              </CampaignOperationalTableCellAmount>
                            </CampaignOperationalTableRow>
                          );
                        })
                      : null}
                  </Fragment>
                );
              })}
              <CampaignOperationalTableRow className="bq-foot">
                <CampaignOperationalTableCell />
                <CampaignOperationalTableCell>All clients</CampaignOperationalTableCell>
                <CampaignOperationalTableCell className="text-muted-foreground">
                  {source.length} invoices
                </CampaignOperationalTableCell>
                <CampaignOperationalTableCell />
                {DISPLAY_BUCKETS.map((bucket) => {
                  const pct = grand > 0 ? (bucketTotals[bucket.id] / grand) * 100 : 0;
                  return (
                    <CampaignOperationalTableCellAmount key={bucket.id}>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={
                            bucketTotals[bucket.id] > 0 && bucket.id !== "current"
                              ? "bq-v-neg"
                              : undefined
                          }
                        >
                          {formatSummary(bucketTotals[bucket.id])}
                        </span>
                        <span className="text-[9.5px] font-normal text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="bq-bar w-full">
                          <i
                            className={bucket.id === "current" ? undefined : "r"}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </div>
                    </CampaignOperationalTableCellAmount>
                  );
                })}
                <CampaignOperationalTableCellAmount>
                  {formatSummary(grand)}
                </CampaignOperationalTableCellAmount>
              </CampaignOperationalTableRow>
            </CampaignOperationalTableBody>
          </CampaignOperationalTable>
        </div>
      )}

      <p className="bq-tn">
        Aging runs from the invoice <strong>due date</strong>, not the issue date.{" "}
        <strong>Current</strong> means issued and not yet due. Invoices without a due date stay
        in their own column so they are not counted as healthy.
      </p>
    </div>
  );
}
