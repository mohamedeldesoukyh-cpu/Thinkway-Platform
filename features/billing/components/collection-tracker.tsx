"use client";

import Link from "next/link";
import { format } from "date-fns";

import { DocumentNumber } from "@/components/ui/document-number";
import { CollectionStatusBadge } from "@/features/billing/components/billing-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AGING_BUCKET_LABELS } from "@/features/billing/constants";
import type { BillingInvoiceRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type CollectionTrackerProps = {
  invoices: BillingInvoiceRow[];
  currency?: string;
};

export function CollectionTracker({
  invoices,
  currency = "USD",
}: CollectionTrackerProps) {
  const open = invoices.filter((i) => i.outstanding > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Collection tracker</CardTitle>
        <p className="text-sm text-muted-foreground">
          {open.length} open invoice{open.length === 1 ? "" : "s"} requiring collection follow-up
        </p>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">All invoices collected.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Aging</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/billing/invoices/${inv.id}`}
                        className="text-xs font-medium hover:underline"
                      >
                        <DocumentNumber value={inv.document_number} showCanonicalTitle={false} />
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {inv.client_name}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {inv.campaign_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {inv.due_date
                        ? format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {AGING_BUCKET_LABELS[inv.aging_bucket]}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBillingMoney(inv.outstanding, inv.currency || currency)}
                    </TableCell>
                    <TableCell>
                      <CollectionStatusBadge status={inv.collection_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
