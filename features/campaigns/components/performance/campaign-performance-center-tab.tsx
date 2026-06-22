"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArchiveIcon,
  CheckIcon,
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
import { CampaignPublicationSheet } from "@/features/campaigns/components/campaign-publication-sheet";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { CampaignPerformanceCharts as PerformanceChartsSection } from "@/features/campaigns/components/performance/campaign-performance-charts";
import { CampaignPerformanceDetailDrawer } from "@/features/campaigns/components/performance/campaign-performance-detail-drawer";
import { CampaignPerformanceGrid } from "@/features/campaigns/components/performance/campaign-performance-grid";
import { CampaignPerformanceKpiStrip } from "@/features/campaigns/components/performance/campaign-performance-kpi-strip";
import {
  bulkImportPublicationsAction,
  bulkUpdatePublicationStatusAction,
  requestPublicationMetricsSyncAction,
} from "@/features/campaigns/actions/performance-actions";
import type {
  CampaignPerformanceCharts,
  CampaignPerformanceSummary,
  CampaignPublicationRow,
} from "@/features/campaigns/queries/publications";
import type { CampaignWorkspace } from "@/features/campaigns/types";

const ALL_STATUSES = "all";

type Props = {
  workspace: CampaignWorkspace;
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  loadError?: string | null;
};

export function CampaignPerformanceCenterTab({
  workspace,
  publications,
  summary,
  charts,
  loadError,
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
        (row.caption ?? "").toLowerCase().includes(q)
      );
    });
  }, [publications, search, statusFilter, platformFilter]);

  const detailRow = useMemo(
    () => (detailId ? (publications.find((r) => r.id === detailId) ?? null) : null),
    [detailId, publications]
  );

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

  function bulkStatus(status: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkUpdatePublicationStatusAction({
        campaignId: workspace.id,
        publicationIds: ids,
        status,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function bulkSync() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await requestPublicationMetricsSyncAction({
        campaignId: workspace.id,
        publicationIds: ids,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
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
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  const selectedCount = selectedIds.size;
  const reportBase = `/api/campaigns/${workspace.id}/performance/document`;

  return (
    <div className="space-y-4">
      <CampaignOperationalSectionHeader
        title="Campaign Performance Center"
        description="Central reporting workspace for live content, metrics, and client-ready exports."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=html`} target="_blank" rel="noopener noreferrer">
                <FileTextIcon data-icon="inline-start" className="size-3.5" />
                Preview report
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=pdf&download=1`}>
                <DownloadIcon data-icon="inline-start" className="size-3.5" />
                PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${reportBase}?format=xlsx&download=1`}>
                <FileSpreadsheetIcon data-icon="inline-start" className="size-3.5" />
                Excel
              </a>
            </Button>
            <Button size="sm" variant="outline" disabled title="PowerPoint export coming soon">
              PPT
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
          Performance data could not be loaded fully. {loadError}
        </div>
      ) : null}

      <CampaignPerformanceKpiStrip summary={summary} />
      <PerformanceChartsSection charts={charts} />

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#0057FF]/20 bg-[#EEF4FF] px-3 py-2">
          <span className="text-xs font-semibold text-[#0057FF]">{selectedCount} selected</span>
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => bulkStatus("verified")} disabled={isPending}>
            <CheckIcon className="mr-1 size-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkStatus("archived")} disabled={isPending}>
            <ArchiveIcon className="mr-1 size-3" /> Archive
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={bulkSync} disabled={isPending}>
            <RefreshCwIcon className="mr-1 size-3" /> Sync metrics
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-[#E6EAF2] bg-[#FAFBFD] p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Publications grid · {filtered.length} of {publications.length}
          </p>
          <div className="flex flex-wrap gap-2">
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
              <UploadIcon className="mr-1 size-3" /> Import CSV
            </Button>
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

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="perf_search">
              <SearchIcon className="mr-1 inline size-3.5" /> Search
            </Label>
            <Input
              id="perf_search"
              placeholder="Creator, URL, caption…"
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
        </div>
      </div>

      <CampaignPerformanceGrid
        rows={filtered}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onOpenDetail={setDetailId}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      <CampaignPublicationSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <CampaignPerformanceDetailDrawer
        open={detailId != null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        row={detailRow}
        campaignName={workspace.name}
      />
    </div>
  );
}
