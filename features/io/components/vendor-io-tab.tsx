"use client";

import { useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoDetailSheet } from "@/features/io/components/vendor-io-detail-sheet";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import { VendorIoSendButton } from "@/features/io/components/vendor-io-send-button";
import { VendorIoSpecialPaymentTermsCell } from "@/features/io/components/vendor-io-special-payment-terms-cell";
import type { VendorIoRow } from "@/features/io/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type Props = {
  campaignId: string;
  rows: VendorIoRow[];
};

function buildCampaignVendorIoColumns(
  campaignId: string,
  onViewDetail: (ioId: string) => void
): OperationalConfigurableColumnDef<VendorIoRow>[] {
  return [
    {
      id: "io_number",
      label: "IO #",
      monoCell: true,
      renderCell: (row) => (
        <DetailClickableLabel
          onClick={() => onViewDetail(row.id)}
          title={`View ${row.document_number ?? "vendor IO"} details`}
          className="font-mono text-[11px]"
        >
          <DocumentNumber value={row.document_number} />
        </DetailClickableLabel>
      ),
    },
    {
      id: "assignment",
      label: "Assignment",
      monoCell: true,
      renderCell: (row) => row.assignment_document_number ?? "—",
    },
    {
      id: "influencer",
      label: "Influencer",
      renderCell: (row) => row.influencer_name,
    },
    {
      id: "amount",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatOperationalAmount(row.amount),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <IoStatusBadge status={row.status} />,
    },
    {
      id: "current_payment_terms",
      label: "Current payment terms",
      cellClassName: "text-muted-foreground max-w-[10rem]",
      renderCell: (row) => row.vendor_payment_terms_label || "—",
    },
    {
      id: "special_payment_terms",
      label: "Special payment terms",
      renderCell: (row) => <VendorIoSpecialPaymentTermsCell row={row} />,
    },
    {
      id: "sent",
      label: "Sent",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.sent_at ? new Date(row.sent_at).toLocaleString() : "—",
    },
    {
      id: "approved",
      label: "Approved",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.approved_at ? new Date(row.approved_at).toLocaleString() : "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (row) => (
        <div className="inline-flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/ios/vendor/${row.id}/preview`} target="_blank" rel="noopener noreferrer">
              View IO
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onViewDetail(row.id)}>
            Details
          </Button>
          <VendorIoSendButton row={row} variant="outline" />
          <VendorIoUngenerateTrigger
            row={row}
            disabled={!row.ungenerate_eligible}
            title={row.ungenerate_ineligible_reason ?? undefined}
          />
        </div>
      ),
    },
  ];
}

const CAMPAIGN_VENDOR_IO_TABLE_COLUMNS = buildCampaignVendorIoColumns("", () => {});

export const CAMPAIGN_VENDOR_IO_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  CAMPAIGN_VENDOR_IO_TABLE_COLUMNS
);

export function VendorIoTab({ campaignId, rows }: Props) {
  const [detailIoId, setDetailIoId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [rows]
  );

  const detailRow = useMemo(
    () => (detailIoId ? (sorted.find((row) => row.id === detailIoId) ?? null) : null),
    [detailIoId, sorted]
  );

  const columns = useMemo(
    () => buildCampaignVendorIoColumns(campaignId, setDetailIoId),
    [campaignId]
  );

  return (
    <>
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignVendorIos}
        columns={columns}
        rows={sorted}
        filterAccessors={{
          io_number: (row) => row.document_number,
          assignment: (row) => row.assignment_document_number,
          influencer: (row) => row.influencer_name,
          amount: (row) => row.amount,
          status: (row) => row.status,
          sent: (row) => row.sent_at,
          approved: (row) => row.approved_at,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CampaignOperationalSectionHeader
                title="Vendor IO"
                description="Auto-generated per assignment when status becomes assigned/confirmed. IO status never blocks campaign execution."
              />
              <OperationalTableControlsSlot contextLabel="Vendor IO" />
            </div>
          }
        >
          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No assignment IO drafts generated yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={sorted}
              rowKey={(row) => row.id}
              wrapRow={(row, rowElement) => (
                <VendorIoRowContextMenu row={row}>{rowElement}</VendorIoRowContextMenu>
              )}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <VendorIoDetailSheet
        open={detailIoId != null}
        onOpenChange={(open) => {
          if (!open) setDetailIoId(null);
        }}
        row={detailRow}
        campaignId={campaignId}
      />
    </>
  );
}
