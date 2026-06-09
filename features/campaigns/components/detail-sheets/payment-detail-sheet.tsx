"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignPaymentRow } from "@/features/campaigns/types";
import { formatMoney } from "@/features/campaigns/utils";

type PaymentDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignPaymentRow | null;
  campaignName: string;
};

function formatPaymentDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM d, yyyy");
}

export function PaymentDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
}: PaymentDetailSheetProps) {
  const title = row?.document_number ?? "Payment";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} payment details`}
      description={`Payment details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading payment details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <DocumentNumber value={row.document_number} className="text-foreground/80" />
              </>
            }
            avatarInitials="PAY"
            title={<DocumentNumber value={row.document_number} className="text-lg font-semibold" />}
            badges={
              <>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {row.status}
                </Badge>
                <DetailPill>{formatMoney(row.amount, row.currency)}</DetailPill>
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="px-1">
              <DetailField label="Payment #">
                <DocumentNumber value={row.document_number} />
              </DetailField>
              <DetailField label="Invoice #">
                <DocumentNumber value={row.invoice_document_number} />
              </DetailField>
              <DetailField label="Amount">
                {formatMoney(row.amount, row.currency)}
              </DetailField>
              <DetailField label="Currency">
                <DetailPill>{row.currency}</DetailPill>
              </DetailField>
              <DetailField label="Status" valueClassName="capitalize">
                {row.status}
              </DetailField>
              <DetailField label="Paid at">{formatPaymentDate(row.paid_at)}</DetailField>
            </div>
          </div>
        </>
      )}
    </OperationalDetailSheet>
  );
}
