"use client";

import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignPerformanceGrid } from "@/features/campaigns/components/performance/campaign-performance-grid";
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";
import type { PublicationValueSummary } from "@/lib/performance/publication-value-scope";

type SortKey =
  | "influencer_name"
  | "publication_date"
  | "views"
  | "reach"
  | "impressions"
  | "engagement_rate"
  | "cost"
  | "status";

type Props = {
  title: string;
  description: string;
  summary: PublicationValueSummary;
  rows: CampaignPublicationRow[];
  allRows: CampaignPublicationRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
  onRemovePublication: (id: string) => void;
  onRefreshMetrics: (id: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  emptyTitle: string;
  emptyDescription: string;
};

export function PerformancePublicationValueCard({
  title,
  description,
  summary,
  rows,
  allRows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onRemovePublication,
  onRefreshMetrics,
  sortKey,
  sortDir,
  onSort,
  emptyTitle,
  emptyDescription,
}: Props) {
  return (
    <CampaignFlatSection
      title={`${title} · ${summary.count}`}
      description={`${description} Reach ${formatCompactCount(summary.reach)} · Engagements ${formatCompactCount(summary.engagements)}.`}
      flushBody
      className="mb-0"
    >
      <CampaignPerformanceGrid
        rows={rows}
        allRows={allRows}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        onOpenDetail={onOpenDetail}
        onRemovePublication={onRemovePublication}
        onRefreshMetrics={onRefreshMetrics}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </CampaignFlatSection>
  );
}
