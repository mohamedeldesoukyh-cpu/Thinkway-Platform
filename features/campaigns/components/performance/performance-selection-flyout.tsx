"use client";

import {
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalFloatingActionBar } from "@/components/workspace/operational-floating-action-bar";
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
}: PerformanceSelectionFlyoutProps) {
  const [pending, startTransition] = useTransition();
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();
  const visible = selectedIds.length > 0;
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
          for (const id of selectedIds) {
            const row = selectedRows.find((r) => r.id === id);
            notifyMetricsSyncQueued(id, row?.influencer_name);
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

  return (
    <OperationalFloatingActionBar visible={visible}>
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-xs [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-1.5 pr-1">
            <Badge
              variant="secondary"
              className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
            >
              {selectedIds.length} publication{selectedIds.length === 1 ? "" : "s"} selected
            </Badge>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="size-6 shrink-0 rounded-full text-muted-foreground"
              onClick={onClearSelection}
              aria-label="Clear selection"
            >
              <XIcon className="size-3.5" />
            </Button>
            {selectableCount > 0 && selectedIds.length < selectableCount ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="hidden shrink-0 sm:inline-flex"
                onClick={onSelectAll}
              >
                Select all
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:border-l sm:border-border/70 sm:pl-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-8 shrink-0 rounded-full text-xs"
            disabled={pending}
            onClick={refreshSelectedMetrics}
          >
            <RefreshCwIcon data-icon="inline-start" />
            {pending ? "Refreshing…" : "Refresh metrics"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 rounded-full text-xs"
            onClick={openSelectedReport}
          >
            <FileTextIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Preview report</span>
            <span className="sm:hidden">Report</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden h-8 shrink-0 rounded-full text-xs md:inline-flex"
            onClick={downloadSelectedReport}
          >
            <DownloadIcon data-icon="inline-start" />
            Download PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 rounded-full text-xs"
            onClick={() => void downloadPublishedContent()}
          >
            <DownloadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Download content</span>
            <span className="sm:hidden">Content</span>
          </Button>
        </div>
      </div>
    </OperationalFloatingActionBar>
  );
}
