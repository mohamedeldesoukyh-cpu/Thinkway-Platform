"use client";

import { useMemo } from "react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  campaignId: string;
  rows: VendorIoRow[];
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function VendorIoTab({ campaignId, rows }: Props) {
  const [state, formAction, pending] = useActionState(sendVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [rows]
  );

  return (
    <OperationalTableSection
      title="Vendor IO"
      description="Auto-generated per assignment when status becomes assigned/confirmed. IO status never blocks campaign execution."
    >
      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No assignment IO drafts generated yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignment</TableHead>
              <TableHead>Influencer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {row.assignment_document_number ?? "—"}
                </TableCell>
                <TableCell>{row.influencer_name}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(row.amount, row.currency_code)}
                </TableCell>
                <TableCell>
                  <IoStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  {row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/ios/vendor?campaign=${campaignId}&io=${row.id}`}>View</a>
                    </Button>
                    <form action={formAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        type="hidden"
                        name="campaign_header_id"
                        value={row.campaign_header_id}
                      />
                      <Button size="sm" type="submit" disabled={pending}>
                        {row.status === "sent" ? "Resend" : "Send"}
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </OperationalTableSection>
  );
}

