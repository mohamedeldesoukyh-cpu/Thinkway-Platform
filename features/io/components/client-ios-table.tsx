"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";

type Props = {
  rows: ClientIoRow[];
  selectedId?: string | null;
};

export function ClientIosTable({ rows, selectedId = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No client IO records found.</p>;
  }

  function openIo(ioId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("io", ioId);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="overflow-x-auto">
      {isPending ? <Skeleton className="mb-3 h-9 w-56" /> : null}
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
            <TableRow
              key={row.id}
              className={selectedId === row.id ? "bg-muted/40" : undefined}
            >
              <TableCell>
                <Link href={`/campaigns/${row.campaign_header_id}`} className="hover:underline">
                  {row.campaign_document_number} · {row.campaign_name}
                </Link>
              </TableCell>
              <TableCell>{row.client_name}</TableCell>
              <TableCell><IoStatusBadge status={row.status} /></TableCell>
              <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
              <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={selectedId === row.id ? "default" : "outline"}
                    onClick={() => openIo(row.id)}
                    disabled={isPending}
                  >
                    View
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/campaigns/${row.campaign_header_id}`}>
                      {row.status === "sent" ? "Resend" : "Send"}
                    </Link>
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

