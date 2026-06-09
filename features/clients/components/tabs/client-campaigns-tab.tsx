"use client";

import Link from "next/link";
import { format } from "date-fns";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { ClientDetail } from "@/types/database";

type CampaignRow = ClientDetail["campaigns"][number];

const CLIENT_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<CampaignRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (campaign) => (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="font-medium hover:text-primary"
      >
        {campaign.name}
      </Link>
    ),
  },
  {
    id: "campaign_number",
    label: "Campaign #",
    monoCell: true,
    renderCell: (campaign) => <DocumentNumber value={campaign.document_number} />,
  },
  {
    id: "brand",
    label: "Brand",
    renderCell: (campaign) =>
      (campaign.brand as { name: string } | null)?.name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (campaign) => campaign.status.replace(/_/g, " "),
  },
  {
    id: "currency",
    label: "Currency",
    renderCell: (campaign) => campaign.currency_code,
  },
  {
    id: "dates",
    label: "Dates",
    cellClassName: "text-muted-foreground",
    renderCell: (campaign) => (
      <>
        {campaign.start_date
          ? format(new Date(campaign.start_date), "MMM d, yyyy")
          : "—"}
        {" — "}
        {campaign.end_date
          ? format(new Date(campaign.end_date), "MMM d, yyyy")
          : "—"}
      </>
    ),
  },
];

export const CLIENT_CAMPAIGNS_TABLE_COLUMNS = CLIENT_CAMPAIGNS_COLUMNS;

export function ClientCampaignsTab({ client }: { client: ClientDetail }) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.clientCampaigns}
      columns={CLIENT_CAMPAIGNS_TABLE_COLUMNS}
      rows={client.campaigns}
      filterAccessors={CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Campaign history"
            description="Campaign headers linked to brands under this legal entity."
            actions={
              <OperationalTableControlsSlot contextLabel="Client campaigns" />
            }
          />
        }
      >
        {client.campaigns.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No campaigns yet for this client.
          </p>
        ) : (
          <OperationalConfigurableTable
            columns={CLIENT_CAMPAIGNS_COLUMNS}
            rows={client.campaigns}
            rowKey={(campaign) => campaign.id}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
