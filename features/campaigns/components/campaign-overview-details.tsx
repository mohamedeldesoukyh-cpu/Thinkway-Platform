"use client";

import { format } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
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
  /** Align label/value rhythm with assignment operational tables */
  compactTypography?: boolean;
};

export function CampaignOverviewDetails({
  workspace,
  layout = "grid",
  compactTypography = false,
}: CampaignOverviewDetailsProps) {
  const currency = workspace.currency_code;
  const bodyClass = cn("space-y-3", compactTypography ? "text-[11px]" : "text-sm");

  return (
    <div
      className={cn(
        "gap-4",
        layout === "grid" ? "grid md:grid-cols-1" : "flex flex-col"
      )}
    >
      <CampaignFlatSection title="Campaign header">
        <div className={bodyClass}>
          <DetailRow
            compact={compactTypography}
            label="Campaign #"
            value={<DocumentNumber value={workspace.document_number} />}
          />
          <DetailRow compact={compactTypography} label="Name" value={workspace.name} />
          <DetailRow
            compact={compactTypography}
            label="Status"
            value={<CampaignStatusBadge status={workspace.status} />}
          />
          <DetailRow
            compact={compactTypography}
            label="Platform"
            value={formatPlatformLabel(workspace.platform)}
          />
          <DetailRow compact={compactTypography} label="Currency" value={workspace.currency_code} />
        </div>
      </CampaignFlatSection>

      <CampaignFlatSection title="Hierarchy">
        <div className={bodyClass}>
          <DetailRow
            compact={compactTypography}
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
            compact={compactTypography}
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
          <DetailRow compact={compactTypography} label="Brand" value={workspace.brand?.name ?? "—"} />
          <DetailRow compact={compactTypography} label="Team" value={workspace.team?.name ?? "—"} />
          <DetailRow
            compact={compactTypography}
            label="Account manager"
            value={
              workspace.account_manager?.full_name ??
              workspace.account_manager?.email ??
              "—"
            }
          />
        </div>
      </CampaignFlatSection>

      <CampaignFlatSection title="Commercial">
        <div className={bodyClass}>
          <DetailRow
            compact={compactTypography}
            label="Dates"
            value={`${formatDate(workspace.start_date)} – ${formatDate(workspace.end_date)}`}
          />
          <DetailRow
            compact={compactTypography}
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
              compact={compactTypography}
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
            compact={compactTypography}
            label="Revenue"
            value={formatMoney(workspace.financials.revenue, currency)}
          />
          <DetailRow
            compact={compactTypography}
            label="Cost"
            value={formatMoney(workspace.financials.cost, currency)}
          />
          <DetailRow
            compact={compactTypography}
            label="GP"
            value={formatMoney(workspace.financials.gp, currency)}
          />
          <DetailRow
            compact={compactTypography}
            label="Margin"
            value={formatPercent(workspace.financials.margin_percent)}
          />
        </div>
      </CampaignFlatSection>
    </div>
  );
}

function DetailRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className={cn("text-muted-foreground", compact && "text-[11px] font-normal")}>
        {label}
      </span>
      <span
        className={cn(
          "text-right",
          compact ? "text-[11px] font-normal text-foreground/90" : "font-medium"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}
