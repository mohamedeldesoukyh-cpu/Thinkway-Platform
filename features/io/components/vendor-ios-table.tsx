"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";

type Props = {
  rows: VendorIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function VendorIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
}: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No vendor IO records found.</p>;
  }

  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>IO #</TableHead>
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
            <VendorIoRowContextMenu key={row.id} row={row}>
            <TableRow
              className={selectedId === row.id ? "bg-muted/40" : undefined}
            >
              <TableCell className="text-xs">
                <DocumentNumber value={row.document_number} />
              </TableCell>
              <TableCell>{row.influencer_name}</TableCell>
              <TableCell>
                <Link href={`/campaigns/${row.campaign_header_id}`} className="hover:underline">
                  <DocumentNumber value={row.campaign_document_number} /> · {row.campaign_name}
                </Link>
              </TableCell>
              <TableCell className="text-xs">
                <DocumentNumber value={row.assignment_document_number} />
              </TableCell>
              <TableCell className="text-right">{formatMoney(row.amount, row.currency_code)}</TableCell>
              <TableCell><IoStatusBadge status={row.status} /></TableCell>
              <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
              <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(row.id)}
                    disabled={isNavigating}
                  >
                    View
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/campaigns/${row.campaign_header_id}`}>
                      {row.status === "sent" ? "Resend" : "Send"}
                    </Link>
                  </Button>
                  <VendorIoUngenerateTrigger
                    row={row}
                    disabled={!row.ungenerate_eligible}
                    title={row.ungenerate_ineligible_reason ?? undefined}
                  />
                </div>
              </TableCell>
            </TableRow>
            </VendorIoRowContextMenu>
          ))}
        </TableBody>
      </Table>
  );
}

