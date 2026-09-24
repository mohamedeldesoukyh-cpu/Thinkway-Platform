"use client";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { Badge } from "@/components/ui/badge";
import type { VendorPayablesPayload } from "@/lib/vendor-payables/load-payables";
import { payableCurrencyTotals } from "@/lib/vendor-payables/currency-totals";
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
      cellClassName: "max-w-[160px] whitespace-normal break-words",
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

  const totals = payableCurrencyTotals(payables.rows);
  const rows = payables.rows.filter((r) => r.status !== "paid");

  const formatFee = (row: VendorPayableRow) =>
    formatAnalyticsAmount(row.agreed_fee, {
      primary_currency: row.currency,
      is_mixed_currency: false,
      currencies: [row.currency],
      mixed_label: null,
    });

  const columns = buildVendorPayablesColumns(formatFee);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Outstanding AP by currency</p>
          {totals.length === 0 ? <p className="text-sm">No payables</p> : totals.map((total) => (
            <div key={total.currency} className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-semibold">{total.currency} {total.pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="text-xs text-muted-foreground">{total.pendingCount} outstanding rows</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Paid by currency</p>
          {totals.length === 0 ? <p className="text-sm">No payments</p> : totals.map((total) => (
            <div key={total.currency} className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-semibold">{total.currency} {total.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="text-xs text-muted-foreground">{total.paidCount} paid rows</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Totals cover {payables.rows.length} loaded rows in their original currencies. No currency conversion is applied.</p>
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
