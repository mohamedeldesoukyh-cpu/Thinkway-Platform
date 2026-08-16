"use client";

import {
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  PlatformFloatingActionBar,
  type PlatformFloatingBarAction,
} from "@/components/shared/navigation/platform-floating-action-bar";
import { refreshCampaignMetricsAction } from "@/features/campaigns/actions/performance-actions";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { notifyMetricsSyncQueued } from "@/features/campaigns/hooks/use-metrics-sync-toasts";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/creator-avatar";

type PerformanceSelectionFlyoutProps = {
  campaignId: string;
  documentNumber: string;
  selectedIds: string[];
  selectedRows: CampaignPublicationRow[];
  selectableCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEnrichmentBatchStarted?: (publicationIds: string[]) => void;
};

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 48);
}

async function downloadImageUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("fetch failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = filename;
    anchor.click();
  }
}

export function PerformanceSelectionFlyout({
  campaignId,
  documentNumber,
  selectedIds,
  selectedRows,
  selectableCount,
  onSelectAll,
  onClearSelection,
  onEnrichmentBatchStarted,
}: PerformanceSelectionFlyoutProps) {
  const [pending, startTransition] = useTransition();
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();
  const reportBase = `/api/campaigns/${campaignId}/performance/document`;
  const publicationIdsParam = encodeURIComponent(selectedIds.join(","));

  function refreshSelectedMetrics() {
    startTransition(async () => {
      const result = await refreshCampaignMetricsAction({
        campaignId,
        publicationIds: selectedIds,
      });
      if (result.ok) {
        if (result.message.toLowerCase().includes("queued")) {
          onEnrichmentBatchStarted?.(selectedIds);
          if (!onEnrichmentBatchStarted) {
            for (const id of selectedIds) {
              const row = selectedRows.find((r) => r.id === id);
              notifyMetricsSyncQueued(id, row?.influencer_name);
            }
          }
        } else {
          toast.success(result.message);
        }
        refreshAfterPublicationMutation();
      } else {
        toast.error(result.message);
      }
    });
  }

  function openSelectedReport() {
    window.open(
      `/campaigns/${campaignId}/performance/preview?publicationIds=${publicationIdsParam}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadSelectedReport() {
    const anchor = document.createElement("a");
    anchor.href = `${reportBase}?format=pdf&download=1&publicationIds=${publicationIdsParam}`;
    anchor.download = `${documentNumber}-performance-selected.pdf`;
    anchor.click();
  }

  async function downloadPublishedContent() {
    const withMedia = selectedRows
      .map((row) => ({
        row,
        url: resolvePublicationContentPreviewUrl(row),
      }))
      .filter((item): item is { row: CampaignPublicationRow; url: string } => Boolean(item.url));

    if (withMedia.length === 0) {
      toast.error("No preview images available for the selected publications.");
      return;
    }

    toast.message(`Downloading ${withMedia.length} preview image(s)…`);

    for (const { row, url } of withMedia) {
      const base = sanitizeFilenamePart(row.influencer_name ?? row.id);
      const ext = url.includes(".png") ? "png" : "jpg";
      await downloadImageUrl(url, `${documentNumber}-${base}.${ext}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    toast.success(`Started download for ${withMedia.length} preview image(s).`);
  }

  const primaryAction: PlatformFloatingBarAction = {
    id: "refresh",
    label: pending ? "Refreshing…" : "Refresh metrics",
    icon: RefreshCwIcon,
    disabled: pending,
    loading: pending,
    onClick: refreshSelectedMetrics,
  };

  const secondaryActions: PlatformFloatingBarAction[] = [
    {
      id: "preview",
      label: "Preview report",
      icon: FileTextIcon,
      onClick: openSelectedReport,
    },
  ];

  const overflowActions: PlatformFloatingBarAction[] = [
    {
      id: "pdf",
      label: "Download PDF",
      icon: DownloadIcon,
      onClick: downloadSelectedReport,
    },
    {
      id: "content",
      label: "Download content",
      icon: DownloadIcon,
      onClick: () => void downloadPublishedContent(),
    },
  ];

  return (
    <PlatformFloatingActionBar
      open={selectedIds.length > 0}
      selectedCount={selectedIds.length}
      selectionLabel="publication"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      overflowActions={overflowActions}
      onClearSelection={onClearSelection}
      onSelectAll={onSelectAll}
      selectableCount={selectableCount}
      busy={pending}
    />
  );
}
