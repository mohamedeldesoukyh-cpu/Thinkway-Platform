"use client";

import Link from "next/link";
import { format } from "date-fns";

import { InvoiceStatusBadge } from "@/components/finance/invoice-status-badge";
import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { InvoiceUngenerateTrigger } from "@/features/finance/invoices/components/invoice-ungenerate-dialog";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import { formatMoney } from "@/features/campaigns/utils";
import {
  invoiceUngenerateIneligibleReason,
  isInvoiceUngenerateEligible,
} from "@/lib/billing/invoice-ungenerate-eligibility";
import { cn } from "@/lib/utils";

type FinanceInvoiceRegisterTableProps = {
  rows: FinanceInvoiceRegisterRow[];
  showUngenerate?: boolean;
  /** Match campaign workspace assignment table typography */
  appearance?: "default" | "campaign";
};

function formatRegisterDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

export function FinanceInvoiceRegisterTable({
  rows,
  showUngenerate = false,
  appearance = "default",
}: FinanceInvoiceRegisterTableProps) {
  const campaign = appearance === "campaign";

  const RootTable = campaign ? CampaignOperationalTable : Table;
  const RootHeader = campaign ? CampaignOperationalTableHeader : TableHeader;
  const RootHeaderRow = campaign ? CampaignOperationalTableHeaderRow : TableRow;
  const RootHead = campaign ? CampaignOperationalTableHead : TableHead;
  const RootBody = campaign ? CampaignOperationalTableBody : TableBody;
  const RootRow = campaign ? CampaignOperationalTableRow : TableRow;
  const RootCell = campaign ? CampaignOperationalTableCell : TableCell;
  const RootAmountCell = campaign ? CampaignOperationalTableCellAmount : TableCell;

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No invoices in the register yet.
      </p>
    );
  }

  function formatAmount(value: number, currency: string) {
    return campaign ? formatOperationalAmount(value) : formatMoney(value, currency);
  }

  return (
    <RootTable>
      <RootHeader>
        <RootHeaderRow className={campaign ? undefined : "text-[10px] uppercase tracking-wide"}>
          <RootHead>Invoice number</RootHead>
          <RootHead>Client</RootHead>
          <RootHead>Brand</RootHead>
          <RootHead>Campaign</RootHead>
          <RootHead className="text-right">Rev. before VAT</RootHead>
          <RootHead className="text-right">VAT</RootHead>
          <RootHead className="text-right">Rev. after VAT</RootHead>
          <RootHead>Invoice status</RootHead>
          <RootHead>Locked</RootHead>
          <RootHead>Created</RootHead>
          {showUngenerate ? <RootHead className={campaign ? "w-[100px]" : "w-[100px]"}>Actions</RootHead> : null}
        </RootHeaderRow>
      </RootHeader>
      <RootBody>
        {rows.map((row) => (
          <RootRow
            key={row.id}
            className={cn(
              !campaign && "text-xs",
              row.regeneration_status === "pending_regeneration" && "opacity-50"
            )}
          >
            <RootCell>
              <Link
                href={`/billing/invoices/${row.id}`}
                className="text-[11px] font-medium tabular-nums hover:underline"
              >
                <DocumentNumber value={row.document_number} />
              </Link>
            </RootCell>
            <RootCell>{row.client_name}</RootCell>
            <RootCell>{row.brand_name ?? "—"}</RootCell>
            <RootCell>
              {row.campaign_name ? (
                <div>
                  {row.campaign_document_number ? (
                    <DocumentNumber
                      value={row.campaign_document_number}
                      className="text-[11px] text-muted-foreground"
                    />
                  ) : null}
                  <p className="max-w-[160px] truncate font-medium">{row.campaign_name}</p>
                </div>
              ) : (
                "—"
              )}
            </RootCell>
            <RootAmountCell className={campaign ? undefined : "text-right font-mono"}>
              {formatAmount(row.revenue_before_vat, row.currency)}
            </RootAmountCell>
            <RootAmountCell className={campaign ? undefined : "text-right font-mono"}>
              {formatAmount(row.vat_amount, row.currency)}
            </RootAmountCell>
            <RootAmountCell className={campaign ? undefined : "text-right font-mono"}>
              {formatAmount(row.revenue_after_vat, row.currency)}
            </RootAmountCell>
            <RootCell>
              <InvoiceStatusBadge status={row.status} />
            </RootCell>
            <RootCell>
              <Badge
                variant={row.locked_status === "Locked" ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {row.locked_status}
              </Badge>
            </RootCell>
            <RootCell className="text-muted-foreground">
              {formatRegisterDate(row.created_date)}
            </RootCell>
            {showUngenerate ? (
              <RootCell>
                {isInvoiceUngenerateEligible(row) ? (
                  <InvoiceUngenerateTrigger
                    invoiceId={row.id}
                    documentNumber={row.document_number}
                  />
                ) : (
                  <span
                    className="text-[10px] text-muted-foreground"
                    title={invoiceUngenerateIneligibleReason(row) ?? "Not eligible"}
                  >
                    —
                  </span>
                )}
              </RootCell>
            ) : null}
          </RootRow>
        ))}
      </RootBody>
    </RootTable>
  );
}
