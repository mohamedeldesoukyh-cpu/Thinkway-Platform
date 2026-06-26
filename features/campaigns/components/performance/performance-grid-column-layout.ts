import {
  PERFORMANCE_GRID_COLUMN_METAS,
  type PerformanceGridColumnId,
} from "@/lib/tables/performance-grid-column-metas";

export const PERFORMANCE_GRID_COLUMN_ORDER: PerformanceGridColumnId[] =
  PERFORMANCE_GRID_COLUMN_METAS.map((meta) => meta.id);

const PERFORMANCE_GRID_COLUMN_WIDTHS: Record<PerformanceGridColumnId, string> = {
  select: "40px",
  platformThumb: "56px",
  contentPreview: "56px",
  creator: "minmax(120px, 1fr)",
  platform: "72px",
  type: "88px",
  published: "88px",
  views: "72px",
  reach: "72px",
  impressions: "72px",
  likes: "56px",
  comments: "56px",
  shares: "56px",
  saves: "56px",
  engagementRate: "56px",
  cost: "64px",
  cpv: "56px",
  cpe: "56px",
  status: "72px",
  metricsStatus: "72px",
  actions: "48px",
};

const RIGHT_ALIGNED_COLUMNS = new Set<PerformanceGridColumnId>([
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "engagementRate",
  "cost",
  "cpv",
  "cpe",
]);

export function isPerformanceGridColumnRightAligned(columnId: PerformanceGridColumnId): boolean {
  return RIGHT_ALIGNED_COLUMNS.has(columnId);
}

export function getVisiblePerformanceGridColumns(
  col: (id: string) => boolean
): PerformanceGridColumnId[] {
  return PERFORMANCE_GRID_COLUMN_ORDER.filter((id) => col(id));
}

export function buildPerformanceGridTemplate(visibleColumnIds: readonly string[]): string {
  return visibleColumnIds
    .map((id) => PERFORMANCE_GRID_COLUMN_WIDTHS[id as PerformanceGridColumnId] ?? "72px")
    .join(" ");
}
