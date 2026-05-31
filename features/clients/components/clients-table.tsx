import Link from "next/link";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientsListResult } from "@/features/clients/queries";

import { ClientStatusBadge } from "./client-status-badge";

type ClientsTableProps = {
  clients: ClientsListResult["clients"];
};

export function ClientsTable({ clients }: ClientsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client #</TableHead>
          <TableHead>Legal entity</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Billing email</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-mono text-xs">
              {client.document_number}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium hover:underline"
                >
                  {client.name}
                </Link>
                {client.legal_name ? (
                  <span className="text-xs text-muted-foreground">
                    {client.legal_name}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>{client.group?.name ?? "—"}</TableCell>
            <TableCell>
              <ClientStatusBadge status={client.status} />
            </TableCell>
            <TableCell>{client.billing_email ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(client.created_at), "MMM d, yyyy")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
