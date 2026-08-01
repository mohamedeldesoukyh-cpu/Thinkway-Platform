"use client";

import type { ReactNode } from "react";

import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { CampaignHeroPoDonut } from "@/features/campaigns/components/aurora/campaign-hero-po-donut";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatPlatformLabel } from "@/features/campaigns/utils";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import { cn } from "@/lib/utils";

type CampaignHeroProps = {
  workspace: CampaignWorkspace;
  actions: ReactNode;
  className?: string;
};

function clientIoPillLabel(status: string | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "approved":
      return "Client IO approved";
    case "sent":
    case "under_client_review":
      return "Client IO sent";
    case "generated":
      return "Client IO generated";
    case "draft":
      return "Client IO draft";
    case "rejected":
      return "Client IO rejected";
    default:
      return `Client IO ${status.replaceAll("_", " ")}`;
  }
}

function clientIoPillClass(status: string | undefined): string {
  if (status === "approved") return "thinkway-aurora-pill thinkway-aurora-pill-green";
  if (status === "rejected") return "thinkway-aurora-pill thinkway-aurora-pill-rose";
  if (status === "sent" || status === "under_client_review") {
    return "thinkway-aurora-pill thinkway-aurora-pill-blue";
  }
  return "thinkway-aurora-pill thinkway-aurora-pill-mut";
}

/** Aurora campaign hero — presentation only; actions stay owned by the workspace. */
export function CampaignHero({ workspace, actions, className }: CampaignHeroProps) {
  const groupName = formatGroupDisplayName(workspace.group?.name);
  const ioLabel = clientIoPillLabel(workspace.client_io?.status);

  return (
    <header className={cn("thinkway-aurora-hero", className)}>
      <div className="thinkway-aurora-hero-main">
        <div className="thinkway-aurora-hero-line1">
          <span className="thinkway-aurora-serial">
            <DocumentNumber value={workspace.document_number} />
          </span>
          <h1 className="thinkway-aurora-htitle" title={workspace.name}>
            {workspace.name}
          </h1>
          <CampaignStatusBadge
            status={workspace.status}
            className="thinkway-aurora-pill thinkway-aurora-pill-dot shrink-0 normal-case tracking-normal"
          />
        </div>

        <div className="thinkway-aurora-hmeta">
          {workspace.brand?.name ? <b>{workspace.brand.name}</b> : null}
          {workspace.client?.name ? (
            <>
              <span className="thinkway-aurora-sep">·</span>
              <span>{workspace.client.name}</span>
            </>
          ) : null}
          {groupName ? (
            <>
              <span className="thinkway-aurora-sep">·</span>
              <span>{groupName}</span>
            </>
          ) : null}
          {workspace.currency_code ? (
            <>
              <span className="thinkway-aurora-sep">·</span>
              <span>{workspace.currency_code}</span>
            </>
          ) : null}
          {workspace.platform ? (
            <>
              <span className="thinkway-aurora-sep">·</span>
              <span>{formatPlatformLabel(workspace.platform)}</span>
            </>
          ) : null}
          {ioLabel ? (
            <>
              <span className="thinkway-aurora-sep">·</span>
              <span className={cn(clientIoPillClass(workspace.client_io?.status), "h-5")}>
                {ioLabel}
              </span>
            </>
          ) : null}
        </div>

        <div className="thinkway-aurora-hactions">{actions}</div>
      </div>

      {workspace.financials.budget > 0 ? (
        <CampaignHeroPoDonut workspace={workspace} />
      ) : null}
    </header>
  );
}
