import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

export const PERFORMANCE_GRID_TABLE_ID = OPERATIONAL_TABLE_IDS.campaignPerformanceGrid;

export const PERFORMANCE_GRID_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "select", label: "Select", locked: true },
  { id: "platformThumb", label: "Thumb", defaultVisible: false },
  { id: "contentPreview", label: "Preview", defaultVisible: false },
  { id: "creator", label: "Creator" },
  { id: "platform", label: "Platform" },
  { id: "type", label: "Type" },
  { id: "published", label: "Published" },
  { id: "views", label: "Views" },
  { id: "reach", label: "Reach" },
  { id: "impressions", label: "Impr." },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Cmts" },
  { id: "shares", label: "Shares", defaultVisible: false },
  { id: "saves", label: "Saves", defaultVisible: false },
  { id: "engagementRate", label: "ER %" },
  { id: "cost", label: "Cost", defaultVisible: false },
  { id: "cpv", label: "CPV", defaultVisible: false },
  { id: "cpe", label: "CPE", defaultVisible: false },
  { id: "status", label: "Status" },
  { id: "metricsStatus", label: "Metrics", defaultVisible: false },
  { id: "actions", label: "Actions", locked: true },
];

export type PerformanceGridColumnId = (typeof PERFORMANCE_GRID_COLUMN_METAS)[number]["id"];
