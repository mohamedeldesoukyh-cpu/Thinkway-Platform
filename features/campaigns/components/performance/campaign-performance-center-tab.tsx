"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { csvEscapeRow } from "@/lib/security/csv-formula";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
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
import {
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { CampaignPerformanceCharts as PerformanceChartsSection, countPerformanceChartSeries } from "@/features/campaigns/components/performance/campaign-performance-charts";
import { OperationalDetailSheet } from "@/features/campaigns/components/operational-detail-panel";
import { PublicationWorkspace } from "@/features/campaigns/components/performance/publication-workspace/publication-workspace";
import { PerformancePublicationValueCard } from "@/features/campaigns/components/performance/performance-publication-value-card";
import { PerformanceSelectionFlyout } from "@/features/campaigns/components/performance/performance-selection-flyout";
import {
  MetricsEnrichmentProgressBanner,
  MetricsEnrichmentSummaryDialog,
} from "@/features/campaigns/components/performance/metrics-enrichment-progress";
import {
  bulkImportPublicationsAction,
  deleteCampaignPublicationAction,
  importPublicationMetricsAction,
  refreshCampaignMetricsAction,
  refreshPublicationMetricsAction,
} from "@/features/campaigns/actions/performance-actions";
import { useRefreshCampaignAfterPublicationMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { useMetricsEnrichmentBatch } from "@/features/campaigns/hooks/use-metrics-enrichment-batch";
import {
  notifyMetricsSyncQueued,
} from "@/features/campaigns/hooks/use-metrics-sync-toasts";
import { CampaignPerformanceSyncHealth } from "@/features/campaigns/components/performance/campaign-performance-sync-health";
import type {
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/features/campaigns/queries/publications";
import {
  applyPublicationValueScopes,
  assignmentIndexHasAgreedPlatforms,
  buildAssignmentAgreedPlatformIndexFromAssignments,
  partitionPublicationsByValueScope,
  publicationValueScopeLabel,
  summarizePublicationValueGroup,
} from "@/lib/performance/publication-value-scope";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";
import { cn } from "@/lib/utils";
import {
  PERFORMANCE_GRID_COLUMN_METAS,
  PERFORMANCE_GRID_TABLE_ID,
} from "@/lib/tables/performance-grid-column-metas";

const ALL_STATUSES = "all";

type Props = {
  workspace: CampaignWorkspace;
  publications: CampaignPublicationRow[];
  assignmentHierarchy?: AssignmentHierarchy | null;
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  syncHealth: CampaignMetricsSyncHealth;
  loadError?: string | null;
  schemaWarnings?: string[];
  /** Deep-link from Decision Center (?publication=). */
  initialDetailPublicationId?: string | null;
};

export function CampaignPerformanceCenterTab({
  workspace,
  publications,
  assignmentHierarchy = null,
  summary,
  charts,
  syncHealth,
  loadError,
  schemaWarnings = [],
  initialDetailPublicationId = null,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [platformFilter, setPlatformFilter] = useState(ALL_STATUSES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(
    () => initialDetailPublicationId
  );

  useEffect(() => {
    if (!initialDetailPublicationId) return;
    if (publications.some((row) => row.id === initialDetailPublicationId)) {
      setDetailId(initialDetailPublicationId);
    }
  }, [initialDetailPublicationId, publications]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
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
  const confirmDelete = useConfirmDelete();
  const importRef = useRef<HTMLInputElement>(null);
  const metricsImportRef = useRef<HTMLInputElement>(null);
  const refreshAfterPublicationMutation = useRefreshCampaignAfterPublicationMutation();
  const enrichmentBatch = useMetricsEnrichmentBatch(publications);

  const lines = (workspace.lines ?? []).filter((l) => l.influencer_id);

  const classifiedPublications = useMemo(() => {
    const index = buildAssignmentAgreedPlatformIndexFromAssignments({
      lines: workspace.lines,
      hierarchyGroups: assignmentHierarchy?.groups,
    });
    if (!assignmentIndexHasAgreedPlatforms(index)) {
      return publications;
    }
    return applyPublicationValueScopes(publications, index);
  }, [assignmentHierarchy?.groups, publications, workspace.lines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classifiedPublications.filter((row) => {
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
  }, [classifiedPublications, search, statusFilter, platformFilter]);

  const { agreed: agreedFiltered, addedValue: addedValueFiltered } = useMemo(
    () => partitionPublicationsByValueScope(filtered),
    [filtered]
  );
  const classifiedSplit = useMemo(
    () => partitionPublicationsByValueScope(classifiedPublications),
    [classifiedPublications]
  );
  const agreedSummary = useMemo(
    () => summarizePublicationValueGroup(agreedFiltered),
    [agreedFiltered]
  );
  const addedValueSummary = useMemo(
    () => summarizePublicationValueGroup(addedValueFiltered),
    [addedValueFiltered]
  );

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
      "Value type",
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
      publicationValueScopeLabel(r.value_scope),
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
    const csv = [header, ...body].map((line) => csvEscapeRow(line)).join("\n");
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

  function beginEnrichmentBatch(publicationIds: string[]) {
    enrichmentBatch.startBatch(publicationIds);
    queueMetricsSyncToasts(publicationIds);
  }

  function refreshAllCampaignMetrics() {
    startTransition(async () => {
      const result = await refreshCampaignMetricsAction({ campaignId: workspace.id });
      if (result.ok) {
        if (result.message.toLowerCase().includes("queued")) {
          beginEnrichmentBatch(classifiedPublications.map((p) => p.id));
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
          beginEnrichmentBatch([publicationId]);
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

  async function handleRemovePublication(publicationId: string) {
    const row = publications.find((r) => r.id === publicationId);
    const label = row?.influencer_name ?? row?.publication_type_label ?? "this publication";
    const ok = await confirmDelete(
      `Remove ${label} from the campaign? This cannot be undone.`,
      "Delete publication?"
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteCampaignPublicationAction({
        campaignId: workspace.id,
        publicationId,
      });
      if (result.ok) {
        toast.success(result.message);
        setSelectedIds((prev) => {
          if (!prev.has(publicationId)) return prev;
          const next = new Set(prev);
          next.delete(publicationId);
          return next;
        });
        if (detailId === publicationId) {
          setDetailId(null);
          detailSnapshotRef.current = null;
        }
        refreshAfterPublicationMutation();
      } else {
        toast.error(result.message);
      }
    });
  }

  const selectedCount = selectedIds.size;
  const chartSeriesCount = countPerformanceChartSeries(charts);
  const reportBase = `/api/campaigns/${workspace.id}/performance/document`;
  const filteredSelectIds = useMemo(
    () => filtered.map((row) => row.id),
    [filtered]
  );
  const addedValueSelectIds = useMemo(
    () => addedValueFiltered.map((row) => row.id),
    [addedValueFiltered]
  );
  const selectedRows = useMemo(
    () => classifiedPublications.filter((row) => selectedIds.has(row.id)),
    [classifiedPublications, selectedIds]
  );

  return (
    <div
      className={cn(
        operationalFloatingBarContentClass(selectedCount > 0, "space-y-3.5"),
        "pb-14"
      )}
    >
      <CampaignWorkspaceFrame
        title="Performance"
        subtitle="Agreed assignment posts vs added-value posts beyond the contracted mix"
        status={
          <AuroraStatusPill
            tone={summary.total_publications > 0 ? "green" : "mut"}
          >
            {summary.total_publications > 0 ? "Live" : "Awaiting publication"}
          </AuroraStatusPill>
        }
        tools={
          <>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn h-[33px] text-[12px]">
              <a
                href={`/campaigns/${workspace.id}/performance/preview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview report
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn h-[33px] text-[12px]">
              <a href={`${reportBase}?format=pdf&download=1`}>↓ Combined PDF</a>
            </Button>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn h-[33px] text-[12px]">
              <a href={`${reportBase}?format=pdf&variant=influencers&download=1`}>
                Influencer PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn h-[33px] text-[12px]">
              <a href={`${reportBase}?format=xlsx&download=1`}>Excel</a>
            </Button>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn h-[33px] text-[12px]">
              <a href={`${reportBase}?format=pptx&download=1`}>PPT</a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="thinkway-campaign-btn h-[33px] text-[12px]"
              onClick={refreshAllCampaignMetrics}
              disabled={isPending || publications.length === 0}
            >
              ↺ Refresh metrics
            </Button>
            <Button
              size="sm"
              className="thinkway-campaign-btn thinkway-campaign-btn-primary h-[33px] text-[12px]"
              onClick={() => setSheetOpen(true)}
              disabled={lines.length === 0}
            >
              + Add publication
            </Button>
          </>
        }
        stats={[
          {
            key: "pubs",
            label: "Publications",
            value: String(classifiedSplit.agreed.length),
          },
          {
            key: "added-value",
            label: "Added value",
            value: String(classifiedSplit.addedValue.length),
            tone: "amber",
          },
          {
            key: "reach",
            label: "Reach",
            value: String(summary.total_reach),
            tone: "blue",
          },
          {
            key: "eng",
            label: "Engagement",
            value: String(summary.total_engagements),
            tone: "pos",
          },
          {
            key: "completion",
            label: "Completion",
            value:
              publications.length > 0
                ? `${Math.round(
                    (publications.filter(
                      (row) =>
                        Boolean(row.publication_date) ||
                        ["live", "posted", "published", "verified"].includes(row.status)
                    ).length /
                      publications.length) *
                      100
                  )}%`
                : "—",
            tone: "mut",
          },
        ]}
        banner={
          <>
            {loadError ? (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Performance data could not be loaded. {loadError}
              </div>
            ) : null}
            {!loadError && schemaWarnings.length > 0 ? (
              <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Some metrics columns are not migrated yet — counts show as — until migrations are
                applied.
              </div>
            ) : null}
            <CampaignPerformanceSyncHealth health={syncHealth} />
            <MetricsEnrichmentProgressBanner
              className="mt-3"
              active={enrichmentBatch.active}
              health={enrichmentBatch.health}
              progressPercent={enrichmentBatch.progressPercent}
              creatorCount={enrichmentBatch.creatorCount}
            />
          </>
        }
        detailsLabel={
          chartSeriesCount > 0 ? `Trends · ${chartSeriesCount} series` : "Trends"
        }
        details={
          <div className="rounded-[14px] border border-[var(--camp-hair)] bg-[var(--camp-surface)] p-3">
            <div className="mb-2 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => setChartsOpen(true)}
              >
                Expand charts
                {chartSeriesCount > 0 ? ` · ${chartSeriesCount}` : ""}
              </Button>
            </div>
            <PerformanceChartsSection charts={charts} />
          </div>
        }
        registerLabel="Publication registers"
        registerCount={publications.length}
        registerStorageKey={`performance-agreed-added-${workspace.id}`}
        forceRegisterOpen={Boolean(initialDetailPublicationId)}
      >
      <OperationalTableColumnsProvider
        tableId={PERFORMANCE_GRID_TABLE_ID}
        columns={PERFORMANCE_GRID_COLUMN_METAS}
      >
        <div className="thinkway-campaign-grid-toolbar">
          <span className="text-[11px] text-[var(--camp-text-3)] tabular-nums">
            {filtered.length} of {publications.length}
          </span>
          <div className="thinkway-campaign-search-box">
            <SearchIcon className="thinkway-campaign-search-ico size-3" aria-hidden />
            <input
              id="perf_search"
              type="search"
              placeholder="Creator, URL, caption, hashtags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="thinkway-campaign-filter-select h-[30px] w-auto min-w-[110px] border-[var(--camp-border)] text-[11px] shadow-none">
              <SelectValue placeholder="All statuses" />
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
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="thinkway-campaign-filter-select h-[30px] w-auto min-w-[130px] border-[var(--camp-border)] text-[11px] shadow-none">
              <SelectValue placeholder="All platforms" />
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
          <div className="thinkway-campaign-grid-actions">
            <Button
              size="sm"
              variant="outline"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              ↓ Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              onClick={() => importRef.current?.click()}
              disabled={isPending}
            >
              ↑ Import publications
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="thinkway-campaign-btn h-[30px] text-[11px] shadow-none"
              onClick={() => metricsImportRef.current?.click()}
              disabled={isPending}
            >
              ↑ Import metrics
            </Button>
            <OperationalTableSettingsButton contextLabel="Publications grid" />
          </div>
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

        <div className="thinkway-campaign-color-legend">
          <span className="font-semibold">Reach / Impr.:</span>
          <span className="thinkway-campaign-cl-item">
            <span className="thinkway-campaign-cl-dot bg-[var(--camp-green)]" aria-hidden />
            Actual
          </span>
          <span className="thinkway-campaign-cl-item">
            <span className="thinkway-campaign-cl-dot bg-[var(--camp-amber)]" aria-hidden />
            Forecast
          </span>
          <span className="thinkway-campaign-cl-item">
            <span className="thinkway-campaign-cl-dot bg-[var(--camp-blue)]" aria-hidden />
            Manual
          </span>
        </div>

        <div className="space-y-3.5">
          <PerformancePublicationValueCard
            title="Publications"
            description="Matching the assignment platforms."
            summary={agreedSummary}
            rows={agreedFiltered}
            allRows={publications}
            selectScopeIds={filteredSelectIds}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpenDetail={setDetailId}
            onRemovePublication={handleRemovePublication}
            onRefreshMetrics={handleRefreshPublication}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            emptyTitle="No agreed publications in this view."
            emptyDescription="Posts on assignment platforms appear here. Extra platforms are listed under Added value."
          />
          <PerformancePublicationValueCard
            title="Added value"
            description="Posted on platforms that are not contracted on the assignment."
            summary={addedValueSummary}
            rows={addedValueFiltered}
            allRows={publications}
            selectScopeIds={addedValueSelectIds}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpenDetail={setDetailId}
            onRemovePublication={handleRemovePublication}
            onRefreshMetrics={handleRefreshPublication}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            emptyTitle="No added-value publications."
            emptyDescription="When a creator posts on a platform that is not on their assignment, it appears here. Adding that platform to the assignment moves it to Publications."
          />
        </div>
      </OperationalTableColumnsProvider>
      </CampaignWorkspaceFrame>

      <PerformanceSelectionFlyout
        campaignId={workspace.id}
        documentNumber={workspace.document_number ?? workspace.id}
        selectedIds={[...selectedIds]}
        selectedRows={selectedRows}
        selectableCount={filtered.length}
        onSelectAll={selectAllFiltered}
        onClearSelection={() => setSelectedIds(new Set())}
        onEnrichmentBatchStarted={beginEnrichmentBatch}
      />

      <MetricsEnrichmentSummaryDialog
        open={enrichmentBatch.summaryOpen}
        health={enrichmentBatch.summaryHealth}
        creatorCount={enrichmentBatch.summaryCreatorCount}
        onOpenChange={(open) => {
          if (!open) enrichmentBatch.dismissSummary();
        }}
      />

      <CampaignPublicationSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        existingContentUrls={publications.map((row) => row.content_url)}
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

      <OperationalDetailSheet
        open={chartsOpen}
        onOpenChange={setChartsOpen}
        title="Performance charts"
        description="Platform, creator, and engagement breakdowns for this campaign"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
          <PerformanceChartsSection charts={charts} />
        </div>
      </OperationalDetailSheet>
    </div>
  );
}
