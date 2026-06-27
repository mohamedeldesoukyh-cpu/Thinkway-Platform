"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import {
  resolveCampaignDisplayDates,
  resolveCampaignDisplayGroup,
  resolveCampaignDisplayPlatform,
} from "@/lib/campaigns/campaign-workspace-presenters";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignOverviewDetailsProps = {
  workspace: CampaignWorkspace;
  layout?: "stack" | "grid";
  /** @deprecated Typography now uses shared operational detail rows. */
  compactTypography?: boolean;
};

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="thinkway-campaign-info-row">
      <span className="thinkway-campaign-info-lbl">{label}</span>
      <span className={cn("thinkway-campaign-info-val tabular-nums", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function CampaignOverviewDetails({
  workspace,
  layout = "grid",
}: CampaignOverviewDetailsProps) {
  const currency = workspace.currency_code;
  const displayGroup = resolveCampaignDisplayGroup(workspace);
  const displayPlatform = resolveCampaignDisplayPlatform(workspace);
  const displayDates = resolveCampaignDisplayDates(workspace);

  const gridClass =
    layout === "grid" ? "thinkway-campaign-overview-grid" : "flex flex-col gap-3.5";

  return (
    <div className={gridClass}>
      <CampaignFlatSection title="Campaign header" variant="info-card">
        <InfoRow
          label="Campaign #"
          value={
            <DocumentNumber
              value={workspace.document_number}
              className="text-[var(--camp-blue)] hover:underline"
            />
          }
        />
        <InfoRow label="Name" value={workspace.name} />
        <InfoRow
          label="Status"
          value={<CampaignStatusBadge status={workspace.status} />}
        />
        <InfoRow label="Platform" value={displayPlatform} />
        <InfoRow label="Currency" value={workspace.currency_code} />
      </CampaignFlatSection>

      <CampaignFlatSection title="Hierarchy" variant="info-card">
        <InfoRow
          label="Group"
          value={
            displayGroup ? (
              <Link href={`/groups/${displayGroup.id}`} className="text-[var(--camp-blue)] hover:underline">
                {displayGroup.name}
              </Link>
            ) : (
              formatGroupDisplayName(null)
            )
          }
        />
        <InfoRow
          label="Legal entity"
          value={
            workspace.client ? (
              <Link
                href={`/clients/${workspace.client.id}`}
                className="text-[var(--camp-blue)] hover:underline"
              >
                {workspace.client.name}
              </Link>
            ) : (
              "—"
            )
          }
        />
        <InfoRow label="Brand" value={workspace.brand?.name ?? "—"} />
        <InfoRow label="Team" value={workspace.team?.name ?? "—"} />
        <InfoRow
          label="Account manager"
          value={
            workspace.account_manager?.full_name ??
            workspace.account_manager?.email ??
            "—"
          }
          valueClassName={
            !workspace.account_manager ? "thinkway-campaign-c-gray" : undefined
          }
        />
      </CampaignFlatSection>

      <CampaignFlatSection title="Commercial" variant="info-card">
        <InfoRow
          label="Dates"
          value={`${formatDate(displayDates.start)} – ${formatDate(displayDates.end)}`}
        />
        <InfoRow
          label="Budget (PO)"
          value={formatMoney(workspace.financials.budget, currency)}
          valueClassName={cn(
            "thinkway-campaign-c-amber",
            workspace.financials.po_exceeded && "thinkway-campaign-c-red"
          )}
        />
        {workspace.financials.po_exceeded ||
        workspace.po.po_status === "near_limit" ? (
          <InfoRow
            label="PO utilization"
            value={
              <Badge variant={PO_STATUS_VARIANT[workspace.po.po_status]}>
                {PO_STATUS_LABELS[workspace.po.po_status]} ·{" "}
                {formatMoney(workspace.financials.po_banner_consumed, currency)} /{" "}
                {formatMoney(workspace.financials.budget, currency)}
              </Badge>
            }
          />
        ) : null}
        <InfoRow
          label="Revenue"
          value={formatMoney(workspace.financials.revenue, currency)}
          valueClassName="thinkway-campaign-c-blue"
        />
        <InfoRow
          label="Cost"
          value={formatMoney(workspace.financials.cost, currency)}
        />
        <InfoRow
          label="GP"
          value={formatMoney(workspace.financials.gp, currency)}
          valueClassName={cn(
            workspace.financials.gp < 0
              ? "thinkway-campaign-c-red"
              : workspace.financials.gp > 0
                ? "thinkway-campaign-c-green"
                : undefined
          )}
        />
        <InfoRow
          label="Margin"
          value={formatPercent(workspace.financials.margin_percent)}
        />
      </CampaignFlatSection>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}
