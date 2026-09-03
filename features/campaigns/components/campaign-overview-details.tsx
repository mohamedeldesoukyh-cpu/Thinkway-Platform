"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  CampaignOpsCard,
  CampaignOpsStat,
} from "@/features/campaigns/components/aurora/campaign-ops-card";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { CommercialVersionHistoryDialog } from "@/features/campaigns/components/commercial-version-history-dialog";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import {
  resolveCampaignDisplayDates,
  resolveCampaignDisplayGroup,
  resolveCampaignDisplayPlatform,
} from "@/lib/campaigns/campaign-workspace-presenters";
import { formatCampaignTargetMarketLabel } from "@/lib/campaigns/target-market";
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
  /** Optional header actions (Details panel / Edit header). */
  headerActions?: ReactNode;
};

function pill(tone: "green" | "blue" | "amber" | "rose" | "mut", label: string) {
  return (
    <span
      className={cn(
        "thinkway-aurora-pill h-5 text-[10.5px]",
        tone === "green" && "thinkway-aurora-pill-green",
        tone === "blue" && "thinkway-aurora-pill-blue",
        tone === "amber" && "thinkway-aurora-pill-amber",
        tone === "rose" && "thinkway-aurora-pill-rose",
        tone === "mut" && "thinkway-aurora-pill-mut"
      )}
    >
      {label}
    </span>
  );
}

export function CampaignOverviewDetails({
  workspace,
  headerActions,
}: CampaignOverviewDetailsProps) {
  const currency = workspace.currency_code;
  const displayGroup = resolveCampaignDisplayGroup(workspace);
  const displayPlatform = resolveCampaignDisplayPlatform(workspace);
  const displayDates = resolveCampaignDisplayDates(workspace);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <CampaignOpsCard
        title="Campaign header"
        subtitle="Identity · status · currency"
        status={pill("blue", workspace.document_number)}
      >
        {headerActions ? (
          <div className="flex flex-wrap gap-2 border-b border-[var(--tw-hair)] px-[15px] py-2">
            {headerActions}
          </div>
        ) : null}
        <CampaignOpsStat
          label="Campaign #"
          value={
            <DocumentNumber
              value={workspace.document_number}
              className="text-[var(--camp-blue)] hover:underline"
            />
          }
        />
        <CampaignOpsStat label="Name" value={workspace.name} />
        <CampaignOpsStat
          label="Status"
          value={<CampaignStatusBadge status={workspace.status} />}
        />
        <CampaignOpsStat label="Platform" value={displayPlatform} />
        <CampaignOpsStat label="Currency" value={workspace.currency_code} />
      </CampaignOpsCard>

      <CampaignOpsCard
        title="Hierarchy"
        subtitle="Group · legal entity · brand"
        status={pill("mut", displayGroup?.name ?? "—")}
      >
        <CampaignOpsStat
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
        <CampaignOpsStat
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
        <CampaignOpsStat label="Brand" value={workspace.brand?.name ?? "—"} />
        <CampaignOpsStat label="Team" value={workspace.team?.name ?? "—"} />
        <CampaignOpsStat
          label="Account manager"
          value={
            workspace.account_manager?.full_name ??
            workspace.account_manager?.email ??
            "—"
          }
          tone={!workspace.account_manager ? "mut" : "default"}
        />
      </CampaignOpsCard>

      <CampaignOpsCard
        title="Commercial"
        subtitle="Dates · budget · P&L"
        status={pill(
          workspace.financials.po_exceeded ? "rose" : "green",
          workspace.financials.po_exceeded ? "PO exceeded" : "On track"
        )}
        actionLabel="History"
        onAction={() => setHistoryOpen(true)}
      >
        <CampaignOpsStat
          label="Dates"
          value={`${formatDate(displayDates.start)} – ${formatDate(displayDates.end)}`}
        />
        <CampaignOpsStat
          label="Target market"
          value={
            formatCampaignTargetMarketLabel(workspace.target_market) ??
            "Legal entity country (default)"
          }
        />
        <CampaignOpsStat
          label="Budget (PO)"
          value={formatMoney(workspace.financials.budget, currency)}
          tone={workspace.financials.po_exceeded ? "amber" : "default"}
        />
        {workspace.financials.po_exceeded ||
        workspace.po.po_status === "near_limit" ? (
          <CampaignOpsStat
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
        <CampaignOpsStat
          label="Revenue"
          value={formatMoney(workspace.financials.revenue, currency)}
          tone="blue"
        />
        <CampaignOpsStat
          label="Cost"
          value={formatMoney(workspace.financials.cost, currency)}
        />
        <CampaignOpsStat
          label="GP"
          value={formatMoney(workspace.financials.gp, currency)}
          tone={
            workspace.financials.gp < 0
              ? "amber"
              : workspace.financials.gp > 0
                ? "pos"
                : "mut"
          }
        />
        <CampaignOpsStat
          label="Margin"
          value={formatPercent(workspace.financials.margin_percent)}
          tone={workspace.financials.margin_percent >= 20 ? "pos" : "default"}
        />
      </CampaignOpsCard>

      <CommercialVersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        campaignHeaderId={workspace.id}
      />
    </>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}
