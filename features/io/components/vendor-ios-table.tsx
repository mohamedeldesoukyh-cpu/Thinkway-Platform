"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { VendorIoRow } from "@/features/io/types";

type Props = {
  rows: VendorIoRow[];
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function VendorIosTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No vendor IO records found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Influencer</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Assignment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent date</TableHead>
            <TableHead>Approved date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.influencer_name}</TableCell>
              <TableCell>
                <a href={`/campaigns/${row.campaign_header_id}`} className="hover:underline">
                  {row.campaign_document_number} · {row.campaign_name}
                </a>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.assignment_document_number ?? "—"}</TableCell>
              <TableCell className="text-right">{formatMoney(row.amount, row.currency_code)}</TableCell>
              <TableCell><IoStatusBadge status={row.status} /></TableCell>
              <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
              <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/ios/vendor?io=${row.id}`}>View</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/campaigns/${row.campaign_header_id}`}>{row.status === "sent" ? "Resend" : "Send"}</a>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

