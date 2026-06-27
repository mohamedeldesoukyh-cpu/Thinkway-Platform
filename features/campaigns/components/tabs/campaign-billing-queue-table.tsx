"use client";

import { FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  OperationalFloatingActionBar,
  PlatformFloatingBarDivider,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSelection,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_REVENUE_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { OperationalSelectionCheckbox } from "@/features/billing/components/operational-selection-checkbox";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import type { ConsolidatedInvoiceQueueRow } from "@/lib/billing/consolidated-invoice-queue";
import type { RowSelectionStatus } from "@/lib/billing/operational-selection";
import { cn } from "@/lib/utils";

export const CAMPAIGN_CONSOLIDATED_INVOICE_QUEUE_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "select", label: "Select", locked: true },
  { id: "campaign_number", label: "Campaign number" },
  { id: "client", label: "Client" },
  { id: "brand", label: "Brand" },
  { id: "campaign_name", label: "Campaign name" },
  { id: "revenue_before_vat", label: "Rev. before VAT" },
  { id: "vat_amount", label: "VAT" },
  { id: "revenue_after_vat", label: "Rev. after VAT" },
];

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

function CampaignBillingQueueTableHeader() {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNumber = useIsOperationalColumnVisible("campaign_number");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showCampaignName = useIsOperationalColumnVisible("campaign_name");
  const showRevenueBeforeVat = useIsOperationalColumnVisible("revenue_before_vat");
  const showVatAmount = useIsOperationalColumnVisible("vat_amount");
  const showRevenueAfterVat = useIsOperationalColumnVisible("revenue_after_vat");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showSelect ? <CampaignOperationalTableHead className="w-10" /> : null}
        {showCampaignNumber ? (
          <CampaignOperationalTableHead>Campaign number</CampaignOperationalTableHead>
        ) : null}
        {showClient ? <CampaignOperationalTableHead>Client</CampaignOperationalTableHead> : null}
        {showBrand ? <CampaignOperationalTableHead>Brand</CampaignOperationalTableHead> : null}
        {showCampaignName ? (
          <CampaignOperationalTableHead>Campaign name</CampaignOperationalTableHead>
        ) : null}
        {showRevenueBeforeVat ? (
          <CampaignOperationalTableHead className="text-right">
            Rev. before VAT
          </CampaignOperationalTableHead>
        ) : null}
        {showVatAmount ? (
          <CampaignOperationalTableHead className="text-right">VAT</CampaignOperationalTableHead>
        ) : null}
        {showRevenueAfterVat ? (
          <CampaignOperationalTableHead className="text-right">
            Rev. after VAT
          </CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function CampaignBillingQueueTableRow({
  row,
  selected,
  active,
  onToggleRowSelect,
  onSelectRow,
}: {
  row: ConsolidatedInvoiceQueueRow;
  selected: boolean;
  active: boolean;
  onToggleRowSelect: (batchKey: string) => void;
  onSelectRow: (row: ConsolidatedInvoiceQueueRow) => void;
}) {
  const showSelect = useIsOperationalColumnVisible("select");
  const showCampaignNumber = useIsOperationalColumnVisible("campaign_number");
  const showClient = useIsOperationalColumnVisible("client");
  const showBrand = useIsOperationalColumnVisible("brand");
  const showCampaignName = useIsOperationalColumnVisible("campaign_name");
  const showRevenueBeforeVat = useIsOperationalColumnVisible("revenue_before_vat");
  const showVatAmount = useIsOperationalColumnVisible("vat_amount");
  const showRevenueAfterVat = useIsOperationalColumnVisible("revenue_after_vat");

  return (
    <CampaignOperationalTableRow
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/20",
        active && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/30"
      )}
      onClick={() => onSelectRow(row)}
    >
      {showSelect ? (
        <CampaignOperationalTableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          <OperationalSelectionCheckbox
            status={selected ? "checked" : "unchecked"}
            onToggle={() => onToggleRowSelect(row.batch_key)}
            ariaLabel={`Select ${formatDocumentNumberForDisplay(row.campaign_document_number)} for invoicing`}
          />
        </CampaignOperationalTableCell>
      ) : null}
      {showCampaignNumber ? (
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
      ) : null}
      {showClient ? (
        <CampaignOperationalTableCell>{row.client_name}</CampaignOperationalTableCell>
      ) : null}
      {showBrand ? (
        <CampaignOperationalTableCell>{row.brand_name ?? "—"}</CampaignOperationalTableCell>
      ) : null}
      {showCampaignName ? (
        <CampaignOperationalTableCell className="max-w-[200px] truncate font-medium">
          {row.campaign_name}
        </CampaignOperationalTableCell>
      ) : null}
      {showRevenueBeforeVat ? (
        <CampaignOperationalTableCellAmount className={OPERATIONAL_REVENUE_AMOUNT_CLASS}>
          {formatOperationalAmount(row.revenue_before_vat)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showVatAmount ? (
        <CampaignOperationalTableCellAmount>
          {formatOperationalAmount(row.vat_amount)}
        </CampaignOperationalTableCellAmount>
      ) : null}
      {showRevenueAfterVat ? (
        <CampaignOperationalTableCellAmount className={OPERATIONAL_REVENUE_AMOUNT_CLASS}>
          {formatOperationalAmount(row.revenue_after_vat)}
        </CampaignOperationalTableCellAmount>
      ) : null}
    </CampaignOperationalTableRow>
  );
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
      <div className="thinkway-campaign-empty-state">
        <p>
          No consolidated invoice candidates. Generate Vendor IO on eligible assignment lines in
          Assignments, then return here.
        </p>
      </div>
    );
  }

  return (
    <CampaignOperationalTable>
      <CampaignBillingQueueTableHeader />
      <CampaignOperationalTableBody>
        {rows.map((row) => (
          <CampaignBillingQueueTableRow
            key={row.batch_key}
            row={row}
            selected={selectedBatchKeys.has(row.batch_key)}
            active={activeBatchKey === row.batch_key}
            onToggleRowSelect={onToggleRowSelect}
            onSelectRow={onSelectRow}
          />
        ))}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}

export function CampaignBillingQueueFloatingBar({
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
  const visible = selectedCount > 0;

  if (rows.length === 0) return null;

  return (
    <OperationalFloatingActionBar visible={visible}>
      <PlatformFloatingBarSelection
        selectedCount={selectedCount}
        selectionLabel="row"
        onClearSelection={onClear}
      />

      <PlatformFloatingBarDivider />

      <div className="flex shrink-0 items-center gap-1.5 px-2">
        <OperationalSelectionCheckbox
          status={globalStatus}
          onToggle={onSelectAll}
          ariaLabel="Select all queue rows"
        />
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="hidden shrink-0 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          onClick={onSelectAll}
        >
          Select all
        </Button>
      </div>

      <PlatformFloatingBarDivider className="ml-auto" />

      <div className="pl-2">
        <PlatformFloatingBarPrimaryButton
          action={{
            id: "invoice",
            label: "Generate invoice",
            icon: FileTextIcon,
            onClick: onGenerateInvoice,
          }}
        />
      </div>
    </OperationalFloatingActionBar>
  );
}

/** @deprecated Use CampaignBillingQueueFloatingBar — inline toolbar replaced by floating pill. */
export function CampaignBillingQueueToolbar(props: Parameters<typeof CampaignBillingQueueFloatingBar>[0]) {
  return <CampaignBillingQueueFloatingBar {...props} />;
}
