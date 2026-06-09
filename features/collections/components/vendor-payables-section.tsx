"use client";

import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { Badge } from "@/components/ui/badge";
import type { VendorPayablesPayload } from "@/lib/vendor-payables/load-payables";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";

type VendorPayablesSectionProps = {
  payables: VendorPayablesPayload | null;
};

type VendorPayableRow = VendorPayablesPayload["rows"][number];

function buildVendorPayablesColumns(
  formatFee: (row: VendorPayableRow) => string
): OperationalConfigurableColumnDef<VendorPayableRow>[] {
  return [
    {
      id: "vendor",
      label: "Vendor",
      renderCell: (row) => row.influencer_name,
    },
    {
      id: "campaign",
      label: "Campaign",
      cellClassName: "max-w-[160px] truncate",
      renderCell: (row) => row.campaign_name,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => <Badge variant="outline">{row.status}</Badge>,
    },
    {
      id: "fee",
      label: "Fee",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatFee(row),
    },
  ];
}

const VENDOR_PAYABLES_TABLE_COLUMNS = buildVendorPayablesColumns(() => "—");

export const VENDOR_PAYABLES_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  VENDOR_PAYABLES_TABLE_COLUMNS
);

export function VendorPayablesSection({ payables }: VendorPayablesSectionProps) {
  if (!payables) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        Vendor payables data unavailable.
      </p>
    );
  }

  const currency = {
    primary_currency: "USD",
    is_mixed_currency: false,
    currencies: ["USD"],
    mixed_label: null,
  };

  const rows = payables.rows.filter((r) => r.status !== "paid").slice(0, 30);

  const formatFee = (row: VendorPayableRow) =>
    formatAnalyticsAmount(row.agreed_fee, {
      ...currency,
      primary_currency: row.currency,
    });

  const columns = useMemo(() => buildVendorPayablesColumns(formatFee), [payables]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Outstanding AP</p>
          <p className="text-lg font-semibold">
            {formatAnalyticsAmount(payables.total_pending, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Paid (loaded slice)</p>
          <p className="text-lg font-semibold">
            {formatAnalyticsAmount(payables.total_paid, currency)}
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No outstanding vendor payables.
        </p>
      ) : (
        <OperationalConfigurableTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
        />
      )}
    </div>
  );
}
