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
import type { BillingInvoiceRow, VendorPaymentBatchRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";

type BillingInvoicesTableProps = {
  invoices: BillingInvoiceRow[];
};

export function BillingInvoicesTable({ invoices }: BillingInvoicesTableProps) {
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices issued yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Issue date</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Collection</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>
                <Link
                  href={`/billing/invoices/${inv.id}`}
                  className="text-xs font-medium hover:underline"
                >
                  <DocumentNumber value={inv.document_number} showCanonicalTitle={false} />
                </Link>
              </TableCell>
              <TableCell className="max-w-[140px] truncate">{inv.client_name}</TableCell>
              <TableCell className="max-w-[140px] truncate text-muted-foreground">
                {inv.campaign_name ?? "—"}
              </TableCell>
              <TableCell>
                {format(new Date(`${inv.issue_date}T00:00:00`), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {inv.due_date
                  ? format(new Date(`${inv.due_date}T00:00:00`), "MMM d, yyyy")
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                {formatBillingMoney(inv.total, inv.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatBillingMoney(inv.amount_paid, inv.currency)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatBillingMoney(inv.outstanding, inv.currency)}
              </TableCell>
              <TableCell>
                <CollectionStatusBadge status={inv.collection_status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type VendorBatchesCardProps = {
  batches: VendorPaymentBatchRow[];
};

export function VendorBatchesCard({ batches }: VendorBatchesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Vendor payment batches</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vendor batches recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="text-xs">
                      <DocumentNumber value={batch.document_number} />
                    </TableCell>
                    <TableCell>{batch.name}</TableCell>
                    <TableCell>
                      {format(new Date(`${batch.batch_date}T00:00:00`), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBillingMoney(batch.total_amount, batch.currency)}
                    </TableCell>
                    <TableCell className="capitalize">{batch.status}</TableCell>
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
