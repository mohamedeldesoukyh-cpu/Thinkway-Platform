"use client";

import { format } from "date-fns";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalDetailRow } from "@/components/workspace/operational-workspace-ui";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import { GroupEditSheet } from "@/features/groups/components/group-edit-sheet";
import type { GroupWorkspace } from "@/features/groups/types";
import { formatGroupMoney, formatPercent } from "@/features/groups/utils";

type GroupOverviewTabProps = {
  workspace: GroupWorkspace;
  accountDirectors: { id: string; full_name: string | null; email: string }[];
};

export function GroupOverviewTab({
  workspace,
  accountDirectors,
}: GroupOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit profile
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CampaignFlatSection title="Identity">
            <OperationalDetailRow label="Group name" value={workspace.name} />
            <OperationalDetailRow label="Region" value={workspace.region ?? "—"} />
            <OperationalDetailRow
              label="Status"
              value={<ClientStatusBadge status={workspace.status} />}
            />
            <OperationalDetailRow
              label="Account director"
              value={
                workspace.account_director?.full_name ??
                workspace.account_director?.email ??
                "—"
              }
            />
            <OperationalDetailRow
              label="Created"
              value={format(new Date(workspace.created_at), "MMM d, yyyy")}
            />
          </CampaignFlatSection>

          <CampaignFlatSection title="Portfolio">
            <OperationalDetailRow
              label="Legal entities"
              value={String(workspace.counts.legal_entities)}
            />
            <OperationalDetailRow label="Brands" value={String(workspace.counts.brands)} />
            <OperationalDetailRow
              label="Campaigns"
              value={String(workspace.counts.campaigns)}
            />
            <OperationalDetailRow
              label="Active campaigns"
              value={String(workspace.financials.active_campaign_count)}
            />
          </CampaignFlatSection>

          <CampaignFlatSection title="Commercial">
            <OperationalDetailRow
              label="Total revenue"
              value={formatGroupMoney(workspace.financials.total_revenue)}
            />
            <OperationalDetailRow
              label="Total GP"
              value={formatGroupMoney(workspace.financials.total_gp)}
            />
            <OperationalDetailRow
              label="Margin"
              value={formatPercent(workspace.financials.margin_percent)}
            />
            <OperationalDetailRow
              label="Billing outstanding"
              value={formatGroupMoney(workspace.financials.billing_outstanding)}
            />
          </CampaignFlatSection>
        </div>

        {workspace.notes ? (
          <CampaignFlatSection title="Notes">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {workspace.notes}
            </p>
          </CampaignFlatSection>
        ) : null}
      </div>

      <GroupEditSheet
        workspace={workspace}
        accountDirectors={accountDirectors}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
