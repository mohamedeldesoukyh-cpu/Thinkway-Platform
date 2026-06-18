"use client";

import { Fragment, useCallback, useState } from "react";
import Link from "next/link";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { AGING_BUCKET_LABELS } from "@/lib/collections/aging";
import type { AgingBucket } from "@/lib/collections/aging/types";
import type { ClientAgingDetailRow } from "@/lib/finance/aging";
import { cn } from "@/lib/utils";
import { OperationalTableSection } from "@/components/ui/operational-table-section";

const BUCKET_KEYS: AgingBucket[] = [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
];

type AgingDetailTableProps = {
  rows: ClientAgingDetailRow[];
};

function formatBucketAmount(amount: number, currency: string): string {
  if (amount <= 0) return "—";
  return formatBillingMoney(amount, currency);
}

export function AgingDetailTable({ rows }: AgingDetailTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader title="Client aging detail" />
      }
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No outstanding receivables for this report.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2">Legal entity</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2 text-right">Total</th>
                {BUCKET_KEYS.map((bucket) => (
                  <th key={bucket} className="px-3 py-2 text-right">
                    {AGING_BUCKET_LABELS[bucket]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowKey = `${row.client_id}-${row.currency}`;
                const isOpen = expanded.has(rowKey);
                return (
                  <Fragment key={rowKey}>
                    <CampaignOperationalTableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggle(rowKey)}
                    >
                      <CampaignOperationalTableCell className="w-8 px-2">
                        <button
                          type="button"
                          className="inline-flex size-6 items-center justify-center rounded-md hover:bg-muted"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Collapse invoices" : "Expand invoices"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(rowKey);
                          }}
                        >
                          {isOpen ? (
                            <ChevronDownIcon className="size-4" />
                          ) : (
                            <ChevronRightIcon className="size-4" />
                          )}
                        </button>
                      </CampaignOperationalTableCell>
                      <CampaignOperationalTableCell>
                        <Link
                          href={`/clients/${row.client_id}`}
                          className="font-medium hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.client_name}
                        </Link>
                      </CampaignOperationalTableCell>
                      <CampaignOperationalTableCell>{row.currency}</CampaignOperationalTableCell>
                      <CampaignOperationalTableCellAmount>
                        {formatBillingMoney(row.total_outstanding, row.currency)}
                      </CampaignOperationalTableCellAmount>
                      {BUCKET_KEYS.map((bucket) => (
                        <CampaignOperationalTableCellAmount key={bucket}>
                          {formatBucketAmount(row.buckets[bucket], row.currency)}
                        </CampaignOperationalTableCellAmount>
                      ))}
                    </CampaignOperationalTableRow>
                    {isOpen ? (
                      <tr className="bg-muted/20">
                        <td colSpan={3 + BUCKET_KEYS.length} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                <th className="py-1 text-left">Invoice</th>
                                <th className="py-1 text-left">Issue date</th>
                                <th className="py-1 text-left">Due date</th>
                                <th className="py-1 text-right">Days</th>
                                <th className="py-1 text-left">Bucket</th>
                                <th className="py-1 text-right">Outstanding</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.invoices.map((inv) => (
                                <tr
                                  key={inv.id}
                                  className="border-t border-border/60"
                                >
                                  <td className="py-2">
                                    <Link
                                      href={`/billing/invoices/${inv.id}`}
                                      className={cn(
                                        "font-mono text-[11px] text-primary hover:underline"
                                      )}
                                    >
                                      {formatDocumentNumberForDisplay(
                                        inv.document_number ?? inv.id
                                      )}
                                    </Link>
                                  </td>
                                  <td className="py-2">{inv.issue_date ?? "—"}</td>
                                  <td className="py-2">{inv.due_date ?? "—"}</td>
                                  <td className="py-2 text-right tabular-nums">
                                    {inv.days_aged}
                                  </td>
                                  <td className="py-2">
                                    {AGING_BUCKET_LABELS[inv.aging_bucket]}
                                  </td>
                                  <td className="py-2 text-right tabular-nums">
                                    {formatBillingMoney(inv.outstanding, row.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </OperationalTableSection>
  );
}
