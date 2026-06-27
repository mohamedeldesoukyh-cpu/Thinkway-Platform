"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AssignmentCampaignBadgeTone =
  | "gray"
  | "green"
  | "blue"
  | "amber"
  | "red"
  | "purple";

const TONE_CLASS: Record<AssignmentCampaignBadgeTone, string> = {
  gray: "thinkway-campaign-badge-gray",
  green: "thinkway-campaign-badge-green",
  blue: "thinkway-campaign-badge-blue",
  amber: "thinkway-campaign-badge-amber",
  red: "thinkway-campaign-badge-red",
  purple: "thinkway-campaign-badge-purple",
};

type AssignmentCampaignBadgeProps = {
  tone: AssignmentCampaignBadgeTone;
  children: ReactNode;
  className?: string;
};

/** Reference HTML `.badge` — used on assignment parent/child OPS + Billing columns. */
export function AssignmentCampaignBadge({
  tone,
  children,
  className,
}: AssignmentCampaignBadgeProps) {
  return (
    <span className={cn("thinkway-campaign-badge", TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}
