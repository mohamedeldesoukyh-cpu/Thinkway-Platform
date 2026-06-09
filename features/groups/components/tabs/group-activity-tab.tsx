"use client";

import { format } from "date-fns";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney } from "@/features/groups/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { GROUP_RECENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type GroupActivityTabProps = {
  workspace: GroupWorkspace;
};

type RecentCampaignRow = GroupWorkspace["recent_campaigns"][number];

const GROUP_RECENT_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<RecentCampaignRow>[] =
  [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (campaign) => (
        <>
          <span className="font-medium text-foreground">{campaign.name}</span>
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={campaign.document_number} />
          </p>
        </>
      ),
    },
    {
      id: "brand",
      label: "Brand",
      renderCell: (campaign) => campaign.brand_name ?? "—",
    },
    {
      id: "status",
      label: "Status",
      cellClassName: "capitalize",
      renderCell: (campaign) => campaign.status,
    },
    {
      id: "revenue",
      label: "Revenue",
      amountCell: true,
      renderCell: (campaign) => formatGroupMoney(campaign.revenue),
    },
  ];

const GROUP_RECENT_CAMPAIGNS_COLUMN_METAS = getOperationalTableColumnMetas(
  GROUP_RECENT_CAMPAIGNS_COLUMNS
);

export function GroupActivityTab({ workspace }: GroupActivityTabProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Activity & audit
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Entity creation, edits, and changes across this group portfolio.
            </p>
          </div>
        }
      >
        {workspace.activity.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40 px-4 md:px-5">
            {workspace.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-4 last:pb-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium capitalize text-foreground">
                    {item.summary}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.actor?.full_name ?? item.actor?.email ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </OperationalTableSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupRecentCampaigns}
        columns={GROUP_RECENT_CAMPAIGNS_COLUMNS}
        rows={workspace.recent_campaigns}
        filterAccessors={GROUP_RECENT_CAMPAIGNS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Recent campaigns"
              description="Latest campaign headers linked to brands in this group."
              actions={
                <OperationalTableControlsSlot contextLabel="Group recent campaigns" />
              }
            />
          }
        >
          {workspace.recent_campaigns.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No campaigns yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={GROUP_RECENT_CAMPAIGNS_COLUMNS}
              rows={workspace.recent_campaigns}
              rowKey={(campaign) => campaign.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}
