"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  PlusIcon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";

import {
  DiscoverySelectionFlyout,
  type DiscoverySelectionFlyoutAction,
} from "@/features/discovery/components/design-system";
import { AB } from "@/lib/discovery/suite/helpers";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type Props = {
  selectedCount: number;
  selectedCreators: UnifiedCreatorResult[];
  onClearSelection: () => void;
  onAddToList: () => void;
  onCreateList: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
  onAiMatch: () => void;
  onGenerateQuotation: () => void;
  onRefreshMetrics?: () => void;
  onStopRefresh?: () => void;
  stopRefreshDisabled?: boolean;
  busy?: boolean;
  onSelectAllShown?: () => void;
  selectableCount?: number;
};

function selectionStats(creators: UnifiedCreatorResult[]) {
  let reach = 0;
  const platforms = new Set<string>();
  let erSum = 0;
  let erCount = 0;
  for (const creator of creators) {
    const followers = creator.metrics.followers.value;
    if (followers != null && Number.isFinite(followers)) reach += followers;
    for (const platform of creator.platforms ?? []) {
      const key = platform.platform?.trim().toLowerCase();
      if (key) platforms.add(key);
    }
    const er = creator.metrics.engagement_rate.value;
    if (er != null && Number.isFinite(er)) {
      erSum += er;
      erCount += 1;
    }
  }
  const avgEr = erCount > 0 ? erSum / erCount : null;
  return {
    reachLabel: AB(reach > 0 ? reach : null),
    platformsLabel: String(platforms.size),
    avgEngagementLabel:
      avgEr == null ? "—" : `${avgEr.toFixed(1)}%`,
  };
}

export function CreatorSearchBulkBar({
  selectedCount,
  selectedCreators,
  onClearSelection,
  onAddToList,
  onCreateList,
  onCompare,
  onExport,
  onShare,
  onAiMatch,
  onGenerateQuotation,
  onRefreshMetrics,
  onStopRefresh,
  stopRefreshDisabled,
  busy,
  onSelectAllShown,
  selectableCount,
}: Props) {
  const stats = selectionStats(selectedCreators);

  const actions: DiscoverySelectionFlyoutAction[] = [
    {
      id: "add",
      label: "Add to list",
      icon: ListPlusIcon,
      variant: "primary",
      disabled: busy,
      onClick: onAddToList,
    },
    {
      id: "create-list",
      label: "Create list",
      icon: PlusIcon,
      variant: "outline",
      disabled: busy,
      onClick: onCreateList,
    },
    {
      id: "refresh-metrics",
      label: "Refresh Metrics",
      icon: RefreshCwIcon,
      variant: "outline",
      disabled: busy || !onRefreshMetrics,
      onClick: () => onRefreshMetrics?.(),
    },
    {
      id: "stop-refresh",
      label: "Stop refresh",
      description: "Cancel in-flight metric refresh for the selection.",
      icon: SquareIcon,
      variant: "outline",
      disabled: busy || stopRefreshDisabled || !onStopRefresh,
      onClick: () => onStopRefresh?.(),
    },
    {
      id: "compare",
      label: "Compare",
      description: "Open side-by-side metrics for the selected creators.",
      icon: GitCompareArrowsIcon,
      variant: "outline",
      onClick: onCompare,
    },
    {
      id: "export",
      label: "Export",
      description: "Download the selection as a CSV for another system.",
      icon: DownloadIcon,
      variant: "outline",
      onClick: onExport,
    },
    {
      id: "share",
      label: "Share",
      description: "Copy handles and profile links to the clipboard.",
      icon: Share2Icon,
      variant: "outline",
      onClick: onShare,
    },
    {
      id: "quotation",
      label: "Generate quotation",
      description: "Open a priced quotation from this selection — no shortlist step.",
      icon: FileTextIcon,
      variant: "outline",
      disabled: busy,
      onClick: onGenerateQuotation,
    },
    {
      id: "ai-match",
      label: "AI Match",
      description: "Compare the selected creators with the active brief.",
      icon: SparklesIcon,
      variant: "outline",
      onClick: onAiMatch,
    },
  ];

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAllShown}
      selectableCount={selectableCount}
      busy={busy}
      maxVisibleActions={3}
    >
      <div className="discovery-suite flex shrink-0 items-center gap-3 pr-1 text-[11px] text-white/80">
        <span>
          Reach <b className="font-semibold tabular-nums text-white">{stats.reachLabel}</b>
        </span>
        <span>
          Platforms{" "}
          <b className="font-semibold tabular-nums text-white">{stats.platformsLabel}</b>
        </span>
        <span>
          Avg engagement{" "}
          <b className="font-semibold tabular-nums text-white">{stats.avgEngagementLabel}</b>
        </span>
      </div>
    </DiscoverySelectionFlyout>
  );
}
