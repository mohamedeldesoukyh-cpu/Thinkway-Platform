"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilterIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalTableColumnsProvider } from "@/components/tables/operational-table-column-context";
import { OperationalTableSettingsButton } from "@/components/tables/operational-table-settings-button";
import { operationalFloatingBarContentClass } from "@/components/workspace/operational-floating-action-bar";
import { CampaignPublicationSheet } from "@/features/campaigns/components/campaign-publication-sheet";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { CampaignPerformanceCharts as PerformanceChartsSection } from "@/features/campaigns/components/performance/campaign-performance-charts";
import { PublicationWorkspace } from "@/features/campaigns/components/performance/publication-workspace/publication-workspace";
import { CampaignPerformanceGrid } from "@/features/campaigns/components/performance/campaign-performance-grid";
import { CampaignPerformanceKpiStrip } from "@/features/campaigns/components/performance/campaign-performance-kpi-strip";
import { PerformanceSelectionFlyout } from "@/features/campaigns/components/performance/performance-selection-flyout";
import {
  bulkImportPublicationsAction,
  deleteCampaignPublicationAction,
  importPublicationMetricsAction,
  refreshCampaignMetricsAction,
  refreshPublicationMetricsAction,
} from "@/features/campaigns/actions/performance-actions";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import {
  notifyMetricsSyncQueued,
} from "@/features/campaigns/hooks/use-metrics-sync-toasts";
import { CampaignPerformanceSyncHealth } from "@/features/campaigns/components/performance/campaign-performance-sync-health";
import type {
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/features/campaigns/queries/publications";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  PERFORMANCE_GRID_COLUMN_METAS,
  PERFORMANCE_GRID_TABLE_ID,
} from "@/lib/tables/performance-grid-column-metas";

const ALL_STATUSES = "all";

type Props = {
  workspace: CampaignWorkspace;
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  syncHealth: CampaignMetricsSyncHealth;
  loadError?: string | null;
  schemaWarnings?: string[];
};

export function CampaignPerformanceCenterTab({
  workspace,
  publications,
  summary,
  charts,
  syncHealth,
  loadError,
  schemaWarnings = [],
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [platformFilter, setPlatformFilter] = useState(ALL_STATUSES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortKey, setSortKey] = useState<
    | "influencer_name"
    | "publication_date"
    | "views"
    | "reach"
    | "impressions"
    | "engagement_rate"
    | "cost"
    | "status"
  >("publication_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isPending, startTransition] = useTransition();
  const importRef = useRef<HTMLInputElement>(null);
  const metricsImportRef = useRef<HTMLInputElement>(null);
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();

  const lines = (workspace.lines ?? []).filter((l) => l.influencer_id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publications.filter((row) => {
      if (statusFilter !== ALL_STATUSES && row.status !== statusFilter) return false;
      if (platformFilter !== ALL_STATUSES && row.platform !== platformFilter) return false;
      if (!q) return true;
      return (
        (row.influencer_name ?? "").toLowerCase().includes(q) ||
        (row.content_url ?? "").toLowerCase().includes(q) ||
        (row.publication_type_label ?? "").toLowerCase().includes(q) ||
        (row.caption ?? "").toLowerCase().includes(q) ||
        (row.hashtags ?? "").toLowerCase().includes(q) ||
        (row.mentions ?? "").toLowerCase().includes(q)
      );
    });
  }, [publications, search, statusFilter, platformFilter]);

  const detailSnapshotRef = useRef<CampaignPublicationRow | null>(null);

  const detailRow = useMemo(() => {
    if (!detailId) return null;
    const live = publications.find((r) => r.id === detailId);
    if (live) {
      detailSnapshotRef.current = live;
      return live;
    }
    return detailSnapshotRef.current;
  }, [detailId, publications]);

  const platforms = useMemo(
    () => [...new Set(publications.map((p) => p.platform))].sort(),
    [publications]
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map((row) => row.id)));
  }

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    const header = [
      "Creator",
      "Platform",
      "Type",
      "URL",
      "Date",
      "Status",
      "Views",
      "Reach",
      "Impressions",
      "Likes",
      "Comments",
      "Shares",
      "ER%",
      "Cost",
      "CPV",
      "CPE",
    ];
    const body = filtered.map((r) => [
      r.influencer_name ?? "",
      r.platform_label,
      r.publication_type_label,
      r.content_url ?? "",
      r.publication_date ?? "",
      r.status,
      r.views ?? "",
      r.reach ?? "",
      r.impressions ?? "",
      r.likes ?? "",
      r.comments ?? "",
      r.shares ?? "",
      r.engagement_rate ?? "",
      r.cost ?? "",
      r.cpv ?? "",
      r.cpe ?? "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.document_number}-performance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function queueMetricsSyncToasts(publicationIds: string[]) {
    for (const id of publicationIds) {
      const row = publications.find((p) => p.id === id);
      notifyMetricsSyncQueued(id, row?.influencer_name);
    }
  }

  function refreshAllCampaignMetrics() {
    startTransition(async () => {
      const result = await refreshCampaignMetricsAction({ campaignId: workspace.id });
      if (result.ok) {
        if (result.message.toLowerCase().includes("queued")) {
          queueMetricsSyncToasts(publications.map((p) => p.id));
        } else {
          toast.success(result.message);
        }
        refreshAfterPublicationMutation();
      } else toast.error(result.message);
    });
  }

  async function handleMetricsImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error("Import file must include a header row and at least one data row.");
      return;
    }
    const headers = lines[0]!.split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = line.match(/("([^"]|"")*"|[^,]*)/g) ?? [];
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = (cells[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
      });
      return record;
    });

    startTransition(async () => {
      const result = await importPublicationMetricsAction({
        campaignId: workspace.id,
        rows,
      });
      if (result.ok) {
        toast.success(result.message);
        refreshAfterPublicationMutation();
      } else toast.error(result.message);
    });
  }

  function handleRefreshPublication(publicationId: string) {
    startTransition(async () => {
      const result = await refreshPublicationMetricsAction({
        campaignId: workspace.id,
        publicationId,
      });
      if (result.ok) {
        if (result.status === "queued") {
          const row = publications.find((p) => p.id === publicationId);
          notifyMetricsSyncQueued(publicationId, row?.influencer_name);
        } else {
          toast.success(result.message);
        }
        refreshAfterPublicationMutation();
      } else toast.error(result.message);
    });
  }

  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error("CSV must include a header row and at least one data row.");
      return;
    }
    const headers = lines[0]!.split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = line.match(/("([^"]|"")*"|[^,]*)/g) ?? [];
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = (cells[i] ?? "").replace(/^"|"$/g, "").replace(/""/g, '"').trim();
      });
      return record;
    });

    startTransition(async () => {
      const result = await bulkImportPublicationsAction({
        campaignId: workspace.id,
        rows,
      });
      if (result.ok) {
        toast.success(result.message);
        refreshAfterPublicationMutation();
      } else toast.error(result.message);
    });
  }

  function handleRemovePublication(publicationId: string) {
    const row = publications.find((r) => r.id === publicationId);
    const label = row?.influencer_name ?? row?.publication_type_label ?? "this publication";
    if (!window.confirm(`Remove ${label} from the campaign? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteCampaignPublicationAction({
        campaignId: workspace.id,
        publicationId,
      });
      if (result.ok) {
        toast.success(result.message);
        refreshAfterPublicationMutation();
        setSelectedIds((prev) => {
          if (!prev.has(publicationId)) return prev;
          const next = new Set(prev);
          next.delete(publicationId);
          return next;
        });
        if (detailId === publicationId) setDetailId(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  const selectedCount = selectedIds.size;
  const reportBase = `/api/campaigns/${workspace.id}/performance/document`;
  const selectedRows = useMemo(
    () => publications.filter((row) => selectedIds.has(row.id)),
    [publications, selectedIds]
  );

  return (
    <div className={operationalFloatingBarContentClass(selectedCount > 0, "space-y-4")}>
      <CampaignOperationalSectionHeader
        title="Campaign Performance Center"
        description="Central reporting workspace for live content, metrics, and client-ready exports."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/campaigns/${workspace.id}/performance/preview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileTextIcon data-icon="inline-start" className="size-3.5" />
                Preview report
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=pdf&download=1`}>
                <DownloadIcon data-icon="inline-start" className="size-3.5" />
                Combined PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=pdf&variant=influencers&download=1`}>
                <DownloadIcon data-icon="inline-start" className="size-3.5" />
                Influencer PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=xlsx&download=1`}>
                <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
                Excel
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=pptx&download=1`}>
                <FileTextIcon data-icon="inline-start" className="size-3.5" />
                PPT
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshAllCampaignMetrics}
              disabled={isPending || publications.length === 0}
            >
              <RefreshCwIcon data-icon="inline-start" className="size-3.5" />
              Refresh all metrics
            </Button>
            <Button size="sm" onClick={() => setSheetOpen(true)} disabled={lines.length === 0}>
              <PlusIcon data-icon="inline-start" />
              Add publication
            </Button>
          </>
        }
      />

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Performance data could not be loaded. {loadError}
        </div>
      ) : null}

      {!loadError && schemaWarnings.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Some metrics columns are not migrated yet — counts show as — until{" "}
          <code className="font-mono">20260623120000_campaign_publications_full_schema_reconcile.sql</code>{" "}
          is applied.
        </div>
      ) : null}

      <CampaignPerformanceKpiStrip summary={summary} />
      <CampaignPerformanceSyncHealth health={syncHealth} />
      <PerformanceChartsSection charts={charts} />

      <OperationalTableColumnsProvider
        tableId={PERFORMANCE_GRID_TABLE_ID}
        columns={PERFORMANCE_GRID_COLUMN_METAS}
      >
        <div className="space-y-3 rounded-xl border border-border bg-muted p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Publications grid · {filtered.length} of {publications.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv} disabled={filtered.length === 0}>
              <DownloadIcon className="mr-1 size-3" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => importRef.current?.click()}
              disabled={isPending}
            >
              <UploadIcon className="mr-1 size-3" /> Import publications CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => metricsImportRef.current?.click()}
              disabled={isPending}
            >
              <UploadIcon className="mr-1 size-3" /> Import metrics CSV
            </Button>
            <input
              ref={metricsImportRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleMetricsImport(file);
                e.target.value = "";
              }}
            />
            <input
              ref={importRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="perf_search">
              <SearchIcon className="mr-1 inline size-3.5" /> Search
            </Label>
            <Input
              id="perf_search"
              placeholder="Creator, URL, caption, hashtags, mentions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              <FilterIcon className="mr-1 inline size-3.5" /> Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Platform</Label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <OperationalTableSettingsButton contextLabel="Publications grid" />
          </div>
        </div>

        <CampaignPerformanceGrid
          rows={filtered}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onOpenDetail={setDetailId}
          onRemovePublication={handleRemovePublication}
          onRefreshMetrics={handleRefreshPublication}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
        </div>
      </OperationalTableColumnsProvider>

      <PerformanceSelectionFlyout
        campaignId={workspace.id}
        documentNumber={workspace.document_number ?? workspace.id}
        selectedIds={[...selectedIds]}
        selectedRows={selectedRows}
        selectableCount={filtered.length}
        onSelectAll={selectAllFiltered}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <CampaignPublicationSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <PublicationWorkspace
        open={detailId != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            detailSnapshotRef.current = null;
          }
        }}
        row={detailRow}
        campaignId={workspace.id}
        campaignName={workspace.name}
        onRefreshMetrics={handleRefreshPublication}
        onRemovePublication={handleRemovePublication}
        onPublicationUpdated={refreshAfterPublicationMutation}
        isRefreshing={isPending}
      />
    </div>
  );
}
