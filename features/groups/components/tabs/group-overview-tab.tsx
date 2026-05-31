"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Group name" value={workspace.name} />
              <Row label="Region" value={workspace.region ?? "—"} />
              <Row
                label="Status"
                value={<ClientStatusBadge status={workspace.status} />}
              />
              <Row
                label="Account director"
                value={
                  workspace.account_director?.full_name ??
                  workspace.account_director?.email ??
                  "—"
                }
              />
              <Row
                label="Created"
                value={format(new Date(workspace.created_at), "MMM d, yyyy")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Legal entities"
                value={String(workspace.counts.legal_entities)}
              />
              <Row label="Brands" value={String(workspace.counts.brands)} />
              <Row
                label="Campaigns"
                value={String(workspace.counts.campaigns)}
              />
              <Row
                label="Active campaigns"
                value={String(workspace.financials.active_campaign_count)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Total revenue"
                value={formatGroupMoney(workspace.financials.total_revenue)}
              />
              <Row
                label="Total GP"
                value={formatGroupMoney(workspace.financials.total_gp)}
              />
              <Row
                label="Margin"
                value={formatPercent(workspace.financials.margin_percent)}
              />
              <Row
                label="Billing outstanding"
                value={formatGroupMoney(workspace.financials.billing_outstanding)}
              />
            </CardContent>
          </Card>
        </div>

        {workspace.notes ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {workspace.notes}
              </p>
            </CardContent>
          </Card>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
