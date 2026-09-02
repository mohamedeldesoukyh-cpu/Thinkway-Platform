"use client";

import { useActionState } from "react";
import { useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { FinanceSuiteEmpty, FinanceSuiteKpiStrip } from "@/components/finance/suite";
import {
  createAndPostBatchAction,
  previewPostingBatchAction,
  reversePostingBatchAction,
  type PostingCenterActionState,
} from "@/features/finance/posting-center/actions";
import type { PostingBatchRow, PostingPreviewRow } from "@/features/finance/posting-center/queries";
import { formatMoney } from "@/features/campaigns/utils";
import { PostingBatchStatusBadge } from "@/components/finance/posting-batch-status-badge";
import {
  FINANCE_DOCUMENT_KIND_LABELS,
  POSTING_CENTER_TRANSACTION_TYPES,
  type FinanceDocumentKind,
} from "@/lib/finance/status/document-kind";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const POSTING_PREVIEW_COLUMNS: OperationalConfigurableColumnDef<PostingPreviewRow>[] = [
  {
    id: "doc_no",
    label: "Doc no",
    monoCell: true,
    renderCell: (row) => row.document_number,
  },
  {
    id: "party",
    label: "Client/Vendor",
    renderCell: (row) => row.party_name ?? "—",
  },
  {
    id: "campaign",
    label: "Campaign",
    monoCell: true,
    renderCell: (row) => row.campaign_document_number ?? "—",
  },
  {
    id: "amount",
    label: "Amount",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatMoney(row.amount_before_vat, row.currency),
  },
  {
    id: "vat",
    label: "VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatMoney(row.vat_amount, row.currency),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => <Badge variant="outline">{row.status}</Badge>,
  },
];

function PostingBatchActionsCell({
  batch,
  reverseAction,
  reversePending,
}: {
  batch: PostingBatchRow;
  reverseAction: (payload: FormData) => void;
  reversePending: boolean;
}) {
  if (batch.status !== "posted") return "—";
  return (
    <form action={reverseAction}>
      <input type="hidden" name="batch_id" value={batch.id} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={reversePending}
        className="h-7 text-[10px]"
      >
        Reverse
      </Button>
    </form>
  );
}

function buildPostingBatchColumns(
  reverseAction: (payload: FormData) => void,
  reversePending: boolean
): OperationalConfigurableColumnDef<PostingBatchRow>[] {
  return [
    {
      id: "batch",
      label: "Batch",
      monoCell: true,
      renderCell: (row) => row.document_number,
    },
    {
      id: "type",
      label: "Type",
      renderCell: (row) => FINANCE_DOCUMENT_KIND_LABELS[row.transaction_type],
    },
    {
      id: "period",
      label: "Period",
      cellClassName: "text-muted-foreground",
      renderCell: (row) => `${row.period_from} → ${row.period_to}`,
    },
    {
      id: "total",
      label: "Total",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatMoney(row.total_after_vat, row.currency ?? "USD"),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <PostingBatchStatusBadge status={row.status} />,
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      renderCell: (row) => (
        <PostingBatchActionsCell
          batch={row}
          reverseAction={reverseAction}
          reversePending={reversePending}
        />
      ),
    },
  ];
}

export const POSTING_PREVIEW_COLUMN_METAS = getOperationalTableColumnMetas(POSTING_PREVIEW_COLUMNS);

const POSTING_BATCH_COLUMNS_STATIC = buildPostingBatchColumns(() => {}, false);
export const POSTING_BATCH_COLUMN_METAS = getOperationalTableColumnMetas(
  POSTING_BATCH_COLUMNS_STATIC
);

type PostingCenterWorkspaceProps = {
  initialPreview: PostingPreviewRow[];
  batches: PostingBatchRow[];
  defaultTransactionType: FinanceDocumentKind;
  defaultPeriodFrom: string;
  defaultPeriodTo: string;
};

export function PostingCenterWorkspace({
  initialPreview,
  batches,
  defaultTransactionType,
  defaultPeriodFrom,
  defaultPeriodTo,
}: PostingCenterWorkspaceProps) {
  const [transactionType, setTransactionType] =
    useState<FinanceDocumentKind>(defaultTransactionType);
  const [periodFrom, setPeriodFrom] = useState(defaultPeriodFrom);
  const [periodTo, setPeriodTo] = useState(defaultPeriodTo);
  const [preview] = useState(initialPreview);
  const [previewState, previewAction, previewPending] = useActionState(
    previewPostingBatchAction,
    { ok: false } satisfies PostingCenterActionState
  );
  const [postState, postAction, postPending] = useActionState(createAndPostBatchAction, {
    ok: false,
  } satisfies PostingCenterActionState);
  const [reverseState, reverseAction, reversePending] = useActionState(
    reversePostingBatchAction,
    { ok: false } satisfies PostingCenterActionState
  );

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

  const batchColumns = useMemo(
    () => buildPostingBatchColumns(reverseAction, reversePending),
    [reverseAction, reversePending]
  );

  const statusMessage = postState.message ?? previewState.message ?? reverseState.message;

  return (
    <div className="space-y-4">
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "preview",
            label: "In preview range",
            value: String(preview.length),
            hint: preview.length === 0 ? "no documents match" : "ready to post",
          },
          {
            id: "total",
            label: "Batch total",
            value: formatMoney(totals.after, preview[0]?.currency ?? "USD"),
            hint: `${preview.length} docs`,
            tone: preview.length === 0 ? "bad" : undefined,
          },
          {
            id: "batches",
            label: "Posted batches",
            value: String(batches.length),
            hint: batches.length === 0 ? "none yet" : undefined,
          },
          {
            id: "reversals",
            label: "Reversals",
            value: String(batches.filter((b) => b.status === "reversed").length),
            hint: "reverse, never delete",
          },
        ]}
      />

      <section className="thinkway-campaign-section-card">
        <div className="thinkway-campaign-section-head">
          <div className="min-w-0">
            <h2>Posting workflow</h2>
            <p>Thinkway operational subledger → batch-controlled ERP bridge. Reverse instead of delete.</p>
          </div>
        </div>
        <div className="fs-pad">
          <div className="grid gap-4 md:grid-cols-4">
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
              name="period_from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="period_to">To date</Label>
            <Input
              id="period_to"
              name="period_to"
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <form action={previewAction} className="w-full">
              <input type="hidden" name="transaction_type" value={transactionType} />
              <input type="hidden" name="period_from" value={periodFrom} />
              <input type="hidden" name="period_to" value={periodTo} />
              <Button type="submit" variant="outline" className="w-full" disabled={previewPending}>
                {previewPending ? "Refreshing…" : "Preview"}
              </Button>
            </form>
          </div>
          </div>
        </div>

        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.financePostingDocuments}
          columns={POSTING_PREVIEW_COLUMNS}
          rows={preview}
          filterAccessors={{
            doc_no: (row) => row.document_number,
            party: (row) => row.party_name,
            campaign: (row) => row.campaign_document_number,
            amount: (row) => row.amount_before_vat,
            vat: (row) => row.vat_amount,
            status: (row) => row.status,
          }}
        >
          <div className="mt-4 overflow-x-auto rounded-2xl border">
            <div className="flex justify-end border-b px-4 py-2">
              <OperationalTableControlsSlot contextLabel="Posting preview" />
            </div>
            {preview.length === 0 ? (
              <FinanceSuiteEmpty
                title="No documents in preview range"
                body="Nothing matches this transaction type and date range. Widen the range or change the type."
              />
            ) : (
              <OperationalConfigurableTable
                columns={POSTING_PREVIEW_COLUMNS}
                rows={preview}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </OperationalTableSuiteProvider>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Batch total: {formatMoney(totals.after, preview[0]?.currency ?? "USD")} ({preview.length}{" "}
            docs)
          </p>
          <form action={postAction}>
            <input type="hidden" name="transaction_type" value={transactionType} />
            <input type="hidden" name="period_from" value={periodFrom} />
            <input type="hidden" name="period_to" value={periodTo} />
            <Button type="submit" disabled={postPending || preview.length === 0}>
              {postPending ? "Posting…" : "Post to accounting"}
            </Button>
          </form>
        </div>
        {statusMessage ? (
          <p
            className={`mt-2 text-sm ${postState.ok || previewState.ok || reverseState.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            {statusMessage}
          </p>
        ) : null}
      </section>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.financePostingBatches}
        columns={batchColumns}
        rows={batches}
        filterAccessors={{
          batch: (row) => row.document_number,
          type: (row) => row.transaction_type,
          period: (row) => row.period_from,
          total: (row) => row.total_after_vat,
          status: (row) => row.status,
        }}
      >
        <section className="thinkway-campaign-section-card">
          <CampaignOperationalSectionHeader
            title="Recent posting batches"
            description="Batch number, total, period and execution state"
            actions={<OperationalTableControlsSlot contextLabel="Posting batches" />}
          />
          <div className="mt-0 overflow-x-auto">
            {batches.length === 0 ? (
              <FinanceSuiteEmpty
                title="No posting batches yet"
                body="Once a batch is posted it appears here permanently. Batches are reversed, never deleted."
              />
            ) : (
              <OperationalConfigurableTable
                columns={batchColumns}
                rows={batches}
                rowKey={(row) => row.id}
              />
            )}
          </div>
        </section>
      </OperationalTableSuiteProvider>
    </div>
  );
}
