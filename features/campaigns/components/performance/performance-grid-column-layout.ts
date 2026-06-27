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
  creator: "minmax(165px, 1fr)",
  platform: "105px",
  type: "70px",
  published: "88px",
  views: "70px",
  reach: "68px",
  impressions: "68px",
  likes: "55px",
  comments: "46px",
  shares: "56px",
  saves: "56px",
  engagementRate: "54px",
  cost: "64px",
  cpv: "56px",
  cpe: "56px",
  status: "78px",
  metricsStatus: "72px",
  actions: "32px",
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
