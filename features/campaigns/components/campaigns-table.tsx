import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
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
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatMoney } from "@/features/campaigns/utils";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  PO_ALERT_FRAME,
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
  resolvePoAlertStatus,
} from "@/lib/finance/po/status";
import type { CampaignListItem } from "@/types/database";
import { cn } from "@/lib/utils";

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}

function campaignPoBudget(campaign: CampaignListItem) {
  return resolveCampaignListPoBudget(campaign);
}

function listPoAlertStatus(campaign: CampaignListItem) {
  const budget = campaignPoBudget(campaign);
  const consumed = Number(campaign.po_consumed_amount ?? 0);
  return resolvePoAlertStatus({
    po_status: campaign.po_status ?? "draft",
    po_exceeded: budget > 0 && consumed > budget,
  });
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <CampaignOperationalTable>
      <CampaignOperationalTableHeader>
        <CampaignOperationalTableHeaderRow>
          <CampaignOperationalTableHead>Campaign #</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Name</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Brand</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Group · Legal entity</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Lines</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
          <CampaignOperationalTableHead className="text-right">PO total</CampaignOperationalTableHead>
          <CampaignOperationalTableHead>Dates</CampaignOperationalTableHead>
        </CampaignOperationalTableHeaderRow>
      </CampaignOperationalTableHeader>
      <CampaignOperationalTableBody>
        {campaigns.map((campaign) => {
          const poAlertStatus = listPoAlertStatus(campaign);
          const href = `/campaigns/${campaign.id}`;

          return (
            <CampaignOperationalTableRow key={campaign.id}>
              <CampaignOperationalTableCell className="text-muted-foreground">
                <Link href={href} className="hover:text-foreground hover:underline">
                  <DocumentNumber value={campaign.document_number} />
                </Link>
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                <Link
                  href={href}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {campaign.name}
                </Link>
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-muted-foreground">
                {campaign.brand?.name ?? "—"}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-muted-foreground">
                {campaign.group?.name ?? "—"}
                {campaign.client?.legal_name || campaign.client?.name
                  ? ` · ${campaign.client.legal_name ?? campaign.client.name}`
                  : ""}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                {campaign.lines.length > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
                    title={campaign.lines
                      .map((l) => formatDocumentNumberForDisplay(l.document_number))
                      .join(", ")}
                  >
                    {campaign.lines.length}{" "}
                    {campaign.lines.length === 1 ? "line" : "lines"}
                  </Badge>
                ) : (
                  "—"
                )}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                <CampaignStatusBadge
                  status={campaign.status}
                  className={OPERATIONAL_CHROME_STATUS_BADGE}
                />
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCellAmount>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      poAlertStatus === "exceeded" && "text-red-600 dark:text-red-400",
                      poAlertStatus === "near_limit" && "text-amber-700 dark:text-amber-300"
                    )}
                  >
                    {formatMoney(campaignPoBudget(campaign), campaign.currency_code)}
                  </span>
                  {campaign.po_status && campaign.po_status !== "draft" ? (
                    <Badge
                      variant={PO_STATUS_VARIANT[campaign.po_status]}
                      className={cn(
                        OPERATIONAL_CHROME_STATUS_BADGE,
                        "font-normal",
                        poAlertStatus && "border-2",
                        poAlertStatus && PO_ALERT_FRAME[poAlertStatus]
                      )}
                    >
                      {PO_STATUS_LABELS[campaign.po_status]}
                    </Badge>
                  ) : null}
                </div>
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
              </CampaignOperationalTableCell>
            </CampaignOperationalTableRow>
          );
        })}
      </CampaignOperationalTableBody>
    </CampaignOperationalTable>
  );
}
