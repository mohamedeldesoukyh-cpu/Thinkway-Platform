"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MegaphoneIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  ClientFormSection,
  ClientProfileTabShell,
} from "@/features/clients/components/client-form-ui";
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
        className="font-medium text-[#0057FF] hover:underline"
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
    cellClassName: "text-[#9099A8]",
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

export function ClientCampaignsTab({
  client,
  onCancel,
}: {
  client: ClientDetail;
  onCancel?: () => void;
}) {
  return (
    <ClientProfileTabShell
      title="Campaign history"
      description="Campaign headers linked to brands under this legal entity."
      onCancel={onCancel}
    >
      <ClientFormSection
        icon={MegaphoneIcon}
        title="Campaigns"
        description="Open a campaign workspace from the list below."
      >
        <div className="flex justify-end pb-1">
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.clientCampaigns}
            columns={CLIENT_CAMPAIGNS_TABLE_COLUMNS}
            rows={client.campaigns}
            filterAccessors={CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
          >
            <OperationalTableControlsSlot contextLabel="Client campaigns" />
          </OperationalTableSuiteProvider>
        </div>

        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.clientCampaigns}
          columns={CLIENT_CAMPAIGNS_TABLE_COLUMNS}
          rows={client.campaigns}
          filterAccessors={CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
        >
          {client.campaigns.length === 0 ? (
            <p className="py-6 text-[13px] text-[#9099A8]">
              No campaigns yet for this client.
            </p>
          ) : (
            <div className="-mx-[22px] overflow-x-auto">
              <OperationalConfigurableTable
                columns={CLIENT_CAMPAIGNS_COLUMNS}
                rows={client.campaigns}
                rowKey={(campaign) => campaign.id}
              />
            </div>
          )}
        </OperationalTableSuiteProvider>
      </ClientFormSection>
    </ClientProfileTabShell>
  );
}
