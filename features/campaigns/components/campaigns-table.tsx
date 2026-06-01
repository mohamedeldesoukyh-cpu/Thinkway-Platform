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
import type { CampaignListItem } from "@/types/database";

import { formatMoney, formatPlatformLabel, getCampaignPlatform } from "../utils";
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

function sumPo(lines: CampaignListItem["lines"]) {
  return lines.reduce((sum, line) => sum + Number(line.po_amount ?? 0), 0);
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <div className="overflow-x-auto">
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
                  <span className="font-mono text-xs">
                    {campaign.lines.map((l) => l.document_number).join(", ")}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>
                {formatMoney(sumPo(campaign.lines), campaign.currency_code)}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDate(campaign.start_date)} – {formatDate(campaign.end_date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
