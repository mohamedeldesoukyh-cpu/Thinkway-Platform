import type {
  CampaignShortlistAssignmentStatus,
  CreatorMovementAction,
  QuotationStatus,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type ShortlistCreatorPreview = {
  display_name: string;
  profile_image_url: string | null;
};

export type ShortlistListRow = {
  id: string;
  serial_number: string | null;
  name: string;
  description: string | null;
  status: ShortlistStatus;
  visibility: ShortlistVisibilityV2;
  owner_id: string;
  owner_name: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  is_archived: boolean;
  creator_count: number;
  creator_previews: ShortlistCreatorPreview[];
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShortlistCreatorQuotationRef = {
  quotation_id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
};

export type ShortlistCreatorItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  notes: string | null;
  match_score: number | null;
  unified_id: string | null;
  profile_id: string | null;
  influencer_id: string | null;
  platform_account_ids: string[];
  creator: UnifiedCreatorResult | null;
  /** Quotations this creator has been sent to from this shortlist. */
  quotation_refs: ShortlistCreatorQuotationRef[];
  /** When set, this creator is bundled with others under a collapse content header. */
  collapse_group_id: string | null;
  collapse_label: string | null;
};

export type ShortlistMovementRow = {
  id: string;
  action: CreatorMovementAction;
  source_type: string;
  destination_type: string;
  source_id: string | null;
  destination_id: string | null;
  unified_id: string | null;
  notes: string | null;
  performed_at: string;
  performed_by: string | null;
  performed_by_name: string | null;
};

export type ShortlistLinkedQuotation = {
  id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
  version_number: number;
  created_at: string;
};

export type ShortlistMovedAssignment = {
  assignment_id: string;
  campaign_header_id: string;
  campaign_name: string | null;
  campaign_document_number: string | null;
  influencer_id: string;
  influencer_name: string | null;
  assignment_status: CampaignShortlistAssignmentStatus | null;
};

export type ShortlistDetail = {
  id: string;
  serial_number: string | null;
  slug: string | null;
  name: string;
  description: string | null;
  status: ShortlistStatus;
  visibility: ShortlistVisibilityV2;
  /** Commercial display currency (propagates to quotation header). */
  currency: string;
  owner_id: string;
  owner_name: string | null;
  created_by: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  creators: ShortlistCreatorItem[];
  movements: ShortlistMovementRow[];
  movedAssignments: ShortlistMovedAssignment[];
  linkedQuotations: ShortlistLinkedQuotation[];
  canManage: boolean;
  canApprove: boolean;
  /** Thinkway-controlled. Client Workspace shows original currency only when this is on. */
  showOriginalCurrency?: boolean;
  /** Thinkway-controlled. Client Workspace hides Cost and Agency Fees when this is on. */
  hideCostAndFees?: boolean;
};

export type ShortlistCampaignOption = {
  id: string;
  name: string;
  document_number: string | null;
};

export type ShortlistClientOption = {
  id: string;
  name: string;
  legal_name: string | null;
};

export type ShortlistBrandOption = {
  id: string;
  name: string;
  client_id: string;
  client_name: string | null;
};

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };
