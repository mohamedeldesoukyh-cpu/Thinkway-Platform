"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";

type Props = {
  rows: ClientIoRow[];
};

export function ClientIosTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No client IO records found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent date</TableHead>
            <TableHead>Approved date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <a href={`/campaigns/${row.campaign_header_id}`} className="hover:underline">
                  {row.campaign_document_number} · {row.campaign_name}
                </a>
              </TableCell>
              <TableCell>{row.client_name}</TableCell>
              <TableCell><IoStatusBadge status={row.status} /></TableCell>
              <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
              <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/ios/client?io=${row.id}`}>View</a>
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

