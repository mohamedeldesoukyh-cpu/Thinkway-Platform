"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";

import {
  GlassSelectionFlyout,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";

type Props = {
  selectedCount: number;
  onClearSelection: () => void;
  onAddToList: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
  onAiMatch: () => void;
  onGenerateQuotation: () => void;
  onRefreshMetrics?: () => void;
  onStopRefresh?: () => void;
  stopRefreshDisabled?: boolean;
  /** Quick stats computed from the current selection (spec §1). */
  estFollowers?: number;
  estReach?: number;
  estEngagement?: number;
  busy?: boolean;
};

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0
  );
}

export function CreatorSearchBulkBar({
  selectedCount,
  onClearSelection,
  onAddToList,
  onCompare,
  onExport,
  onShare,
  onAiMatch,
  onGenerateQuotation,
  onRefreshMetrics,
  onStopRefresh,
  stopRefreshDisabled,
  estFollowers,
  estReach,
  estEngagement,
  busy,
}: Props) {
  const actions: GlassFlyoutAction[] = [
    {
      id: "add",
      label: "Add to list",
      icon: ListPlusIcon,
      variant: "primary",
      disabled: busy,
      onClick: onAddToList,
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
      icon: SquareIcon,
      variant: "outline",
      disabled: busy || stopRefreshDisabled || !onStopRefresh,
      onClick: () => onStopRefresh?.(),
    },
    {
      id: "compare",
      label: "Compare",
      icon: GitCompareArrowsIcon,
      variant: "outline",
      onClick: onCompare,
    },
    {
      id: "export",
      label: "Export",
      icon: DownloadIcon,
      variant: "outline",
      onClick: onExport,
    },
    {
      id: "share",
      label: "Share",
      icon: Share2Icon,
      variant: "outline",
      onClick: onShare,
    },
    {
      id: "quotation",
      label: "Generate quotation",
      icon: FileTextIcon,
      variant: "outline",
      disabled: busy,
      onClick: onGenerateQuotation,
    },
    {
      id: "ai-match",
      label: "AI Match",
      icon: SparklesIcon,
      variant: "outline",
      onClick: onAiMatch,
    },
  ];

  const hasStats =
    estFollowers != null || estReach != null || estEngagement != null;

  return (
    <GlassSelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={2}
    >
      {hasStats ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {estFollowers != null && <>{compact(estFollowers)} followers </>}
          {estReach != null && <>· {compact(estReach)} est. reach </>}
          {estEngagement != null && <>· {estEngagement.toFixed(1)}% avg ER</>}
        </span>
      ) : null}
    </GlassSelectionFlyout>
  );
}
