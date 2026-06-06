"use client";

import { format } from "date-fns";

import { AdjustmentLifecycleButtons } from "@/features/finance/adjustments/components/adjustment-lifecycle-buttons";
import { AdjustmentStatusBadge } from "@/components/finance/adjustment-status-badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinanceAdjustmentRegisterRow } from "@/features/finance/adjustments/types";
import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import { formatMoney } from "@/features/campaigns/utils";

type AdjustmentRegisterTableProps = {
  rows: FinanceAdjustmentRegisterRow[];
  kind: AdjustmentTableKind;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

export function AdjustmentRegisterTable({ rows, kind }: AdjustmentRegisterTableProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">
        No documents in this register yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="text-[10px] uppercase tracking-wide">
          <TableHead>Document</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Client / Vendor</TableHead>
          <TableHead>Campaign</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              <DocumentNumber value={row.document_number} />
            </TableCell>
            <TableCell>
              {row.source_document_number ? (
                <DocumentNumber value={row.source_document_number} />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>{row.client_name ?? row.vendor_name ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {row.campaign_document_number ? (
                <DocumentNumber value={row.campaign_document_number} />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>{formatDate(row.issue_date)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.amount_after_vat, row.currency)}
            </TableCell>
            <TableCell>
              <AdjustmentStatusBadge status={row.status} />
            </TableCell>
            <TableCell>
              <AdjustmentLifecycleButtons kind={kind} id={row.id} status={row.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
