"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PostingBatchRow, PostingPreviewRow } from "@/features/finance/posting-center/queries";
import { formatMoney } from "@/features/campaigns/utils";
import {
  FINANCE_DOCUMENT_KIND_LABELS,
  POSTING_CENTER_TRANSACTION_TYPES,
  type FinanceDocumentKind,
} from "@/lib/finance/status/document-kind";
import { POSTING_BATCH_STATUS_LABELS } from "@/lib/finance/status/posting-status";

type PostingCenterWorkspaceProps = {
  initialPreview: PostingPreviewRow[];
  batches: PostingBatchRow[];
  defaultTransactionType: FinanceDocumentKind;
};

export function PostingCenterWorkspace({
  initialPreview,
  batches,
  defaultTransactionType,
}: PostingCenterWorkspaceProps) {
  const [transactionType, setTransactionType] =
    useState<FinanceDocumentKind>(defaultTransactionType);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [preview] = useState(initialPreview);

  const totals = useMemo(
    () =>
      preview.reduce(
        (acc, row) => ({
          before: acc.before + row.amount_before_vat,
          vat: acc.vat + row.vat_amount,
          after: acc.after + row.amount_after_vat,
        }),
        { before: 0, vat: 0, after: 0 }
      ),
    [preview]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border p-4">
        <h3 className="text-sm font-semibold">Posting workflow</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Thinkway operational subledger → batch-controlled ERP bridge. Unposting requires open
          period and no dependent collections.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <Label>Transaction type</Label>
            <Select
              value={transactionType}
              onValueChange={(v) => setTransactionType(v as FinanceDocumentKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSTING_CENTER_TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FINANCE_DOCUMENT_KIND_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="period_from">From date</Label>
            <Input
              id="period_from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="period_to">To date</Label>
            <Input
              id="period_to"
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" disabled>
              Preview (server refresh)
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc no</TableHead>
                <TableHead>Client/Vendor</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No documents in preview range.
                  </TableCell>
                </TableRow>
              ) : (
                preview.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <DocumentNumber value={row.document_number} />
                    </TableCell>
                    <TableCell>{row.party_name ?? "—"}</TableCell>
                    <TableCell>
                      {row.campaign_document_number ? (
                        <DocumentNumber value={row.campaign_document_number} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.amount_before_vat, row.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.vat_amount, row.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Batch total: {formatMoney(totals.after, preview[0]?.currency ?? "USD")} ({preview.length}{" "}
            docs)
          </p>
          <Button type="button" disabled>
            Post to accounting
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border p-4">
        <h3 className="text-sm font-semibold">Recent posting batches</h3>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No posting batches yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <DocumentNumber value={batch.document_number} />
                    </TableCell>
                    <TableCell>
                      {FINANCE_DOCUMENT_KIND_LABELS[batch.transaction_type]}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {batch.period_from} → {batch.period_to}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(batch.total_after_vat, batch.currency ?? "USD")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {POSTING_BATCH_STATUS_LABELS[batch.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
