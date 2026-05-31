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

import {
  formatMoney,
  formatPlatformLabel,
  getCampaignPlatform,
} from "../utils";
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

function formatManagerName(campaign: CampaignListItem) {
  const manager = campaign.account_manager;
  if (!manager) {
    return "—";
  }

  return manager.full_name ?? manager.email;
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Account manager</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-mono text-xs">
                {campaign.document_number}
              </TableCell>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>{campaign.client?.name ?? "—"}</TableCell>
              <TableCell>
                {formatPlatformLabel(getCampaignPlatform(campaign.metadata))}
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>
                {formatMoney(Number(campaign.budget), campaign.currency)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <span className="whitespace-nowrap">
                  {formatDate(campaign.start_date)}
                  {" – "}
                  {formatDate(campaign.end_date)}
                </span>
              </TableCell>
              <TableCell>{formatManagerName(campaign)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
