/** Flat operational row for the Deliverables tab explorer (post or deliverable fallback). */
export type OperationalDeliverableExplorerRow = {
  /** Stable React key — post schedule id or deliverable id. */
  id: string;
  row_kind: "post" | "deliverable";
  campaign_line_id: string;
  assignment_deliverable_id: string;
  assignment_post_schedule_id: string | null;
  assignment_title: string;
  creator_name: string | null;
  creator_avatar_url: string | null;
  influencer_id: string | null;
  platform: string;
  platform_label: string;
  deliverable_type: string;
  deliverable_type_label: string;
  label: string;
  workflow_status: string;
  billing_status: string;
  publication_status: string | null;
  live_date: string | null;
  notes: string | null;
  is_synthetic: boolean;
  is_virtual_post: boolean;
  sequence_number: number | null;
  /** Precomputed lowercase blob for search. */
  search_text: string;
};

export type OperationalDeliverableFlattenStats = {
  deliverable_groups: number;
  post_schedule_rows: number;
  deliverable_fallback_rows: number;
  total_explorer_rows: number;
  legacy_fallback_rows: number;
  hierarchy_load_error: string | null;
};
