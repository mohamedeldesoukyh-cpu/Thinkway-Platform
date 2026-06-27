"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ActivityIcon } from "lucide-react";

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
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

type CampaignRow = ClientDetail["campaigns"][number];

function buildClientCampaignsColumns(
  platformV6: boolean
): OperationalConfigurableColumnDef<CampaignRow>[] {
  return [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (campaign) => (
        <Link
          href={`/campaigns/${campaign.id}`}
          className={cn(
            platformV6
              ? "platform-v6-link font-medium"
              : "font-medium text-[#0057FF] hover:underline"
          )}
        >
          {campaign.name}
        </Link>
      ),
    },
    {
      id: "campaign_number",
      label: "Campaign #",
      monoCell: true,
      renderCell: (campaign) =>
        platformV6 ? (
          <Link
            href={`/campaigns/${campaign.id}`}
            className="platform-v6-link tabular-nums"
          >
            <DocumentNumber
              value={campaign.document_number}
              showCanonicalTitle={false}
            />
          </Link>
        ) : (
          <DocumentNumber value={campaign.document_number} />
        ),
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
      cellClassName: platformV6 ? "text-[11px] text-[var(--tw-text-3)]" : "text-[#9099A8]",
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
}

export const CLIENT_CAMPAIGNS_TABLE_COLUMNS = buildClientCampaignsColumns(false);

export function ClientCampaignsTab({
  client,
  onCancel,
}: {
  client: ClientDetail;
  onCancel?: () => void;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const columns = buildClientCampaignsColumns(platformV6);

  return (
    <ClientProfileTabShell
      title="Campaign history"
      description="Campaign headers linked to brands under this legal entity."
      onCancel={onCancel}
    >
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientCampaigns}
        columns={columns}
        rows={client.campaigns}
        filterAccessors={CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
      >
        <ClientFormSection
          icon={ActivityIcon}
          iconClassName={platformV6 ? "platform-v6-wide-form-head-icon-green" : undefined}
          title="Campaigns"
          description="Open a campaign workspace from the list below."
          toolbar={
            <OperationalTableControlsSlot contextLabel="Client campaigns" />
          }
          bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
        >
          {client.campaigns.length === 0 ? (
            <div
              className={cn(
                platformV6 ? "platform-v6-empty-state" : "py-6 text-[13px] text-[#9099A8]"
              )}
            >
              No campaigns yet for this client.
            </div>
          ) : (
            <div
              className={cn(
                "overflow-x-auto",
                !platformV6 && "-mx-[22px]"
              )}
            >
              <OperationalConfigurableTable
                columns={columns}
                rows={client.campaigns}
                rowKey={(campaign) => campaign.id}
                className={platformV6 ? "platform-v6-data-table" : undefined}
              />
            </div>
          )}
        </ClientFormSection>
      </OperationalTableSuiteProvider>
    </ClientProfileTabShell>
  );
}
