"use client";

import { Button } from "@/components/ui/button";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import type { ConsolidatedInvoiceQueueRow } from "@/lib/billing/consolidated-invoice-queue";
import type { RowSelectionStatus } from "@/lib/billing/operational-selection";
import { cn } from "@/lib/utils";

type CampaignBillingQueueTableProps = {
  rows: ConsolidatedInvoiceQueueRow[];
  selectedBatchKeys: Set<string>;
  onToggleRowSelect: (batchKey: string) => void;
  onSelectRow: (row: ConsolidatedInvoiceQueueRow) => void;
  activeBatchKey: string | null;
};

function queueGlobalStatus(
  rows: ConsolidatedInvoiceQueueRow[],
  selected: Set<string>
): RowSelectionStatus {
  if (rows.length === 0) return "unchecked";
  const selectedCount = rows.filter((r) => selected.has(r.batch_key)).length;
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === rows.length) return "checked";
  return "indeterminate";
}

export function CampaignBillingQueueTable({
  rows,
  selectedBatchKeys,
  onToggleRowSelect,
  onSelectRow,
  activeBatchKey,
}: CampaignBillingQueueTableProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No consolidated invoice candidates. Generate Vendor IO on eligible assignment lines in
        Assignments, then return here.
      </p>
    );
  }

  return (
    <CampaignOperationalTable>
      <CampaignOperationalTableHeader>
        <CampaignOperationalTableHeaderRow>
          <CampaignOperationalTableHead className="w-10" />
          <CampaignOperationalTableHead>Campaign number</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Client</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Brand</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Campaign name</CampaignOperationalTableHead>
          <CampaignOperationalTableHead className="text-right">Rev. before VAT</CampaignOperationalTableHead>
          <CampaignOperationalTableHead className="text-right">VAT</CampaignOperationalTableHead>
          <CampaignOperationalTableHead className="text-right">Rev. after VAT</CampaignOperationalTableHead>
        </CampaignOperationalTableHeaderRow>
      </CampaignOperationalTableHeader>
      <CampaignOperationalTableBody>
        {rows.map((row) => {
          const selected = selectedBatchKeys.has(row.batch_key);
          const active = activeBatchKey === row.batch_key;
          return (
            <CampaignOperationalTableRow
              key={row.batch_key}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/20",
                active && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/30"
              )}
              onClick={() => onSelectRow(row)}
            >
              <CampaignOperationalTableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                <OperationalSelectionCheckbox
                  status={selected ? "checked" : "unchecked"}
                  onToggle={() => onToggleRowSelect(row.batch_key)}
                  ariaLabel={`Select ${formatDocumentNumberForDisplay(row.campaign_document_number)} for invoicing`}
                />
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                <button
                  type="button"
                  className="text-[11px] font-medium tabular-nums text-sky-800 underline-offset-2 hover:underline dark:text-sky-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRow(row);
                  }}
                >
                  <DocumentNumber value={row.campaign_document_number} />
                </button>
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>{row.client_name}</CampaignOperationalTableCell>
              <CampaignOperationalTableCell>{row.brand_name ?? "—"}</CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="max-w-[200px] truncate font-medium">
                {row.campaign_name}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCellAmount>
                {formatOperationalAmount(row.revenue_before_vat)}
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCellAmount>
                {formatOperationalAmount(row.vat_amount)}
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCellAmount className="font-medium">
                {formatOperationalAmount(row.revenue_after_vat)}
              </CampaignOperationalTableCellAmount>
            </CampaignOperationalTableRow>
          );
        })}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}

export function CampaignBillingQueueToolbar({
  rows,
  selectedBatchKeys,
  onSelectAll,
  onClear,
  onGenerateInvoice,
}: {
  rows: ConsolidatedInvoiceQueueRow[];
  selectedBatchKeys: Set<string>;
  onSelectAll: () => void;
  onClear: () => void;
  onGenerateInvoice: () => void;
}) {
  const globalStatus = queueGlobalStatus(rows, selectedBatchKeys);
  const selectedCount = selectedBatchKeys.size;

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <OperationalSelectionCheckbox
        status={globalStatus}
        onToggle={onSelectAll}
        ariaLabel="Select all queue rows"
      />
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSelectAll}>
        Select all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={onClear}
        disabled={selectedCount === 0}
      >
        Clear
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-7 text-xs"
        onClick={onGenerateInvoice}
        disabled={selectedCount === 0}
      >
        Generate invoice
      </Button>
    </div>
  );
}
