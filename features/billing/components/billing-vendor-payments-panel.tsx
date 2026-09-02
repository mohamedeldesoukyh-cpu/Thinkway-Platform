"use client";

import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { DocumentNumber } from "@/components/ui/document-number";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import { BillingCardHeader } from "@/features/billing/components/billing-card-header";
import { formatQueueNumber } from "@/features/billing/components/use-billing-queue-column-visibility";
import type { VendorAssignmentPaymentRow } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { cn } from "@/lib/utils";

export const BILLING_VENDOR_ASSIGNMENTS_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "select", label: "Select", locked: true },
  { id: "creator", label: "Creator" },
  { id: "campaign", label: "Campaign" },
  { id: "assignment", label: "Assignment" },
  { id: "currency", label: "Currency" },
  { id: "sell_value", label: "Sell value" },
  { id: "vendor_cost", label: "Vendor cost" },
  { id: "paid", label: "Paid" },
  { id: "payment_state", label: "Payment state" },
  { id: "client_invoice", label: "Client invoice" },
];

const VENDOR_GRID_TRACKS = [
  { id: "select", width: "32px" },
  { id: "creator", width: "minmax(150px,1.2fr)" },
  { id: "campaign", width: "minmax(120px,1fr)" },
  { id: "assignment", width: "118px" },
  { id: "currency", width: "48px" },
  { id: "sell_value", width: "124px" },
  { id: "vendor_cost", width: "108px" },
  { id: "paid", width: "88px" },
  { id: "payment_state", width: "110px" },
  { id: "client_invoice", width: "112px" },
] as const;

function paymentStateLabel(status: VendorAssignmentPaymentRow["payment_status"]): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unpaid";
  }
}

function paymentStateClass(status: VendorAssignmentPaymentRow["payment_status"]): string {
  if (status === "paid") return "p-inv";
  if (status === "cancelled") return "p-draft";
  return "p-part";
}

function useVendorAssignmentColumnVisibility() {
  return {
    select: useIsOperationalColumnVisible("select"),
    creator: useIsOperationalColumnVisible("creator"),
    campaign: useIsOperationalColumnVisible("campaign"),
    assignment: useIsOperationalColumnVisible("assignment"),
    currency: useIsOperationalColumnVisible("currency"),
    sell_value: useIsOperationalColumnVisible("sell_value"),
    vendor_cost: useIsOperationalColumnVisible("vendor_cost"),
    paid: useIsOperationalColumnVisible("paid"),
    payment_state: useIsOperationalColumnVisible("payment_state"),
    client_invoice: useIsOperationalColumnVisible("client_invoice"),
  };
}

function vendorGridTemplate(cols: ReturnType<typeof useVendorAssignmentColumnVisibility>): string {
  return VENDOR_GRID_TRACKS.filter((track) => cols[track.id])
    .map((track) => track.width)
    .join(" ");
}

type BillingVendorPaymentsPanelProps = {
  assignments: VendorAssignmentPaymentRow[];
  settingsSlot?: ReactNode;
};

export function BillingVendorPaymentsPanel({
  assignments,
  settingsSlot,
}: BillingVendorPaymentsPanelProps) {
  const displayAssignments =
    useOperationalTableDataContextOptional<VendorAssignmentPaymentRow>()?.processedRows ??
    assignments;
  const cols = useVendorAssignmentColumnVisibility();
  const template = vendorGridTemplate(cols);
  const gridStyle: CSSProperties = { gridTemplateColumns: template };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const currencies = useMemo(
    () => [...new Set(displayAssignments.map((row) => row.currency).filter(Boolean))],
    [displayAssignments]
  );
  const mixedCurrency = currencies.length > 1;
  const kpiCurrency = currencies.length === 1 ? currencies[0] : undefined;

  const totals = useMemo(() => {
    let vendorCost = 0;
    let unpaid = 0;
    let paid = 0;
    for (const row of displayAssignments) {
      const cost = row.vendor_cost ?? 0;
      vendorCost += cost;
      paid += row.paid_amount;
      if (row.payment_status === "unpaid" || row.payment_status === "pending") {
        unpaid += cost;
      }
    }
    return { vendorCost, unpaid, paid };
  }, [displayAssignments]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        campaignHeaderId: string;
        campaignName: string;
        campaignNo: string | null;
        rows: VendorAssignmentPaymentRow[];
      }
    >();
    for (const row of displayAssignments) {
      const key = row.campaign_header_id ?? row.campaign_document_number ?? `row:${row.id}`;
      const group = map.get(key);
      if (group) {
        group.rows.push(row);
        continue;
      }
      map.set(key, {
        campaignHeaderId: key,
        campaignName: row.campaign_name,
        campaignNo: row.campaign_document_number,
        rows: [row],
      });
    }
    return [...map.values()];
  }, [displayAssignments]);

  const formatKpi = (amount: number) =>
    mixedCurrency || !kpiCurrency
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
      : formatBillingMoney(amount, kpiCurrency);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bq-card">
      <div className="bq-card__h">
        <BillingCardHeader
          title="Vendor payments"
          subtitle="one row per assignment — a creator on a campaign"
          actions={settingsSlot}
        />
      </div>
      <div className="bq-pad" style={{ paddingBottom: 6 }}>
        <div className="bq-st">
          <span>
            <i>Total vendor cost</i>
            <b>{formatKpi(totals.vendorCost)}</b>
          </span>
          <span>
            <i>Unpaid</i>
            <b className={totals.unpaid > 0 ? "bad" : undefined}>{formatKpi(totals.unpaid)}</b>
          </span>
          <span>
            <i>Paid</i>
            <b>{formatKpi(totals.paid)}</b>
          </span>
          <span>
            <i>Assignments exposed</i>
            <b>{displayAssignments.length}</b>
          </span>
        </div>
      </div>

      {displayAssignments.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No vendor assignments to pay.
        </p>
      ) : (
        <div className="bq-scroll">
          <div className="bq-vgrid">
            <div className="bq-vhd" style={gridStyle}>
              {cols.select ? <span /> : null}
              {cols.creator ? <span>Creator</span> : null}
              {cols.campaign ? <span>Campaign</span> : null}
              {cols.assignment ? <span>Assignment</span> : null}
              {cols.currency ? <span>Ccy</span> : null}
              {cols.sell_value ? <span>Sell value</span> : null}
              {cols.vendor_cost ? <span>Vendor cost</span> : null}
              {cols.paid ? <span>Paid</span> : null}
              {cols.payment_state ? <span>Payment state</span> : null}
              {cols.client_invoice ? <span>Client invoice</span> : null}
            </div>
            {grouped.map((group) => (
              <Fragment key={group.campaignHeaderId}>
                <div className="bq-vgrp">
                  {group.campaignName}{" "}
                  <em>
                    {formatDocumentNumberForDisplay(group.campaignNo)}
                    {group.campaignNo ? " · " : null}
                    {group.rows.length} assignment{group.rows.length === 1 ? "" : "s"}
                  </em>
                </div>
                {group.rows.map((row) => {
                  const selected = selectedIds.has(row.id);
                  return (
                    <div
                      key={row.id}
                      className={cn("bq-vrow", selected && "sel")}
                      style={gridStyle}
                    >
                      {cols.select ? (
                        <span>
                          <input
                            type="checkbox"
                            className="bq-ck"
                            aria-label={`Select ${row.creator_name}`}
                            checked={selected}
                            onChange={() => toggleSelected(row.id)}
                          />
                        </span>
                      ) : null}
                      {cols.creator ? (
                        <span className="bq-kn" title={row.creator_name}>
                          {row.creator_name}
                        </span>
                      ) : null}
                      {cols.campaign ? (
                        <span className="bq-cm" title={row.campaign_name}>
                          {row.campaign_document_number ? (
                            <>
                              <DocumentNumber
                                value={row.campaign_document_number}
                                showCanonicalTitle={false}
                              />{" "}
                            </>
                          ) : null}
                          {row.campaign_name}
                        </span>
                      ) : null}
                      {cols.assignment ? (
                        <span className="bq-kid">
                          <DocumentNumber value={row.assignment_document_number} />
                        </span>
                      ) : null}
                      {cols.currency ? (
                        <span>
                          {row.currency ? <span className="bq-cc">{row.currency}</span> : "—"}
                        </span>
                      ) : null}
                      {cols.sell_value ? (
                        <span className={cn("bq-v", row.sell_value === 0 && "z")}>
                          {formatQueueNumber(row.sell_value)}
                        </span>
                      ) : null}
                      {cols.vendor_cost ? (
                        row.vendor_cost == null ? (
                          <span className="bq-miss">not exposed</span>
                        ) : (
                          <span className="bq-v">{formatQueueNumber(row.vendor_cost)}</span>
                        )
                      ) : null}
                      {cols.paid ? (
                        <span className={cn("bq-v", row.paid_amount === 0 && "z")}>
                          {formatQueueNumber(row.paid_amount)}
                        </span>
                      ) : null}
                      {cols.payment_state ? (
                        <span>
                          <span className={cn("bq-p", paymentStateClass(row.payment_status))}>
                            {paymentStateLabel(row.payment_status)}
                          </span>
                        </span>
                      ) : null}
                      {cols.client_invoice ? (
                        <span className="bq-no">
                          <DocumentNumber value={row.invoice_document_number} />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

