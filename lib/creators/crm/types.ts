/**
 * Commercial Creator CRM types (L3).
 * Identity (L1) and Discovery (L2) must not depend on these for existence.
 */

export type CreatorCrmStatus =
  | "incomplete"
  | "prospect"
  | "negotiating"
  | "active"
  | "preferred"
  | "inactive"
  | "do_not_use";

export type CreatorCrmActivationReason =
  | "manual_convert"
  | "manual_create"
  | "campaign_assignment"
  | "quotation_operational"
  | "vendor_io"
  | "portal_invite"
  | "payment_details"
  | "finance_document"
  | "backfill"
  | "other";

export type CreatorCrmProfileRow = {
  influencer_id: string;
  crm_status: CreatorCrmStatus;
  activated_at: string;
  activated_by: string | null;
  activated_reason: CreatorCrmActivationReason;
  completeness_score: number;
  completeness_missing: unknown[];
  completeness_updated_at: string | null;
  managed_by_agency_id: string | null;
  commercial_owner_profile_id: string | null;
  preferred_currency: string | null;
  onboarding_source: string | null;
  negotiation_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorCrmActivationEventRow = {
  id: string;
  influencer_id: string;
  reason: CreatorCrmActivationReason;
  actor_id: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EnsureCommercialCreatorInput = {
  influencerId: string;
  reason: CreatorCrmActivationReason;
  actorId: string | null;
  /** Required for manual_convert / manual_create unless bypassRoleCheck. */
  roleSlug?: string | null;
  /** Trusted server / future workflow paths only. */
  bypassRoleCheck?: boolean;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  initialStatus?: CreatorCrmStatus;
  metadata?: Record<string, unknown>;
};

export type EnsureCommercialCreatorResult = {
  ok: true;
  influencerId: string;
  created: boolean;
  crmStatus: CreatorCrmStatus;
  eventId: string | null;
};

export type EnsureCommercialCreatorFailure = {
  ok: false;
  message: string;
  code: "permission_denied" | "not_found" | "db_error";
};

export type EnsureCommercialCreatorOutcome =
  | EnsureCommercialCreatorResult
  | EnsureCommercialCreatorFailure;
