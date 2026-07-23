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

type Props = {
  selectedCount: number;
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
};

export function CreatorSearchBulkBar({
  selectedCount,
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
}: Props) {
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

  return (
    <DiscoverySelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={3}
    />
  );
}
