"use client";

import { format, isValid, parseISO } from "date-fns";
import { DownloadIcon, FilterIcon, ImagesIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { csvEscapeRow } from "@/lib/security/csv-formula";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignMarkStoriesLiveSheet } from "@/features/campaigns/components/campaign-mark-stories-live-sheet";
import { CampaignPublicationSheet } from "@/features/campaigns/components/campaign-publication-sheet";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { PublicationDetailSheet } from "@/features/campaigns/components/detail-sheets/publication-detail-sheet";
import { PublicationDuplicateBadge } from "@/features/campaigns/components/performance/performance-explorer-cells";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import {
  duplicateNormalizedUrlSet,
  notesHaveDuplicateMarker,
  normalizePublicationContentUrl,
} from "@/lib/campaigns/publication-content-url";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const ALL_STATUSES = "all";

type CampaignPublicationsTabProps = {
  workspace: CampaignWorkspace;
  publications: CampaignPublicationRow[];
  loadError?: string | null;
};

function safeFormatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = parseISO(value.includes("T") ? value : `${value}T00:00:00`);
  if (!isValid(parsed)) return "—";
  try {
    return format(parsed, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function buildPublicationsColumns(
  onOpenDetail: (id: string) => void,
  duplicateUrlKeys: ReadonlySet<string>
): OperationalConfigurableColumnDef<CampaignPublicationRow>[] {
  return [
    {
      id: "type",
      label: "Type",
      renderCell: (row) => {
        const normalized = normalizePublicationContentUrl(row.content_url);
        const showDuplicate =
          notesHaveDuplicateMarker(row.notes) ||
          (Boolean(normalized) && duplicateUrlKeys.has(normalized!));
        return (
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <DetailClickableLabel
                onClick={() => onOpenDetail(row.id)}
                title={`View ${row.publication_type_label} details`}
              >
                {row.publication_type_label}
              </DetailClickableLabel>
              {showDuplicate ? <PublicationDuplicateBadge /> : null}
            </div>
            <p className="text-[11px] text-muted-foreground">{row.platform_label}</p>
          </div>
        );
      },
    },
    {
      id: "content",
      label: "Content",
      renderCell: (row) =>
        row.content_url ? (
          <a
            href={row.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-[11px] underline"
          >
            {row.content_url}
          </a>
        ) : (
          "—"
        ),
    },
    {
      id: "creator",
      label: "Creator",
      renderCell: (row) => row.influencer_name ?? "—",
    },
    {
      id: "status",
      label: "Status",
      renderCell: (row) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "publication_date",
      label: "Publication date",
      cellClassName: "text-muted-foreground",
      renderCell: (row) => safeFormatDate(row.publication_date),
    },
    {
      id: "assignee",
      label: "Assignee",
      renderCell: (row) => row.assignee_name ?? "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (row) =>
        row.content_url ? (
          <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
            <a href={row.content_url} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          </Button>
        ) : (
          "—"
        ),
    },
  ];
}

export function CampaignPublicationsTab({
  workspace,
  publications,
  loadError,
}: CampaignPublicationsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [storiesSheetOpen, setStoriesSheetOpen] = useState(false);
  const [detailPublicationId, setDetailPublicationId] = useState<string | null>(null);

  const rows = publications ?? [];
  const lines = (workspace.lines ?? []).filter((l) => l.influencer_id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== ALL_STATUSES && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (row.influencer_name ?? "").toLowerCase().includes(q) ||
        (row.content_url ?? "").toLowerCase().includes(q) ||
        (row.publication_type_label ?? "").toLowerCase().includes(q) ||
        (row.caption ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const duplicateUrlKeys = useMemo(
    () => duplicateNormalizedUrlSet(rows.map((row) => row.content_url)),
    [rows]
  );

  const columns = useMemo(
    () => buildPublicationsColumns(setDetailPublicationId, duplicateUrlKeys),
    [duplicateUrlKeys]
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  const detailRow = useMemo(
    () =>
      detailPublicationId
        ? (rows.find((row) => row.id === detailPublicationId) ?? null)
        : null,
    [detailPublicationId, rows]
  );

  function exportCsv() {
    const header = [
      "Type",
      "Content URL",
      "Creator",
      "Status",
      "Publication date",
      "Platform",
      "Notes",
    ];
    const body = filtered.map((r) => [
      r.publication_type_label,
      r.content_url ?? "",
      r.influencer_name ?? "",
      r.status,
      r.publication_date ?? "",
      r.platform_label,
      r.notes ?? "",
    ]);
    const csv = [header, ...body].map((line) => csvEscapeRow(line)).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workspace.document_number}-publications.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignPublications}
        columns={columns}
        rows={filtered}
        filterAccessors={{
          type: (row) => row.publication_type_label ?? row.platform_label,
          content: (row) => row.content_url,
          creator: (row) => row.influencer_name,
          status: (row) => row.status,
          publication_date: (row) => row.publication_date,
          assignee: (row) => row.assignee_name,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Publications"
              description="Manual URL tracking for live influencer content."
              actions={
                <>
                  <OperationalTableControlsSlot contextLabel="Campaign publications" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                  >
                    <DownloadIcon data-icon="inline-start" className="size-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStoriesSheetOpen(true)}
                    disabled={lines.length === 0}
                  >
                    <ImagesIcon data-icon="inline-start" className="size-3.5" />
                    Mark stories live
                  </Button>
                  <Button size="sm" onClick={() => setSheetOpen(true)} disabled={lines.length === 0}>
                    <PlusIcon data-icon="inline-start" />
                    Add publication
                  </Button>
                </>
              }
            />
          }
          toolbar={
            <div className="space-y-3">
              {loadError ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  Publications data could not be loaded fully. Apply migration{" "}
                  <code className="font-mono">20260531400000_campaign_publications.sql</code>.{" "}
                  {loadError}
                </div>
              ) : null}
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Displaying {filtered.length} of {rows.length}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pub_search">
                    <SearchIcon className="mr-1 inline size-3.5" />
                    Search
                  </Label>
                  <Input
                    id="pub_search"
                    placeholder="Creator, URL, caption…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    <FilterIcon className="mr-1 inline size-3.5" />
                    Status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
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
                </div>
              </div>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="thinkway-campaign-empty-state">
              <p>No publications found.</p>
            </div>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <CampaignPublicationSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        existingContentUrls={rows.map((row) => row.content_url)}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <CampaignMarkStoriesLiveSheet
        campaignId={workspace.id}
        assignmentLines={lines}
        open={storiesSheetOpen}
        onOpenChange={setStoriesSheetOpen}
      />

      <PublicationDetailSheet
        open={detailPublicationId != null}
        onOpenChange={(open) => {
          if (!open) setDetailPublicationId(null);
        }}
        row={detailRow}
        campaignName={workspace.name}
      />
    </>
  );
}
