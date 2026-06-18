"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveClientClassificationAction,
  reclassifyClientAction,
  rejectClientClassificationAction,
} from "@/features/clients/classification-review-actions";
import type { ClientClassificationReviewRow } from "@/features/clients/classification-review-queries";

type ClientClassificationReviewTableProps = {
  rows: ClientClassificationReviewRow[];
};

export function ClientClassificationReviewTable({
  rows,
}: ClientClassificationReviewTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) {
      setPendingId(null);
    }
  }, [isPending]);

  function runAction(
    clientId: string,
    action: (id: string) => Promise<{ ok: boolean; message?: string }>
  ) {
    setPendingId(clientId);
    startTransition(async () => {
      const result = await action(clientId);
      if (result.ok) {
        toast.success(result.message ?? "Done");
      } else {
        toast.error(result.message ?? "Action failed");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No clients awaiting classification review.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Subcategory</TableHead>
            <TableHead className="text-right">Confidence</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const busy = isPending && pendingId === row.id;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/clients/${row.id}`}
                    className="hover:text-[var(--brand-product)] hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.category_label}</TableCell>
                <TableCell>{row.subcategory_label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.classification_confidence != null
                    ? `${Math.round(row.classification_confidence)}%`
                    : "—"}
                </TableCell>
                <TableCell>{row.source_label}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => runAction(row.id, approveClientClassificationAction)}
                    >
                      <Check data-icon="inline-start" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => runAction(row.id, rejectClientClassificationAction)}
                    >
                      <X data-icon="inline-start" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => runAction(row.id, reclassifyClientAction)}
                    >
                      <RefreshCw data-icon="inline-start" />
                      Reclassify
                    </Button>
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <Link href={`/clients/${row.id}`}>
                        <ExternalLink data-icon="inline-start" />
                        Open
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
