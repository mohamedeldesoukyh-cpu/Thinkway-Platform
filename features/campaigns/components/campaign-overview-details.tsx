"use client";

import { format } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { formatMoney, formatPercent, formatPlatformLabel } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignOverviewDetailsProps = {
  workspace: CampaignWorkspace;
  layout?: "stack" | "grid";
};

export function CampaignOverviewDetails({
  workspace,
  layout = "grid",
}: CampaignOverviewDetailsProps) {
  const currency = workspace.currency_code;

  return (
    <div
      className={cn(
        "gap-4",
        layout === "grid"
          ? "grid md:grid-cols-1"
          : "flex flex-col"
      )}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaign header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DetailRow label="Campaign #" value={workspace.document_number} />
          <DetailRow label="Name" value={workspace.name} />
          <DetailRow
            label="Status"
            value={<CampaignStatusBadge status={workspace.status} />}
          />
          <DetailRow
            label="Platform"
            value={formatPlatformLabel(workspace.platform)}
          />
          <DetailRow label="Currency" value={workspace.currency_code} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DetailRow
            label="Group"
            value={
              workspace.group ? (
                <Link
                  href={`/groups/${workspace.group.id}`}
                  className="text-primary hover:underline"
                >
                  {workspace.group.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Legal entity"
            value={
              workspace.client ? (
                <Link
                  href={`/clients/${workspace.client.id}`}
                  className="text-primary hover:underline"
                >
                  {workspace.client.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <DetailRow label="Brand" value={workspace.brand?.name ?? "—"} />
          <DetailRow label="Team" value={workspace.team?.name ?? "—"} />
          <DetailRow
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
          <DetailRow
            label="Dates"
            value={`${formatDate(workspace.start_date)} – ${formatDate(workspace.end_date)}`}
          />
          <DetailRow
            label="Budget (PO)"
            value={
              <span
                className={cn(
                  workspace.financials.po_exceeded &&
                    "font-medium text-red-600 dark:text-red-400"
                )}
              >
                {formatMoney(workspace.financials.budget, currency)}
              </span>
            }
          />
          {workspace.financials.po_exceeded ||
          workspace.po.po_status === "near_limit" ? (
            <DetailRow
              label="PO utilization"
              value={
                <Badge variant={PO_STATUS_VARIANT[workspace.po.po_status]}>
                  {PO_STATUS_LABELS[workspace.po.po_status]} ·{" "}
                  {formatMoney(workspace.financials.po_consumed, currency)} /{" "}
                  {formatMoney(workspace.financials.budget, currency)}
                </Badge>
              }
            />
          ) : null}
          <DetailRow
            label="Revenue"
            value={formatMoney(workspace.financials.revenue, currency)}
          />
          <DetailRow
            label="Cost"
            value={formatMoney(workspace.financials.cost, currency)}
          />
          <DetailRow
            label="GP"
            value={formatMoney(workspace.financials.gp, currency)}
          />
          <DetailRow
            label="Margin"
            value={formatPercent(workspace.financials.margin_percent)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
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
