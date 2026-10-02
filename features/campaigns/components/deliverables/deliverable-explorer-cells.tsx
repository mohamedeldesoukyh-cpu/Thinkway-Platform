"use client";

import { labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { CreatorNameStack } from "@/components/creator/creator-name-stack";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import {
  canonicalPlatformKey,
  deliverableTypeShortLabel,
  getPlatformOptionLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

function explorerTypeLabel(code: string): string {
  const short = deliverableTypeShortLabel(code);
  const space = short.indexOf(" ");
  if (space === -1) return short.toLowerCase();
  return `${short.slice(0, space + 1)}${short.slice(space + 1).toLowerCase()}`;
}

function platformToneClass(platform: string): string {
  const key = canonicalPlatformKey(platform);
  if (key === "instagram") return "thinkway-campaign-deliv-pill-ig";
  if (key === "tiktok") return "thinkway-campaign-deliv-pill-tt";
  return "thinkway-campaign-deliv-pill-other";
}

function PlatformGlyph({ platform }: { platform: string }) {return <PlatformIcon platform={platform} size="xs" className="size-3.5" />;}

type DeliverableExplorerCreatorCellProps = {
  name: string | null | undefined;
  handle?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

/** Creator column — avatar + name over @username. */
export function DeliverableExplorerCreatorCell({
  name,
  handle,
  avatarUrl,
  className,
}: DeliverableExplorerCreatorCellProps) {
  const identity = resolveCreatorIdentity(name, handle);
  if (!identity.name && !identity.handle) {
    return <span className="thinkway-campaign-c-gray">—</span>;
  }

  return (
    <div className={cn("thinkway-campaign-cr-cell gap-[5px]", className)}>
      <CreatorThumbAvatar
        name={identity.name}
        avatarUrl={avatarUrl}
        size={22}
        className="border-0"
      />
      <CreatorNameStack
        name={identity.name}
        handle={identity.handle}
        nameClassName="text-[11px] font-medium text-[var(--camp-text)]"
        handleClassName="text-[10px] text-[var(--camp-text-3)]"
      />
    </div>
  );
}

type DeliverableExplorerTypePillProps = {
  platform: string;
  deliverableType: string;
  className?: string;
};

export function DeliverableExplorerTypePill({
  platform,
  deliverableType,
  className,
}: DeliverableExplorerTypePillProps) {
  const key = canonicalPlatformKey(platform);

  return (
    <span className={cn("thinkway-campaign-deliv-pill", platformToneClass(platform), className)}>
      <PlatformGlyph platform={platform} />
      {explorerTypeLabel(deliverableType)}
    </span>
  );
}

type DeliverableExplorerPlatformPillProps = {
  platform: string;
  className?: string;
};

export function DeliverableExplorerPlatformPill({
  platform,
  className,
}: DeliverableExplorerPlatformPillProps) {
  const label = getPlatformOptionLabel(platform);

  return (
    <span
      title={label}
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <PlatformIcon
        platform={platform}
        size="md"
        variant="logo"
        className="size-9 rounded-full shadow-sm ring-1 ring-border/50"
      />
    </span>
  );
}

const WORKFLOW_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  posted: "Posted",
  verified: "Verified",
  cancelled: "Cancelled",
  assigned: "Assigned",
  awaiting_content: "Awaiting content",
  submitted: "Submitted",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
};

function workflowBadgeClass(status: string): string {
  const key = status.replace(/-/g, "_");
  if (key === "draft" || key === "cancelled") return "thinkway-campaign-badge-gray";
  if (key === "posted" || key === "verified" || key === "approved") {
    return "thinkway-campaign-badge-green";
  }
  if (key === "awaiting_approval" || key === "awaiting_content") {
    return "thinkway-campaign-badge-blue";
  }
  return "thinkway-campaign-badge-gray";
}

type DeliverableExplorerWorkflowBadgeProps = {
  status: string;
  className?: string;
};

export function DeliverableExplorerWorkflowBadge({
  status,
  className,
}: DeliverableExplorerWorkflowBadgeProps) {
  const key = String(status ?? "draft").replace(/-/g, "_");
  return (
    <span className={cn("thinkway-campaign-badge", workflowBadgeClass(key), className)}>
      {WORKFLOW_LABELS[key] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function billingBadgeClass(status: string): string {
  if (status === "legacy") return "thinkway-campaign-badge-gray";
  if (["invoiced", "collected", "paid"].includes(status)) return "thinkway-campaign-badge-green";
  if (["disputed", "cancelled"].includes(status)) return "thinkway-campaign-badge-red";
  if (status.startsWith("partially")) return "thinkway-campaign-badge-blue";
  return "thinkway-campaign-badge-gray";
}

type DeliverableExplorerBillingBadgeProps = {
  status: string;
  className?: string;
};

export function DeliverableExplorerBillingBadge({
  status,
  className,
}: DeliverableExplorerBillingBadgeProps) {
  if (status === "legacy") {
    return (
      <span className={cn("thinkway-campaign-badge thinkway-campaign-badge-gray", className)}>
        Legacy
      </span>
    );
  }

  const billingStatus = status as AssignmentDeliverableBillingStatus;
  return (
    <span className={cn("thinkway-campaign-badge", billingBadgeClass(status), className)}>
      {labelForDeliverableBillingStatus(billingStatus)}
    </span>
  );
}
