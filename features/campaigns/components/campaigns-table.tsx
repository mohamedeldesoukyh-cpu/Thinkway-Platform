import Link from "next/link";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CampaignListItem } from "@/types/database";

import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";

import { formatMoney } from "../utils";
import { CampaignStatusBadge } from "./campaign-status-badge";

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

function isCampaignPoExceeded(campaign: CampaignListItem): boolean {
  const budget = campaignPoBudget(campaign);
  const consumed = Number(campaign.po_consumed_amount ?? 0);
  return budget > 0 && consumed > budget;
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Group · Legal entity</TableHead>
            <TableHead>Lines</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>PO total</TableHead>
            <TableHead>Dates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-mono text-xs">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="hover:underline"
                >
                  {campaign.document_number}
                </Link>
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="hover:underline"
                >
                  {campaign.name}
                </Link>
              </TableCell>
              <TableCell>{campaign.brand?.name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {campaign.group?.name ?? "—"}
                {campaign.client?.legal_name || campaign.client?.name
                  ? ` · ${campaign.client.legal_name ?? campaign.client.name}`
                  : ""}
              </TableCell>
              <TableCell>
                {campaign.lines.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="text-[11px]"
                    title={campaign.lines.map((l) => l.document_number).join(", ")}
                  >
                    {campaign.lines.length}{" "}
                    {campaign.lines.length === 1 ? "line" : "lines"}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span
                    className={
                      isCampaignPoExceeded(campaign)
                        ? "font-medium text-red-600 dark:text-red-400"
                        : undefined
                    }
                  >
                    {formatMoney(campaignPoBudget(campaign), campaign.currency_code)}
                  </span>
                  {campaign.po_status && campaign.po_status !== "draft" ? (
                    <Badge
                      variant={PO_STATUS_VARIANT[campaign.po_status]}
                      className="w-fit text-[10px]"
                    >
                      {PO_STATUS_LABELS[campaign.po_status]}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}
