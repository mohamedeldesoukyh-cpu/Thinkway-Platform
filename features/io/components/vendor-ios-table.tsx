"use client";
import { DocumentWindowLink } from "@/components/navigation/document-window-link";


import "./vendor-ios-table.css";
import { campaignMoney } from "@/features/campaigns/components/campaign-money";
import Link from "next/link";
import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoDeliveryBadge } from "@/features/io/components/vendor-io-delivery-badge";
import { VendorIoSendButton } from "@/features/io/components/vendor-io-send-button";
import { VendorIoSpecialPaymentTermsCell } from "@/features/io/components/vendor-io-special-payment-terms-cell";
import { VendorIoCampaignTermsEditor } from "./vendor-io-campaign-terms-editor";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import { VendorIoCancelTrigger } from "./vendor-io-cancel-dialog";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import type { VendorIoRow } from "@/features/io/types";
import { FinanceSuiteEmpty } from "@/components/finance/suite";
import { cn } from "@/lib/utils";

type Props = {
  rows: VendorIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
};

function buildVendorIosColumns(
  onView: (ioId: string) => void,
  isNavigating: boolean
): OperationalConfigurableColumnDef<VendorIoRow>[] {
  return [
    {
      id: "io_number",
      colWidth: "130px",
      label: "IO #",
      monoCell: true,
      renderCell: (row) => <DocumentNumber value={row.document_number} />,
    },
    {
      id: "influencer",
      colWidth: "165px",
      label: "Influencer",
      renderCell: (row) => row.influencer_name,
    },
    {
      id: "campaign",
      colWidth: "260px",
      label: "Campaign",
      renderCell: (row) => (
        <Link
          href={`/campaigns/${row.campaign_header_id}`}
          className="vendor-io-campaign"
        >
          <span className="vendor-io-reference"><DocumentNumber value={row.campaign_document_number} /></span>{row.campaign_name}
        </Link>
      ),
    },
    {
      id: "assignment",
      colWidth: "130px",
      defaultVisible: false,
      label: "Assignment",
      monoCell: true,
      renderCell: (row) => row.assignment_document_number ?? "—",
    },
    {
      id: "amount",
      colWidth: "145px",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => campaignMoney(row.amount, row.currency_code),
    },
    {
      id: "status",
      colWidth: "185px",
      label: "Status",
      renderCell: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
              Workflow
            </span>
            <IoStatusBadge status={row.status} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground">
              Delivery
            </span>
            {row.delivery_method ? (
              <VendorIoDeliveryBadge
                deliveryMethod={row.delivery_method}
                deliveryStatus={row.delivery_status}
              />
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "current_payment_terms",
      colWidth: "180px",
      label: "Payment terms",
      cellClassName: "text-muted-foreground max-w-[10rem]",
      renderCell: (row) => <VendorIoCampaignTermsEditor row={row} />,
    },
    {
      id: "usage_rights",
      colWidth: "170px",
      defaultVisible: false,
      label: "Usage rights",
      renderCell: (row) => <VendorIoCampaignTermsEditor row={row} field="usage" />,
    },
    {
      id: "compliance_country",
      colWidth: "130px",
      defaultVisible: false,
      label: "Compliance country",
      renderCell: (row) => <VendorIoCampaignTermsEditor row={row} field="country" />,
    },
    {
      id: "special_payment_terms",
      colWidth: "220px",
      defaultVisible: false,
      label: "Special payment terms",
      renderCell: (row) => <VendorIoSpecialPaymentTermsCell row={row} />,
    },
    {
      id: "sent",
      colWidth: "145px",
      defaultVisible: false,
      label: "Sent",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.sent_at ? new Date(row.sent_at).toLocaleString() : "—",
    },
    {
      id: "approved",
      colWidth: "145px",
      defaultVisible: false,
      label: "Approved",
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.approved_at ? new Date(row.approved_at).toLocaleString() : "—",
    },
    {
      id: "actions",
      colWidth: "190px",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (row) => (
        <div className="inline-flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" asChild>
            <DocumentWindowLink href={`/ios/vendor/${row.id}/preview`} target="_blank" rel="noopener noreferrer">
              View IO
            </DocumentWindowLink>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(row.id)}
            disabled={isNavigating}
          >
            Open
          </Button>
          <VendorIoSendButton row={row} variant="outline" />
          <VendorIoCancelTrigger row={row} />
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

export const VENDOR_IOS_TABLE_COLUMNS = buildVendorIosColumns(() => {}, false);

export const VENDOR_IOS_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(VENDOR_IOS_TABLE_COLUMNS);

export function VendorIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
}: Props) {
  const columns = useMemo(
    () => buildVendorIosColumns(onView, isNavigating),
    [onView, isNavigating]
  );

  if (rows.length === 0) {
    return (
      <FinanceSuiteEmpty
        title="No vendor IO records found"
        body="Insertion orders appear here one per creator assignment. Generate an IO from a campaign assignment to populate this register."
      />
    );
  }

  return (
    <OperationalConfigurableTable
      className="vendor-io-register-table"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowClassName={(row) => cn(selectedId === row.id && "bg-muted/50")}
      wrapRow={(row, rowElement) => (
        <VendorIoRowContextMenu row={row}>{rowElement}</VendorIoRowContextMenu>
      )}
    />
  );
}
