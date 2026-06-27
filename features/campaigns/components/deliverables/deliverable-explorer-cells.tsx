"use client";

import { labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import {
  canonicalPlatformKey,
  deliverableTypeShortLabel,
  getPlatformOptionLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
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

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      width="9"
      height="9"
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="9"
      height="9"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.19 8.19 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z" />
    </svg>
  );
}

function PlatformGlyph({ platform }: { platform: string }) {
  const key = canonicalPlatformKey(platform);
  if (key === "instagram") return <InstagramGlyph />;
  if (key === "tiktok") return <TikTokGlyph />;
  return null;
}

type DeliverableExplorerCreatorCellProps = {
  name: string | null | undefined;
  avatarUrl?: string | null;
  className?: string;
};

/** Creator column — 22px circle avatar + name (panel-deliverables). */
export function DeliverableExplorerCreatorCell({
  name,
  avatarUrl,
  className,
}: DeliverableExplorerCreatorCellProps) {
  if (!name?.trim()) {
    return <span className="thinkway-campaign-c-gray">—</span>;
  }

  return (
    <div className={cn("thinkway-campaign-cr-cell gap-[5px]", className)}>
      <CreatorThumbAvatar
        name={name}
        avatarUrl={avatarUrl}
        size={22}
        className="border-0"
      />
      <span className="truncate text-[11px] text-[var(--camp-text)]">{name}</span>
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
      {(key === "instagram" || key === "tiktok") && <PlatformGlyph platform={platform} />}
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
  const key = canonicalPlatformKey(platform);

  return (
    <span className={cn("thinkway-campaign-deliv-pill", platformToneClass(platform), className)}>
      {(key === "instagram" || key === "tiktok") && <PlatformGlyph platform={platform} />}
      {getPlatformOptionLabel(platform)}
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
