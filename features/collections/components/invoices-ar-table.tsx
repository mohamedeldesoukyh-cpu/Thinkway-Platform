"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AGING_BUCKET_LABELS, bucketSeverity } from "@/lib/collections/aging";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";

type InvoicesArTableProps = {
  invoices: CollectionInvoiceRow[];
  currency: AnalyticsCurrencyContext;
  filter?: "all" | "overdue";
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unpaid",
  partial: "Partially paid",
  collected: "Paid",
  overdue: "Overdue",
  written_off: "Written off",
  disputed: "Disputed",
};

export function InvoicesArTable({
  invoices,
  currency,
  filter = "all",
}: InvoicesArTableProps) {
  const rows =
    filter === "overdue"
      ? invoices.filter((i) => i.aging_bucket !== "current" && i.outstanding > 0)
      : invoices.filter((i) => i.outstanding > 0);

  const format = (n: number) => formatAnalyticsAmount(n, currency, { decimals: 0 });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No open receivables in this view.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aging</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const severity = bucketSeverity(inv.aging_bucket);
            return (
              <TableRow key={inv.id}>
                <TableCell>
                  <Link
                    href={`/billing/invoices/${inv.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {inv.document_number}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[140px] truncate">{inv.client_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {STATUS_LABEL[inv.collection_status] ?? inv.collection_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-xs",
                      severity === "danger" && "text-red-600",
                      severity === "warn" && "text-amber-600"
                    )}
                  >
                    {AGING_BUCKET_LABELS[inv.aging_bucket]}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {format(inv.outstanding)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
