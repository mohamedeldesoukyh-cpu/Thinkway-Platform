"use client";

import {
  Building2Icon,
  CompassIcon,
  FileTextIcon,
  LayoutGridIcon,
  MegaphoneIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { AI_TERMINOLOGY } from "../constants/ai-copy";
import type { WorkspaceUrlParams } from "../types";

const WORKSPACE_ICONS: Record<string, typeof SparklesIcon> = {
  campaign: MegaphoneIcon,
  client: Building2Icon,
  discovery: CompassIcon,
  shortlist: LayoutGridIcon,
  report: FileTextIcon,
  vendor: UserIcon,
  general: SparklesIcon,
};

const WORKSPACE_LABELS: Record<string, string> = {
  campaign: AI_TERMINOLOGY.campaign,
  client: AI_TERMINOLOGY.legalEntity,
  discovery: "Discovery",
  shortlist: AI_TERMINOLOGY.shortlist,
  report: "Report",
  vendor: AI_TERMINOLOGY.vendor,
  general: "General",
};

type WorkspaceContextBadgeProps = {
  workspace?: WorkspaceUrlParams;
  label?: string;
  className?: string;
};

export function WorkspaceContextBadge({
  workspace,
  label,
  className,
}: WorkspaceContextBadgeProps) {
  const type = workspace?.workspace ?? "general";
  const Icon = WORKSPACE_ICONS[type] ?? SparklesIcon;
  const displayLabel = label ?? formatWorkspaceLabel(workspace);

  if (type === "general" && !label) return null;

  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground/80 shadow-sm",
        className
      )}
    >
      <Icon className="size-3 text-violet-600 dark:text-violet-400" />
      {displayLabel}
    </span>
  );
}

function formatWorkspaceLabel(workspace?: WorkspaceUrlParams): string {
  if (!workspace?.workspace) return "General";
  const type = workspace.workspace;
  const id = workspace.id ?? workspace.campaignId ?? workspace.clientId;
  const label = WORKSPACE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
  return id ? `${label} context` : label;
}
