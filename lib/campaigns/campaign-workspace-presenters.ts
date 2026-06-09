import { formatPlatformLabel } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";

export function resolveCampaignDisplayGroup(
  workspace: CampaignWorkspace
): { id: string; name: string; document_number: string } | null {
  if (workspace.group) return workspace.group;
  const clientGroup = (
    workspace.client as { group?: { id: string; name: string; document_number: string } | null } | null
  )?.group;
  return clientGroup ?? null;
}

export function resolveCampaignDisplayPlatform(workspace: CampaignWorkspace): string {
  if (workspace.platform?.trim()) {
    return formatPlatformLabel(workspace.platform);
  }

  const fromLines = [
    ...new Set(
      workspace.lines
        .map((line) => line.platform?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (fromLines.length === 1) return formatPlatformLabel(fromLines[0]);
  if (fromLines.length > 1) return "Multi-platform";

  const fromSummary = workspace.lines
    .map((line) => line.platform_summary?.trim())
    .find(Boolean);
  return fromSummary ?? "—";
}

export function resolveCampaignDisplayDates(workspace: CampaignWorkspace): {
  start: string | null;
  end: string | null;
} {
  if (workspace.start_date || workspace.end_date) {
    return { start: workspace.start_date, end: workspace.end_date };
  }

  const lineStarts = workspace.lines
    .map((line) => line.start_date)
    .filter((value): value is string => Boolean(value))
    .sort();
  const lineEnds = workspace.lines
    .map((line) => line.end_date)
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    start: lineStarts[0] ?? null,
    end: lineEnds[lineEnds.length - 1] ?? null,
  };
}
