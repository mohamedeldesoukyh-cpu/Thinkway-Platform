"use client";

import { format } from "date-fns";
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { formatMoney, formatPercent, formatPlatformLabel } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";

type CampaignOverviewTabProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
};

export function CampaignOverviewTab({
  workspace,
  accountManagers,
  teams,
}: CampaignOverviewTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const currency = workspace.currency_code;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit campaign
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Campaign header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Campaign #" value={workspace.document_number} />
              <Row label="Name" value={workspace.name} />
              <Row
                label="Status"
                value={<CampaignStatusBadge status={workspace.status} />}
              />
              <Row
                label="Platform"
                value={formatPlatformLabel(workspace.platform)}
              />
              <Row label="Currency" value={workspace.currency_code} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hierarchy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Group"
                value={
                  workspace.group ? (
                    <Link
                      href={`/groups/${workspace.group.id}`}
                      className="hover:underline"
                    >
                      {workspace.group.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Legal entity"
                value={
                  workspace.client ? (
                    <Link
                      href={`/clients/${workspace.client.id}`}
                      className="hover:underline"
                    >
                      {workspace.client.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Brand" value={workspace.brand?.name ?? "—"} />
              <Row label="Team" value={workspace.team?.name ?? "—"} />
              <Row
                label="Account manager"
                value={
                  workspace.account_manager?.full_name ??
                  workspace.account_manager?.email ??
                  "—"
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Dates"
                value={`${formatDate(workspace.start_date)} – ${formatDate(workspace.end_date)}`}
              />
              <Row
                label="Budget (PO)"
                value={formatMoney(workspace.financials.budget, currency)}
              />
              <Row
                label="Revenue"
                value={formatMoney(workspace.financials.revenue, currency)}
              />
              <Row
                label="Cost"
                value={formatMoney(workspace.financials.cost, currency)}
              />
              <Row
                label="GP"
                value={formatMoney(workspace.financials.gp, currency)}
              />
              <Row
                label="Margin"
                value={formatPercent(workspace.financials.margin_percent)}
              />
            </CardContent>
          </Card>
        </div>

        {workspace.brief ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {workspace.brief}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <CampaignEditSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}
