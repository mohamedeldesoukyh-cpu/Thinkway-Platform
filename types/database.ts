export type ClientStatus = "prospect" | "active" | "inactive" | "archived";

export type CampaignStatus =
  | "draft"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type InfluencerStatus = "prospect" | "active" | "inactive" | "blacklisted" | "archived";

export type CreatorCrmStatus =
  | "draft"
  | "incomplete"
  | "pending_legal"
  | "pending_finance"
  | "prospect"
  | "negotiating"
  | "active"
  | "preferred"
  | "inactive"
  | "archived"
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

export type AgencyOrDirect = "agency" | "direct" | "hybrid";

export type ShortlistStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "cancelled"
  | "archived";

export type ShortlistItemStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "rejected"
  | "moved_to_campaign"
  | "cancelled";

export type ShortlistVisibilityV2 = "private" | "team" | "client_shared";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type CommercialInputMode =
  | "cost_markup_pct"
  | "cost_gp_pct"
  | "cost_revenue"
  | "cost_gp_value";

export type QuotationStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "archived";

export type CreatorMovementAction =
  | "discovery_to_shortlist"
  | "shortlist_to_campaign"
  | "campaign_to_shortlist"
  | "campaign_to_removed"
  | "creator_added"
  | "creator_removed"
  | "shortlist_submitted"
  | "shortlist_approved"
  | "shortlist_rejected"
  | "shortlist_cancelled"
  | "shortlist_reopened"
  | "shortlist_archived";

export type CampaignShortlistAssignmentStatus =
  | "suggested"
  | "invited"
  | "approved"
  | "contracted"
  | "published"
  | "rejected"
  | "removed";

export type BusinessFunction = "ops" | "sales";

export type GroupDocumentType =
  | "nda"
  | "agreement"
  | "tax_document"
  | "group_contract";

export type GroupRow = {
  id: string;
  document_number: string;
  slug: string | null;
  route_short_id: string | null;
  name: string;
  name_normalized: string;
  region: string | null;
  account_director_id: string | null;
  status: ClientStatus;
  notes: string | null;
  logo_url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupDocumentRow = {
  id: string;
  group_id: string;
  document_type: GroupDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  expires_at: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandRow = {
  id: string;
  document_number: string;
  client_id: string;
  group_id: string | null;
  name: string;
  name_normalized: string;
  status: ClientStatus;
  category_id: string | null;
  subcategory_id: string | null;
  vr_rate_id: string | null;
  currency_code: string;
  country_code: string | null;
  notes: string | null;
  logo_url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandListItem = BrandRow & {
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  vr_rate?: { id: string; name: string; rate_percent: number } | null;
};

export type ClientBrandRow = {
  id: string;
  document_number: string;
  name: string;
  client_id: string;
  status: ClientStatus;
  currency_code: string;
  category_id: string | null;
  subcategory_id: string | null;
  vr_rate_id: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  vr_rate_percent: number | null;
  active_campaigns: number;
  logo_url: string | null;
};

export type AgencyRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  status: InfluencerStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PoStatus =
  | "draft"
  | "active"
  | "near_limit"
  | "exceeded"
  | "expired"
  | "closed";

export type AssignmentPricingMode = "package" | "per_deliverable";

export type CampaignHeaderRow = {
  id: string;
  document_number: string;
  slug: string | null;
  route_short_id: string | null;
  name: string;
  description: string | null;
  brief: string | null;
  campaign_intelligence_profile_id: string | null;
  status: CampaignStatus;
  group_id: string | null;
  client_id: string;
  brand_id: string;
  team_id: string | null;
  report_type_id: string | null;
  currency_code: string;
  vr_rate_id: string | null;
  agency_or_direct: AgencyOrDirect | null;
  category_id: string | null;
  subcategory_id: string | null;
  start_date: string | null;
  end_date: string | null;
  account_manager_id: string | null;
  objectives: unknown[];
  metadata: Record<string, unknown>;
  po_number: string | null;
  po_currency: string | null;
  po_exchange_rate: number | null;
  po_amount_original: number;
  po_amount_campaign_currency: number;
  po_consumed_amount: number;
  po_remaining_amount: number;
  po_remaining_percent: number | null;
  po_status: PoStatus;
  po_expiry_date: string | null;
  po_override_approved: boolean;
  po_override_reason: string | null;
  fx_snapshot_at: string | null;
  shortlist_id: string | null;
  quotation_id: string | null;
  /** Release 2.0: immutable pin of approved quotation at Assignment convert. */
  accepted_quotation_id: string | null;
  /** Release 2.0: quotations.version_number at convert time. */
  accepted_quotation_version: number | null;
  campaign_object_id: string | null;
  source_campaign_object_version: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignLineRow = {
  id: string;
  document_number: string;
  campaign_header_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  platform: string | null;
  revenue: number;
  cost: number;
  revenue_before_vat: number;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number;
  revenue_vat_percent: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
  revenue_vat_exempt: boolean;
  cost_received: number | null;
  cost_received_currency: string | null;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  cost_after_vat: number;
  cost_vat_exempt: boolean;
  vat_locked: boolean;
  profit: number;
  profit_margin: number;
  markup_margin: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  billing_status: string;
  assignment_status: string;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  invoice_id: string | null;
  operational_status?: string;
  vendor_io_id?: string | null;
  currency_code: string;
  base_currency: string;
  fx_rate: number;
  fx_from_currency: string | null;
  fx_to_currency: string | null;
  fx_snapshot_at: string | null;
  po_override_flag: boolean;
  revenue_base: number;
  cost_base: number;
  profit_base: number;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  pricing_mode: AssignmentPricingMode;
  metadata: Record<string, unknown>;
  /** Release 2.0: quotation that projected this Assignment. */
  source_quotation_id: string | null;
  /** Release 2.0: primary quotation_items id (package leader or selected item). */
  source_quotation_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignCommercialSnapshotRow = {
  id: string;
  campaign_header_id: string;
  quotation_id: string;
  quotation_serial: string | null;
  version_number: number | null;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  commercial_revision_id?: string | null;
};

export type CommercialRevisionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "applied";

export type CommercialRevisionRow = {
  id: string;
  campaign_header_id: string;
  quotation_id: string;
  revision_number: number;
  commercial_version_number: number | null;
  status: CommercialRevisionStatus;
  reason: string;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  decision_notes: string | null;
  applied_at: string | null;
  concurrency_tokens: Record<string, string>;
  metadata: Record<string, unknown>;
};

export type CommercialRevisionLineRow = {
  id: string;
  revision_id: string;
  commercial_line_id: string;
  assignment_ids: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_fields: string[];
  created_at: string;
};

export type CampaignObjectLifecycleStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "archived"
  | "published";

export type CampaignObjectRow = {
  id: string;
  conversation_id: string;
  campaign_header_id: string | null;
  workflow_id: string | null;
  lifecycle_status: CampaignObjectLifecycleStatus;
  current_version: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignObjectVersionRow = {
  id: string;
  campaign_object_id: string;
  version: number;
  workflow_id: string | null;
  snapshot: Json;
  created_by: string;
  updated_by: string | null;
  created_at: string;
};

export type CampaignListItem = CampaignHeaderRow & {
  brand: { id: string; name: string } | null;
  client: { id: string; name: string; document_number: string; legal_name: string | null } | null;
  group: { id: string; name: string } | null;
  account_manager: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  lines: Pick<CampaignLineRow, "id" | "document_number" | "name" | "po_amount" | "revenue" | "cost" | "profit">[];
  /** Latest Client IO status for portfolio lifecycle (enriched on list load). */
  client_io_status?: string | null;
  has_client_io?: boolean;
  vendor_io_count?: number;
  approved_vendor_io_count?: number;
  sent_vendor_io_count?: number;
  deliverable_count?: number;
  /** True only when enriched evidence shows live/posted performance activity. */
  performance_active?: boolean;
};

/** Legacy campaigns view row shape */
export type CampaignRow = {
  id: string;
  document_number: string;
  client_id: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: CampaignStatus;
  budget: number;
  spent: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  account_manager_id: string | null;
  objectives: unknown[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  business_function: BusinessFunction | null;
};

export type PaymentTerms =
  | "due_on_receipt"
  | "net_15"
  | "net_30"
  | "net_45"
  | "net_60"
  | "net_90"
  | "custom";

export type ContractStatus =
  | "none"
  | "draft"
  | "sent"
  | "signed"
  | "expired"
  | "terminated";

export type ExclusivityType = "none" | "category" | "brand" | "full";

export type InfluencerGender =
  | "female"
  | "male"
  | "non_binary"
  | "prefer_not_to_say"
  | "other";

export type ClientDocumentType =
  | "trade_license"
  | "vat_certificate"
  | "tax_certificate"
  | "nda"
  | "msa_contract"
  | "sow";

export type InfluencerDocumentType =
  | "passport"
  | "national_id"
  | "signed_contract"
  | "media_kit"
  | "tax_document"
  | "rate_card"
  | "bank_letter";

export type InfluencerRow = {
  id: string;
  document_number: string;
  slug: string | null;
  route_short_id: string | null;
  profile_id: string | null;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  status: InfluencerStatus;
  country_code: string | null;
  country_codes: string[] | null;
  nationality: string | null;
  city: string | null;
  contract_status: ContractStatus | null;
  contract_expiry: string | null;
  payment_terms: PaymentTerms | null;
  exclusivity: ExclusivityType | null;
  gender: InfluencerGender | null;
  influencer_url: string | null;
  management_agency: string | null;
  agency_id: string | null;
  languages: string[];
  categories: string[];
  rate_card: Record<string, unknown>;
  payment_details: Record<string, unknown>;
  vat_registered: boolean;
  default_vat_percent: number;
  tax_registration_number: string | null;
  notes: string | null;
  /** JSON [{title, body}] — default Vendor IO Section 8 terms; NULL = platform default. */
  vendor_io_terms_text: string | null;
  /** Denorm: true when creator_crm_profiles row exists (CRM Phase 1). */
  has_commercial_profile: boolean;
  metadata: Record<string, unknown>;
  search_vector: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Phase 3 — creator enrichment orchestration metadata.
  last_enriched_at: string | null;
  enrichment_status: CreatorEnrichmentStatus;
  enrichment_source: string | null;
  enrichment_priority: number | null;
  next_refresh_at: string | null;
  apify_run_id: string | null;
  profile_data_version: number;
  field_sources: Record<string, EnrichmentFieldSource>;
  // Phase 3 — audience demographics (NULL until a real provider supplies them).
  audience_age_13_17: number | null;
  audience_age_18_24: number | null;
  audience_age_25_34: number | null;
  audience_age_35_44: number | null;
  audience_age_45_54: number | null;
  audience_age_55_plus: number | null;
  audience_gender_male: number | null;
  audience_gender_female: number | null;
  audience_gender_unknown: number | null;
  audience_top_countries: Array<{ code?: string; name?: string; percent?: number }> | null;
  audience_top_cities: Array<{ name?: string; percent?: number }> | null;
  demographic_source: CreatorDemographicSource;
  primary_avatar_url: string | null;
  primary_avatar_source: string | null;
  default_metrics_platform_account_id: string | null;
  thinkway_score: number | null;
  source_confidence: number | null;
};

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

export type InfluencerBankAccountRow = {
  id: string;
  influencer_id: string;
  bank_name: string | null;
  account_holder: string | null;
  beneficiary_name: string | null;
  relationship_type: string | null;
  relationship_description: string | null;
  iban: string | null;
  account_number: string | null;
  swift: string | null;
  country_code: string | null;
  currency: string | null;
  branch_name: string | null;
  address: string | null;
  routing_number: string | null;
  sort_code: string | null;
  national_id: string | null;
  tax_number: string | null;
  is_default: boolean;
  is_verified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorIoSignedArtifactRow = {
  id: string;
  vendor_io_id: string;
  influencer_id: string;
  artifact_kind: "upload" | "external_link";
  provider: string | null;
  file_name: string | null;
  url: string | null;
  storage_path: string | null;
  version_label: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorIoCommunicationRow = {
  id: string;
  vendor_io_id: string | null;
  influencer_id: string;
  assignment_id: string | null;
  channel: "email" | "whatsapp" | "instagram_dm" | "tiktok" | "phone" | "manual";
  direction: "outbound" | "inbound" | "internal";
  subject: string | null;
  body: string | null;
  external_message_id: string | null;
  metadata: Record<string, unknown>;
  logged_by: string | null;
  occurred_at: string;
  created_at: string;
};

export type VendorPaymentTimelineEventRow = {
  id: string;
  influencer_id: string;
  assignment_id: string | null;
  vendor_io_id: string | null;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

export type ClientCommercialRequirementsRow = {
  id: string;
  client_id: string;
  required_document_types: string[];
  payment_rules: Record<string, unknown>;
  usage_rights: string | null;
  approval_workflow: string | null;
  legal_clauses: unknown[];
  mandatory_deliverables: string[];
  exclusivity_notes: string | null;
  confidentiality_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandCommercialRequirementsRow = {
  id: string;
  brand_id: string;
  client_id: string;
  extra_document_types: string[];
  extra_legal_clauses: unknown[];
  extra_deliverables: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorAgreementTemplateRow = {
  id: string;
  influencer_id: string;
  client_id: string;
  brand_id: string | null;
  terms_text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatorEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "enriched"
  | "partial"
  | "awaiting_profile_details"
  | "failed"
  | "skipped";

export type EnrichmentFieldSource =
  | "actual"
  | "forecast"
  | "manual"
  | "imported"
  | "apify";

export type CreatorDemographicSource =
  | "unavailable"
  | "modash"
  | "hypeauditor"
  | "creatoriq"
  | "apify"
  | "manual";

export type CreatorEnrichmentRunRow = {
  id: string;
  influencer_id: string | null;
  platform_account_id: string | null;
  discovered_profile_id: string | null;
  trigger: string;
  priority: number;
  status: string;
  source: string | null;
  apify_run_id: string | null;
  forced: boolean;
  skipped_reason: string | null;
  fields_updated: string[];
  attempt: number;
  error_message: string | null;
  job_id: string | null;
  requested_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type InfluencerPlatformAccountRow = {
  id: string;
  influencer_id: string;
  platform: string;
  handle: string;
  username: string | null;
  profile_url: string | null;
  normalized_username: string | null;
  normalized_profile_url: string | null;
  profile_display_name: string | null;
  profile_bio: string | null;
  profile_picture_url: string | null;
  avatar_source: "manual" | "apify" | "discovery" | "uploaded";
  avatar_last_synced_at: string | null;
  follower_count: number | null;
  following_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  audience_country: string | null;
  audience_gender_split: Record<string, unknown>;
  is_verified: boolean;
  is_primary: boolean;
  sync_status: "pending" | "synced" | "partial" | "failed" | "manual" | "pending_api";
  sync_source: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  metrics_source: "synced" | "manual" | "unavailable" | "pending_api";
  metrics_last_synced_at: string | null;
  metrics_is_manual_override: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Phase 3 — per-platform enriched fields + state.
  posts_count: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  recent_publications:
    | Array<{
        url: string | null;
        thumbnail: string | null;
        likes: number | null;
        comments: number | null;
        views: number | null;
        posted_at: string | null;
        caption: string | null;
      }>
    | null;
  hashtags: string[] | null;
  mentions: string[] | null;
  interest_categories: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_links: string[] | null;
  last_enriched_at: string | null;
  enrichment_status: CreatorEnrichmentStatus;
  apify_run_id: string | null;
  profile_data_version: number;
  field_sources: Record<string, EnrichmentFieldSource>;
};

export type ClientDocumentRow = {
  id: string;
  client_id: string;
  document_type: ClientDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  expires_at: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InfluencerDocumentRow = {
  id: string;
  influencer_id: string;
  document_type: InfluencerDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  expires_at: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorListItem = InfluencerRow & {
  platform_accounts: Pick<
    InfluencerPlatformAccountRow,
    | "id"
    | "platform"
    | "handle"
    | "follower_count"
    | "is_primary"
    | "profile_url"
    | "profile_picture_url"
  >[];
};

export type VendorCampaignAssignment = {
  id: string;
  status: string;
  agreed_fee: number;
  currency: string;
  invited_at: string | null;
  confirmed_at: string | null;
  campaign: {
    id: string;
    name: string;
    document_number: string;
    status: CampaignStatus;
  } | null;
};

export type VendorDetail = InfluencerRow & {
  platform_accounts: InfluencerPlatformAccountRow[];
  campaign_assignments: VendorCampaignAssignment[];
  documents: InfluencerDocumentRow[];
};

export type ClientCampaignSummary = {
  id: string;
  name: string;
  document_number: string;
  status: CampaignStatus;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  brand: { id: string; name: string } | null;
};

export type ClientDetail = ClientRow & {
  documents: ClientDocumentRow[];
  campaigns: ClientCampaignSummary[];
  brands: ClientBrandRow[];
  group: { id: string; name: string; document_number: string } | null;
  vr_rate_percent: number | null;
  commercial_requirements: ClientCommercialRequirementsRow | null;
};

export type ClientOnboardingStatus =
  | "draft"
  | "legal_pending"
  | "finance_pending"
  | "ready"
  | "active";

export type ClientRow = {
  id: string;
  document_number: string;
  slug: string | null;
  route_short_id: string | null;
  group_id: string | null;
  name: string;
  name_ar: string | null;
  name_normalized: string;
  legal_name: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  status: ClientStatus;
  onboarding_status: ClientOnboardingStatus;
  legal_completed_at: string | null;
  finance_completed_at: string | null;
  contracts_completed_at: string | null;
  tax_completed_at: string | null;
  activated_at: string | null;
  onboarding_completed_by: string | null;
  onboarding_updated_by: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address: Record<string, unknown>;
  tax_id: string | null;
  trade_license_number: string | null;
  vat_number: string | null;
  legal_address: Record<string, unknown>;
  country: string | null;
  city: string | null;
  payment_terms: PaymentTerms | null;
  credit_limit: number | null;
  credit_limit_active: boolean;
  accept_credit_risk: boolean;
  client_category: string | null;
  client_subcategory: string | null;
  classification_source: string | null;
  classification_confidence: number | null;
  classification_reason: string | null;
  classified_at: string | null;
  approved_by_user: string | null;
  last_verified_at: string | null;
  needs_review: boolean;
  vr_rate_id: string | null;
  agency_or_direct: string | null;
  trade_license_expiry: string | null;
  currency: string;
  account_manager_id: string | null;
  client_owner_id: string | null;
  country_manager_id: string | null;
  notes: string | null;
  client_io_terms_text: string | null;
  client_workspace_enabled: boolean;
  client_workspace_package: string | null;
  client_workspace_tab_overrides: Record<string, unknown> | null;
  client_workspace_grandfathered: boolean;
  client_workspace_preview_started_at: string | null;
  client_workspace_preview_expires_at: string | null;
  client_workspace_preview_previous_package: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: {
          id?: string;
          document_number?: string;
          group_id?: string | null;
          name: string;
          name_ar?: string | null;
          legal_name?: string | null;
          industry?: string | null;
          website?: string | null;
          logo_url?: string | null;
          status?: ClientStatus;
          onboarding_status?: ClientOnboardingStatus;
          legal_completed_at?: string | null;
          finance_completed_at?: string | null;
          contracts_completed_at?: string | null;
          tax_completed_at?: string | null;
          onboarding_completed_by?: string | null;
          onboarding_updated_by?: string | null;
          activated_at?: string | null;
          billing_email?: string | null;
          billing_phone?: string | null;
          billing_address?: Record<string, unknown>;
          tax_id?: string | null;
          trade_license_number?: string | null;
          vat_number?: string | null;
          legal_address?: Record<string, unknown>;
          country?: string | null;
          city?: string | null;
          payment_terms?: PaymentTerms | null;
          credit_limit?: number | null;
          credit_limit_active?: boolean;
          accept_credit_risk?: boolean;
          client_category?: string | null;
          client_subcategory?: string | null;
          classification_source?: string | null;
          classification_confidence?: number | null;
          classification_reason?: string | null;
          classified_at?: string | null;
          approved_by_user?: string | null;
          last_verified_at?: string | null;
          needs_review?: boolean;
          vr_rate_id?: string | null;
          agency_or_direct?: string | null;
          trade_license_expiry?: string | null;
          currency?: string;
          account_manager_id?: string | null;
          client_owner_id?: string | null;
          country_manager_id?: string | null;
          notes?: string | null;
          client_io_terms_text?: string | null;
          client_workspace_enabled?: boolean;
          client_workspace_package?: string | null;
          client_workspace_tab_overrides?: Record<string, unknown> | null;
          client_workspace_grandfathered?: boolean;
          client_workspace_preview_started_at?: string | null;
          client_workspace_preview_expires_at?: string | null;
          client_workspace_preview_previous_package?: string | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_classification_cache: {
        Row: {
          id: string;
          company_name_normalized: string;
          category_slug: string;
          subcategory_slug: string;
          confidence: number;
          source: string;
          classification_reason: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name_normalized: string;
          category_slug: string;
          subcategory_slug: string;
          confidence: number;
          source: string;
          classification_reason?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_classification_cache"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_client_content_decisions: {
        Row: {
          id: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id: string | null;
          asset_id: string;
          version_id: string;
          review_id: string | null;
          journey_id: string | null;
          decision: "approved" | "changes_requested";
          comment: string | null;
          actor_kind: "client" | "internal";
          actor_label: string | null;
          actor_user_id: string | null;
          decided_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id?: string | null;
          asset_id: string;
          version_id: string;
          review_id?: string | null;
          journey_id?: string | null;
          decision: "approved" | "changes_requested";
          comment?: string | null;
          actor_kind?: "client" | "internal";
          actor_label?: string | null;
          actor_user_id?: string | null;
          decided_at?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_client_content_decisions"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_headers: {
        Row: CampaignHeaderRow;
        Insert: {
          id?: string;
          document_number?: string;
          name: string;
          description?: string | null;
          brief?: string | null;
          campaign_intelligence_profile_id?: string | null;
          brand_id: string;
          group_id?: string | null;
          client_id?: string;
          team_id?: string | null;
          status?: CampaignStatus;
          currency_code?: string;
          category_id?: string | null;
          subcategory_id?: string | null;
          agency_or_direct?: AgencyOrDirect | null;
          vr_rate_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          account_manager_id?: string | null;
          report_type_id?: string | null;
          objectives?: unknown;
          metadata?: Record<string, unknown>;
          shortlist_id?: string | null;
          quotation_id?: string | null;
          accepted_quotation_id?: string | null;
          accepted_quotation_version?: number | null;
          campaign_object_id?: string | null;
          source_campaign_object_version?: number | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_headers"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_scripts: {
        Row: {
          id: string;
          campaign_header_id: string;
          current_revision_id: string | null;
          source_language: "en" | "ar";
          status: "empty" | "current";
          origin: "client" | "internal";
          created_at: string;
          updated_at: string;
          translation_status: "idle" | "pending" | "generated" | "failed";
          translation_target_language: "en" | "ar" | null;
          translation_source_revision_id: string | null;
          translation_error: string | null;
          translation_attempts: number;
          translation_updated_at: string | null;
          assignment_deliverable_id: string | null;
          assignment_post_schedule_id: string | null;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          current_revision_id?: string | null;
          source_language: "en" | "ar";
          status?: "empty" | "current";
          origin: "client" | "internal";
          created_at?: string;
          updated_at?: string;
          translation_status?: "idle" | "pending" | "generated" | "failed";
          translation_target_language?: "en" | "ar" | null;
          translation_source_revision_id?: string | null;
          translation_error?: string | null;
          translation_attempts?: number;
          translation_updated_at?: string | null;
          assignment_deliverable_id?: string | null;
          assignment_post_schedule_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_scripts"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_script_revisions: {
        Row: {
          id: string;
          script_id: string;
          campaign_header_id: string;
          revision_number: number;
          business_version: string;
          body_en: string;
          body_ar: string;
          source_language: "en" | "ar";
          en_origin: "source" | "generated" | "human_edited";
          ar_origin: "source" | "generated" | "human_edited";
          actor_kind: "internal" | "client";
          actor_user_id: string | null;
          actor_label: string | null;
          parent_revision_id: string | null;
          review_id: string | null;
          original_file_name: string | null;
          original_storage_bucket: string | null;
          original_storage_path: string | null;
          original_mime_type: string | null;
          original_file_size: number | null;
          change_summary: string | null;
          created_at: string;
          assignment_id: string | null;
        };
        Insert: {
          id?: string;
          script_id: string;
          campaign_header_id: string;
          revision_number: number;
          business_version: string;
          body_en?: string;
          body_ar?: string;
          source_language: "en" | "ar";
          en_origin: "source" | "generated" | "human_edited";
          ar_origin: "source" | "generated" | "human_edited";
          actor_kind: "internal" | "client";
          actor_user_id?: string | null;
          actor_label?: string | null;
          parent_revision_id?: string | null;
          review_id?: string | null;
          original_file_name?: string | null;
          original_storage_bucket?: string | null;
          original_storage_path?: string | null;
          original_mime_type?: string | null;
          original_file_size?: number | null;
          change_summary?: string | null;
          created_at?: string;
          assignment_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_script_revisions"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_script_assignments: {
        Row: {
          id: string;
          campaign_header_id: string;
          script_id: string;
          campaign_line_id: string | null;
          influencer_id: string;
          campaign_influencer_id: string | null;
          mode: "inherited" | "customized";
          override_revision_id: string | null;
          forked_from_master_revision_id: string | null;
          assigned_at: string;
          assigned_by: string | null;
          updated_at: string;
          translation_status: "idle" | "pending" | "generated" | "failed";
          translation_target_language: "en" | "ar" | null;
          translation_source_revision_id: string | null;
          translation_error: string | null;
          translation_attempts: number;
          translation_updated_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          script_id: string;
          campaign_line_id?: string | null;
          influencer_id: string;
          campaign_influencer_id?: string | null;
          mode?: "inherited" | "customized";
          override_revision_id?: string | null;
          forked_from_master_revision_id?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          updated_at?: string;
          translation_status?: "idle" | "pending" | "generated" | "failed";
          translation_target_language?: "en" | "ar" | null;
          translation_source_revision_id?: string | null;
          translation_error?: string | null;
          translation_attempts?: number;
          translation_updated_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_script_assignments"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_commercial_snapshots: {
        Row: CampaignCommercialSnapshotRow;
        Insert: {
          id?: string;
          campaign_header_id: string;
          quotation_id: string;
          quotation_serial?: string | null;
          version_number?: number | null;
          payload?: Record<string, unknown>;
          created_by?: string | null;
          created_at?: string;
          commercial_revision_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_commercial_snapshots"]["Insert"]
        >;
        Relationships: [];
      };
      commercial_revisions: {
        Row: CommercialRevisionRow;
        Insert: {
          id?: string;
          campaign_header_id: string;
          quotation_id: string;
          revision_number: number;
          commercial_version_number?: number | null;
          status?: CommercialRevisionStatus;
          reason: string;
          comments?: string | null;
          created_by?: string | null;
          created_at?: string;
          submitted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          decision_notes?: string | null;
          applied_at?: string | null;
          concurrency_tokens?: Record<string, string>;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<
          Database["public"]["Tables"]["commercial_revisions"]["Insert"]
        >;
        Relationships: [];
      };
      commercial_revision_lines: {
        Row: CommercialRevisionLineRow;
        Insert: {
          id?: string;
          revision_id: string;
          commercial_line_id: string;
          assignment_ids?: string[];
          old_values?: Record<string, unknown>;
          new_values?: Record<string, unknown>;
          changed_fields?: string[];
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["commercial_revision_lines"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_lines: {
        Row: CampaignLineRow;
        Insert: {
          id?: string;
          document_number?: string;
          campaign_header_id: string;
          name: string;
          description?: string | null;
          status?: CampaignStatus;
          platform?: string | null;
          revenue?: number;
          cost?: number;
          revenue_before_vat?: number;
          usage_rights_amount?: number;
          usage_rights_cost?: number;
          agency_fee_percent?: number;
          agency_fee_amount?: number;
          revenue_vat_percent?: number;
          revenue_vat_amount?: number;
          revenue_after_vat?: number;
          revenue_vat_exempt?: boolean;
          cost_before_vat?: number;
          cost_vat_percent?: number;
          cost_vat_amount?: number;
          cost_after_vat?: number;
          cost_vat_exempt?: boolean;
          vat_locked?: boolean;
          po_amount?: number;
          po_consumed?: number;
          billing_status?: string;
          assignment_status?: string;
          revenue_locked?: boolean;
          cost_locked?: boolean;
          vendor_assignment_locked?: boolean;
          invoice_id?: string | null;
          operational_status?: string;
          vendor_io_id?: string | null;
          finance_override_until?: string | null;
          billing_moved_at?: string | null;
          billing_invoiced_at?: string | null;
          currency_code?: string;
          base_currency?: string;
          fx_rate?: number;
          fx_from_currency?: string | null;
          fx_to_currency?: string | null;
          fx_snapshot_at?: string | null;
          cost_received?: number | null;
          cost_received_currency?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          sort_order?: number;
          pricing_mode?: AssignmentPricingMode;
          metadata?: Record<string, unknown>;
          source_quotation_id?: string | null;
          source_quotation_item_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_lines"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_object_versions: {
        Row: CampaignObjectVersionRow;
        Insert: {
          id?: string;
          campaign_object_id: string;
          version?: number;
          workflow_id?: string | null;
          snapshot: Json;
          created_by: string;
          updated_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_object_versions"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_objects: {
        Row: CampaignObjectRow;
        Insert: {
          id: string;
          conversation_id: string;
          campaign_header_id?: string | null;
          workflow_id?: string | null;
          lifecycle_status?: CampaignObjectLifecycleStatus;
          current_version?: number;
          created_by: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_objects"]["Insert"]
        >;
        Relationships: [];
      };
      groups: {
        Row: GroupRow;
        Insert: {
          name: string;
          region?: string | null;
          account_director_id?: string | null;
          status?: ClientStatus;
          notes?: string | null;
          logo_url?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [];
      };
      group_documents: {
        Row: GroupDocumentRow;
        Insert: {
          group_id: string;
          document_type: GroupDocumentType;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          expires_at?: string | null;
          notes?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["group_documents"]["Insert"]>;
        Relationships: [];
      };
      brands: {
        Row: BrandRow;
        Insert: {
          client_id: string;
          group_id?: string;
          name: string;
          status?: ClientStatus;
          category_id?: string | null;
          subcategory_id?: string | null;
          vr_rate_id?: string | null;
          currency_code?: string;
          country_code?: string | null;
          notes?: string | null;
          logo_url?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      agencies: {
        Row: AgencyRow;
        Insert: {
          name: string;
          legal_name?: string | null;
          email?: string | null;
          phone?: string | null;
          country_code?: string | null;
          status?: InfluencerStatus;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Insert"]>;
        Relationships: [];
      };
      md_categories: {
        Row: { id: string; code: string; name: string; is_active: boolean };
        Insert: { code: string; name: string };
        Update: Partial<{ code: string; name: string; is_active: boolean }>;
        Relationships: [];
      };
      md_subcategories: {
        Row: { id: string; category_id: string; code: string; name: string; is_active: boolean };
        Insert: { category_id: string; code: string; name: string };
        Update: Partial<{ code: string; name: string; is_active: boolean }>;
        Relationships: [];
      };
      md_currencies: {
        Row: {
          code: string;
          name: string;
          symbol: string | null;
          decimal_places: number;
          country_code: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol?: string | null;
          decimal_places?: number;
          country_code?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["md_currencies"]["Insert"]>;
        Relationships: [];
      };
      md_exchange_rates: {
        Row: {
          id: string;
          from_currency: string;
          to_currency: string;
          exchange_rate: number;
          effective_start_date: string;
          effective_end_date: string | null;
          is_active: boolean;
          source: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_currency: string;
          to_currency: string;
          exchange_rate: number;
          effective_start_date: string;
          effective_end_date?: string | null;
          is_active?: boolean;
          source?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["md_exchange_rates"]["Insert"]>;
        Relationships: [];
      };
      fx_rate_audit_logs: {
        Row: {
          id: string;
          exchange_rate_id: string | null;
          action: string;
          old_data: Record<string, unknown>;
          new_data: Record<string, unknown>;
          override_reason: string | null;
          recalculation_scope: string | null;
          impacted_record_count: number;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exchange_rate_id?: string | null;
          action: string;
          old_data?: Record<string, unknown>;
          new_data?: Record<string, unknown>;
          override_reason?: string | null;
          recalculation_scope?: string | null;
          impacted_record_count?: number;
          changed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fx_rate_audit_logs"]["Insert"]>;
        Relationships: [];
      };
      assignment_deliverables: {
        Row: {
          id: string;
          campaign_header_id: string;
          campaign_line_id: string;
          sort_order: number;
          platform: string;
          deliverable_type: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          revenue_before_vat: number;
          usage_rights_amount: number;
          usage_rights_cost: number;
          agency_fee_percent: number;
          agency_fee_amount: number;
          revenue_vat_percent: number;
          revenue_vat_amount: number;
          revenue_after_vat: number;
          revenue_vat_exempt: boolean;
          cost_before_vat: number;
          cost_vat_percent: number;
          cost_vat_amount: number;
          cost_after_vat: number;
          cost_vat_exempt: boolean;
          live_date: string | null;
          schedule_mode: string;
          notes: string | null;
          metadata: Record<string, unknown>;
          billable_amount: number;
          invoiced_amount: number;
          collected_amount: number;
          disputed_amount: number;
          remaining_amount: number;
          billing_status: string;
          invoice_line_item_id: string | null;
          invoiced_at: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          campaign_line_id: string;
          sort_order?: number;
          platform: string;
          deliverable_type: string;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          revenue_before_vat?: number;
          usage_rights_amount?: number;
          usage_rights_cost?: number;
          agency_fee_percent?: number;
          agency_fee_amount?: number;
          revenue_vat_percent?: number;
          revenue_vat_amount?: number;
          revenue_after_vat?: number;
          revenue_vat_exempt?: boolean;
          cost_before_vat?: number;
          cost_vat_percent?: number;
          cost_vat_amount?: number;
          cost_after_vat?: number;
          cost_vat_exempt?: boolean;
          live_date?: string | null;
          schedule_mode?: string;
          notes?: string | null;
          metadata?: Record<string, unknown>;
          billable_amount?: number;
          invoiced_amount?: number;
          collected_amount?: number;
          disputed_amount?: number;
          remaining_amount?: number;
          billing_status?: string;
          invoice_line_item_id?: string | null;
          invoiced_at?: string | null;
          locked_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["assignment_deliverables"]["Insert"]
        >;
        Relationships: [];
      };
      assignment_post_schedule: {
        Row: {
          id: string;
          assignment_deliverable_id: string;
          campaign_line_id: string;
          sequence_number: number;
          live_date: string | null;
          status: string;
          notes: string | null;
          proof_url: string | null;
          metadata: Record<string, unknown>;
          revenue_before_vat: number;
          cost_before_vat: number;
          revenue_vat_percent: number;
          revenue_vat_amount: number;
          cost_vat_percent: number;
          cost_vat_amount: number;
          billing_status: string;
          billable_amount: number;
          invoiced_amount: number;
          collected_amount: number;
          remaining_amount: number;
          invoice_line_item_id: string | null;
          invoiced_at: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_deliverable_id: string;
          campaign_line_id: string;
          sequence_number?: number;
          live_date?: string | null;
          status?: string;
          notes?: string | null;
          proof_url?: string | null;
          metadata?: Record<string, unknown>;
          revenue_before_vat?: number;
          cost_before_vat?: number;
          revenue_vat_percent?: number;
          revenue_vat_amount?: number;
          cost_vat_percent?: number;
          cost_vat_amount?: number;
          billing_status?: string;
          billable_amount?: number;
          invoiced_amount?: number;
          collected_amount?: number;
          remaining_amount?: number;
          invoice_line_item_id?: string | null;
          invoiced_at?: string | null;
          locked_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["assignment_post_schedule"]["Insert"]
        >;
        Relationships: [];
      };
      deliverable_assets: {
        Row: {
          id: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id: string | null;
          asset_type: string;
          medium: string;
          label: string | null;
          sort_order: number;
          current_version_id: string | null;
          created_by: string | null;
          created_at: string;
          archived_at: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id?: string | null;
          asset_type: string;
          medium?: string;
          label?: string | null;
          sort_order?: number;
          current_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          archived_at?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<
          Database["public"]["Tables"]["deliverable_assets"]["Insert"]
        >;
        Relationships: [];
      };
      deliverable_asset_versions: {
        Row: {
          id: string;
          asset_id: string;
          version_number: number;
          storage_bucket: string | null;
          storage_path: string | null;
          external_url: string | null;
          mime_type: string | null;
          file_name: string | null;
          file_size: number | null;
          text_body: string | null;
          change_summary: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          asset_id: string;
          version_number: number;
          storage_bucket?: string | null;
          storage_path?: string | null;
          external_url?: string | null;
          mime_type?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          text_body?: string | null;
          change_summary?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<
          Database["public"]["Tables"]["deliverable_asset_versions"]["Insert"]
        >;
        Relationships: [];
      };
      deliverable_comments: {
        Row: {
          id: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id: string | null;
          asset_id: string | null;
          audience: string;
          body: string;
          author_user_id: string | null;
          author_display_name: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id?: string | null;
          asset_id?: string | null;
          audience?: string;
          body: string;
          author_user_id?: string | null;
          author_display_name?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["deliverable_comments"]["Insert"]
        >;
        Relationships: [];
      };
      deliverable_documentation_events: {
        Row: {
          id: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id: string | null;
          asset_id: string | null;
          version_id: string | null;
          comment_id: string | null;
          event_type: string;
          actor_user_id: string | null;
          actor_label: string | null;
          payload: Record<string, unknown>;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id?: string | null;
          asset_id?: string | null;
          version_id?: string | null;
          comment_id?: string | null;
          event_type: string;
          actor_user_id?: string | null;
          actor_label?: string | null;
          payload?: Record<string, unknown>;
          occurred_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["deliverable_documentation_events"]["Insert"]
        >;
        Relationships: [];
      };
      deliverable_publication_links: {
        Row: {
          id: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id: string | null;
          publication_id: string;
          published_url: string | null;
          platform: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          assignment_deliverable_id: string;
          assignment_post_schedule_id?: string | null;
          publication_id: string;
          published_url?: string | null;
          platform?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["deliverable_publication_links"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_publications: {
        Row: {
          id: string;
          campaign_header_id: string;
          campaign_line_id: string | null;
          assignment_deliverable_id: string | null;
          assignment_post_schedule_id: string | null;
          influencer_id: string | null;
          platform: string;
          publication_type: string;
          content_url: string | null;
          publication_date: string | null;
          status: string;
          assignee_id: string | null;
          caption: string | null;
          hashtags: string | null;
          mentions: string | null;
          thumbnail_url: string | null;
          notes: string | null;
          detected_by: string | null;
          auto_detected: boolean;
          detection_source: string | null;
          external_media_id: string | null;
          matched_hashtag: string | null;
          api_sync_status: string | null;
          sync_status: string | null;
          sync_source: string | null;
          last_synced_at: string | null;
          impressions: number | null;
          reach: number | null;
          views: number | null;
          unique_views: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          clicks: number | null;
          plays: number | null;
          watch_time_seconds: number | null;
          average_watch_time_seconds: number | null;
          completion_rate: number | null;
          engagement_rate: number | null;
          view_rate: number | null;
          cpm: number | null;
          cpv: number | null;
          cpe: number | null;
          cpc: number | null;
          sentiment_score: number | null;
          brand_safety_score: number | null;
          authenticity_score: number | null;
          cost: number | null;
          currency: string | null;
          engagement_views: number | null;
          engagement_likes: number | null;
          engagement_comments: number | null;
          engagement_shares: number | null;
          metrics_refresh_status: string;
          metrics_refresh_attempted_at: string | null;
          metrics_collection_source: string | null;
          engagements: number | null;
          metrics_provider: string | null;
          metrics_confidence: number | null;
          metrics_next_refresh_at: string | null;
          engagement_rate_method: string | null;
          screenshot_url: string | null;
          screenshot_captured_at: string | null;
          screenshot_source: string | null;
          reach_source: string | null;
          forecast_reach: number | null;
          actual_reach: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          campaign_line_id?: string | null;
          assignment_deliverable_id?: string | null;
          assignment_post_schedule_id?: string | null;
          influencer_id?: string | null;
          platform: string;
          publication_type: string;
          content_url?: string | null;
          publication_date?: string | null;
          status?: string;
          assignee_id?: string | null;
          caption?: string | null;
          hashtags?: string | null;
          notes?: string | null;
          detected_by?: string | null;
          auto_detected?: boolean;
          detection_source?: string | null;
          external_media_id?: string | null;
          matched_hashtag?: string | null;
          api_sync_status?: string | null;
          last_synced_at?: string | null;
          engagement_views?: number | null;
          engagement_likes?: number | null;
          engagement_comments?: number | null;
          engagement_shares?: number | null;
          metrics_refresh_status?: string;
          metrics_refresh_attempted_at?: string | null;
          metrics_collection_source?: string | null;
          engagements?: number | null;
          metrics_provider?: string | null;
          metrics_confidence?: number | null;
          metrics_next_refresh_at?: string | null;
          engagement_rate_method?: string | null;
          screenshot_url?: string | null;
          screenshot_captured_at?: string | null;
          screenshot_source?: string | null;
          reach_source?: string | null;
          forecast_reach?: number | null;
          actual_reach?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_publications"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "campaign_publications_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_publications_campaign_header_id_fkey";
            columns: ["campaign_header_id"];
            isOneToOne: false;
            referencedRelation: "campaign_headers";
            referencedColumns: ["id"];
          },
        ];
      };
      publication_metric_sync_logs: {
        Row: {
          id: string;
          publication_id: string;
          campaign_header_id: string;
          status: string;
          metrics_refresh_status: string | null;
          provider: string;
          attempt_order: number;
          message: string | null;
          error_code: string | null;
          metrics_snapshot: Json | null;
          triggered_by: string | null;
          created_at: string;
          completed_at: string | null;
          response_summary: Json | null;
          duration_ms: number | null;
          previous_er: number | null;
          new_er: number | null;
          previous_method: string | null;
          new_method: string | null;
        };
        Insert: {
          id?: string;
          publication_id: string;
          campaign_header_id: string;
          status: string;
          metrics_refresh_status?: string | null;
          provider: string;
          attempt_order?: number;
          message?: string | null;
          error_code?: string | null;
          metrics_snapshot?: Json | null;
          triggered_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
          response_summary?: Json | null;
          duration_ms?: number | null;
          previous_er?: number | null;
          new_er?: number | null;
          previous_method?: string | null;
          new_method?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["publication_metric_sync_logs"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "publication_metric_sync_logs_publication_id_fkey";
            columns: ["publication_id"];
            isOneToOne: false;
            referencedRelation: "campaign_publications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_metric_sync_logs_campaign_header_id_fkey";
            columns: ["campaign_header_id"];
            isOneToOne: false;
            referencedRelation: "campaign_headers";
            referencedColumns: ["id"];
          },
        ];
      };
      md_platform_deliverable_types: {
        Row: {
          id: string;
          platform: string;
          code: string;
          name: string;
          short_name: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          code: string;
          name: string;
          short_name: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["md_platform_deliverable_types"]["Insert"]
        >;
        Relationships: [];
      };
      po_governance_logs: {
        Row: {
          id: string;
          campaign_header_id: string;
          action: string;
          field_name: string | null;
          old_value: Record<string, unknown> | null;
          new_value: Record<string, unknown> | null;
          override_reason: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          action: string;
          field_name?: string | null;
          old_value?: Record<string, unknown> | null;
          new_value?: Record<string, unknown> | null;
          override_reason?: string | null;
          changed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["po_governance_logs"]["Insert"]>;
        Relationships: [];
      };
      finance_notifications: {
        Row: {
          id: string;
          notification_type: string;
          campaign_header_id: string | null;
          title: string;
          message: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_type: string;
          campaign_header_id?: string | null;
          title: string;
          message: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["finance_notifications"]["Insert"]>;
        Relationships: [];
      };
      campaign_purchase_orders: {
        Row: {
          id: string;
          campaign_header_id: string;
          po_number: string;
          po_currency: string;
          po_exchange_rate: number;
          po_amount_original: number;
          po_amount_campaign_currency: number;
          po_consumed_amount: number;
          po_remaining_amount: number;
          po_remaining_percent: number | null;
          po_status: PoStatus;
          po_expiry_date: string | null;
          is_primary: boolean;
          po_override_approved: boolean;
          po_override_reason: string | null;
          fx_snapshot_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id: string;
          po_number: string;
          po_currency: string;
          po_exchange_rate?: number;
          po_amount_original?: number;
          po_amount_campaign_currency?: number;
          po_consumed_amount?: number;
          po_remaining_amount?: number;
          po_remaining_percent?: number | null;
          po_status?: PoStatus;
          po_expiry_date?: string | null;
          is_primary?: boolean;
          po_override_approved?: boolean;
          po_override_reason?: string | null;
          fx_snapshot_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_purchase_orders"]["Insert"]>;
        Relationships: [];
      };
      md_countries: {
        Row: { code: string; name: string; is_active: boolean };
        Insert: { code: string; name: string };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      md_teams: {
        Row: { id: string; code: string; name: string; is_active: boolean };
        Insert: { code: string; name: string };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      md_report_types: {
        Row: { id: string; code: string; name: string; is_active: boolean };
        Insert: { code: string; name: string };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      md_payment_terms: {
        Row: { id: string; code: string; name: string; days_due: number | null; is_active: boolean };
        Insert: { code: string; name: string; days_due?: number | null };
        Update: Partial<{ name: string; days_due: number | null; is_active: boolean }>;
        Relationships: [];
      };
      md_vr_rates: {
        Row: { id: string; code: string; name: string; rate_percent: number; is_active: boolean };
        Insert: { code: string; name: string; rate_percent: number };
        Update: Partial<{ name: string; rate_percent: number; is_active: boolean }>;
        Relationships: [];
      };
      md_vat_rates: {
        Row: {
          id: string;
          country_code: string;
          vat_name: string;
          vat_rate: number;
          is_default: boolean;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
        };
        Insert: {
          country_code: string;
          vat_name?: string;
          vat_rate: number;
          is_default?: boolean;
          effective_from?: string;
          effective_to?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["md_vat_rates"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: CampaignRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          document_number: string;
          client_id: string;
          campaign_id: string | null;
          campaign_header_id: string | null;
          total: number;
          amount_paid: number;
          status: string;
          collection_status: string;
          issue_date: string;
          due_date: string | null;
          currency: string;
          subtotal?: number;
          tax_amount?: number;
          revenue_before_vat?: number;
          revenue_vat_amount?: number;
          revenue_after_vat?: number;
          revenue_vat_exempt?: boolean;
          billing_country_code?: string | null;
          notes?: string | null;
          created_by?: string | null;
          regeneration_status?: string;
          is_operational_locked?: boolean;
          version_number?: number;
          ungenerated_at?: string | null;
          ungenerated_by?: string | null;
          ungenerate_reason?: string | null;
        };
        Insert: {
          document_number?: string;
          client_id: string;
          campaign_id?: string | null;
          campaign_header_id?: string | null;
          total?: number;
          amount_paid?: number;
          status?: string;
          collection_status?: string;
          issue_date?: string;
          due_date?: string | null;
          currency?: string;
          billing_country_code?: string | null;
          notes?: string | null;
          created_by?: string | null;
          regeneration_status?: string;
          version_number?: number;
          ungenerated_at?: string | null;
          ungenerated_by?: string | null;
          ungenerate_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]> & {
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          version_number?: number;
          regeneration_status?: string;
        };
        Relationships: [];
      };
      financial_approval_requests: {
        Row: {
          id: string;
          document_number: string;
          entity_type: string;
          entity_id: string;
          approval_stage: string;
          chain_order: number;
          status: string;
          title: string;
          description: string | null;
          requested_by: string | null;
          assigned_to: string | null;
          decided_by: string | null;
          decided_at: string | null;
          decision_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          entity_type: string;
          entity_id: string;
          approval_stage: string;
          chain_order: number;
          title: string;
          description?: string | null;
          requested_by?: string | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["financial_approval_requests"]["Insert"]> & {
          decided_by?: string | null;
          decided_at?: string | null;
          decision_notes?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      vendor_payment_batches: {
        Row: {
          id: string;
          document_number: string;
          name: string;
          status: string;
          batch_date: string;
          total_amount: number;
          currency: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          status?: string;
          total_amount?: number;
          currency?: string;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_payment_batches"]["Insert"]>;
        Relationships: [];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          campaign_line_id: string | null;
          campaign_header_id: string | null;
          campaign_id: string | null;
          assignment_deliverable_id: string | null;
          sort_order: number;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          revenue_before_vat?: number;
          revenue_vat_percent?: number;
          revenue_vat_amount?: number;
          revenue_vat_exempt?: boolean;
        };
        Insert: {
          invoice_id: string;
          campaign_line_id?: string | null;
          campaign_header_id?: string | null;
          campaign_id?: string | null;
          assignment_deliverable_id?: string | null;
          sort_order?: number;
          description: string;
          quantity?: number;
          unit_price: number;
          revenue_before_vat?: number;
          revenue_vat_percent?: number;
          revenue_vat_amount?: number;
          revenue_vat_exempt?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_line_items"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          document_number: string;
          invoice_id: string;
          client_id: string;
          amount: number;
          currency: string;
          status: string;
          payment_method: string;
          reference_number: string | null;
          notes: string | null;
          paid_at: string | null;
          recorded_by: string | null;
        };
        Insert: {
          document_number?: string;
          invoice_id: string;
          client_id: string;
          amount: number;
          currency?: string;
          status?: string;
          payment_method?: string;
          reference_number?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          recorded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      deliverables: {
        Row: {
          id: string;
          document_number: string;
          campaign_id: string;
          influencer_id: string;
          campaign_influencer_id: string | null;
          deliverable_type: string;
          title: string;
          status: string;
          platform: string | null;
          due_date: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          published_at: string | null;
          content_url: string | null;
          metrics: Record<string, unknown>;
        };
        Insert: {
          document_number: string;
          campaign_id: string;
          influencer_id: string;
          campaign_influencer_id?: string | null;
          deliverable_type: string;
          title: string;
          status?: string;
          platform?: string | null;
          due_date?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["deliverables"]["Insert"]>;
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          document_number: string;
          entity_type: string;
          entity_id: string;
          title: string;
          status: string;
          due_at: string | null;
          decided_at: string | null;
          assigned_to: string | null;
        };
        Insert: {
          document_number: string;
          entity_type: string;
          entity_id: string;
          title: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["approvals"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          actor_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          action: string;
          entity_type: string;
          entity_id?: string | null;
          actor_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          is_active?: boolean;
          business_function?: BusinessFunction | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      influencers: {
        Row: InfluencerRow;
        Insert: {
          id?: string;
          document_number?: string;
          display_name: string;
          legal_name?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: InfluencerStatus;
          country_code?: string | null;
          country_codes?: string[] | null;
          nationality?: string | null;
          city?: string | null;
          contract_status?: ContractStatus | null;
          contract_expiry?: string | null;
          payment_terms?: PaymentTerms | null;
          exclusivity?: ExclusivityType | null;
          gender?: InfluencerGender | null;
          influencer_url?: string | null;
          agency_id?: string | null;
          management_agency?: string | null;
          languages?: string[];
          categories?: string[];
          rate_card?: Record<string, unknown>;
          payment_details?: Record<string, unknown>;
          vat_registered?: boolean;
          default_vat_percent?: number;
          tax_registration_number?: string | null;
          notes?: string | null;
          vendor_io_terms_text?: string | null;
          has_commercial_profile?: boolean;
          created_by?: string | null;
          last_enriched_at?: string | null;
          enrichment_status?: CreatorEnrichmentStatus;
          enrichment_source?: string | null;
          enrichment_priority?: number | null;
          next_refresh_at?: string | null;
          apify_run_id?: string | null;
          profile_data_version?: number;
          field_sources?: Record<string, EnrichmentFieldSource>;
          audience_age_13_17?: number | null;
          audience_age_18_24?: number | null;
          audience_age_25_34?: number | null;
          audience_age_35_44?: number | null;
          audience_age_45_54?: number | null;
          audience_age_55_plus?: number | null;
          audience_gender_male?: number | null;
          audience_gender_female?: number | null;
          audience_gender_unknown?: number | null;
          audience_top_countries?: Array<{ code?: string; name?: string; percent?: number }> | null;
          audience_top_cities?: Array<{ name?: string; percent?: number }> | null;
  demographic_source?: CreatorDemographicSource;
  primary_avatar_url?: string | null;
  primary_avatar_source?: string | null;
  default_metrics_platform_account_id?: string | null;
  thinkway_score?: number | null;
  source_confidence?: number | null;
};
        Update: Partial<Database["public"]["Tables"]["influencers"]["Insert"]>;
        Relationships: [];
      };
      creator_crm_profiles: {
        Row: CreatorCrmProfileRow;
        Insert: {
          influencer_id: string;
          crm_status?: CreatorCrmStatus;
          activated_at?: string;
          activated_by?: string | null;
          activated_reason: CreatorCrmActivationReason;
          completeness_score?: number;
          completeness_missing?: unknown[];
          completeness_updated_at?: string | null;
          managed_by_agency_id?: string | null;
          commercial_owner_profile_id?: string | null;
          preferred_currency?: string | null;
          onboarding_source?: string | null;
          negotiation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_crm_profiles"]["Insert"]>;
        Relationships: [];
      };
      creator_crm_activation_events: {
        Row: CreatorCrmActivationEventRow;
        Insert: {
          id?: string;
          influencer_id: string;
          reason: CreatorCrmActivationReason;
          actor_id?: string | null;
          source_entity_type?: string | null;
          source_entity_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_crm_activation_events"]["Insert"]>;
        Relationships: [];
      };
      influencer_bank_accounts: {
        Row: InfluencerBankAccountRow;
        Insert: {
          id?: string;
          influencer_id: string;
          bank_name?: string | null;
          account_holder?: string | null;
          beneficiary_name?: string | null;
          relationship_type?: string | null;
          relationship_description?: string | null;
          iban?: string | null;
          account_number?: string | null;
          swift?: string | null;
          country_code?: string | null;
          currency?: string | null;
          branch_name?: string | null;
          address?: string | null;
          routing_number?: string | null;
          sort_code?: string | null;
          national_id?: string | null;
          tax_number?: string | null;
          is_default?: boolean;
          is_verified?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["influencer_bank_accounts"]["Insert"]>;
        Relationships: [];
      };
      vendor_io_signed_artifacts: {
        Row: VendorIoSignedArtifactRow;
        Insert: {
          id?: string;
          vendor_io_id: string;
          influencer_id: string;
          artifact_kind: "upload" | "external_link";
          provider?: string | null;
          file_name?: string | null;
          url?: string | null;
          storage_path?: string | null;
          version_label?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_io_signed_artifacts"]["Insert"]>;
        Relationships: [];
      };
      vendor_io_communications: {
        Row: VendorIoCommunicationRow;
        Insert: {
          id?: string;
          vendor_io_id?: string | null;
          influencer_id: string;
          assignment_id?: string | null;
          channel: VendorIoCommunicationRow["channel"];
          direction?: VendorIoCommunicationRow["direction"];
          subject?: string | null;
          body?: string | null;
          external_message_id?: string | null;
          metadata?: Record<string, unknown>;
          logged_by?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_io_communications"]["Insert"]>;
        Relationships: [];
      };
      vendor_payment_timeline_events: {
        Row: VendorPaymentTimelineEventRow;
        Insert: {
          id?: string;
          influencer_id: string;
          assignment_id?: string | null;
          vendor_io_id?: string | null;
          event_type: string;
          summary: string;
          metadata?: Record<string, unknown>;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_payment_timeline_events"]["Insert"]>;
        Relationships: [];
      };
      client_commercial_requirements: {
        Row: ClientCommercialRequirementsRow;
        Insert: {
          id?: string;
          client_id: string;
          required_document_types?: string[];
          payment_rules?: Record<string, unknown>;
          usage_rights?: string | null;
          approval_workflow?: string | null;
          legal_clauses?: unknown[];
          mandatory_deliverables?: string[];
          exclusivity_notes?: string | null;
          confidentiality_notes?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_commercial_requirements"]["Insert"]>;
        Relationships: [];
      };
      brand_commercial_requirements: {
        Row: BrandCommercialRequirementsRow;
        Insert: {
          id?: string;
          brand_id: string;
          client_id: string;
          extra_document_types?: string[];
          extra_legal_clauses?: unknown[];
          extra_deliverables?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brand_commercial_requirements"]["Insert"]>;
        Relationships: [];
      };
      creator_agreement_templates: {
        Row: CreatorAgreementTemplateRow;
        Insert: {
          id?: string;
          influencer_id: string;
          client_id: string;
          brand_id?: string | null;
          terms_text: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_agreement_templates"]["Insert"]>;
        Relationships: [];
      };
      influencer_platform_accounts: {
        Row: InfluencerPlatformAccountRow;
        Insert: {
          id?: string;
          influencer_id: string;
          platform: string;
          handle: string;
          username?: string | null;
          profile_url?: string | null;
          normalized_username?: string | null;
          normalized_profile_url?: string | null;
          profile_display_name?: string | null;
          profile_bio?: string | null;
          profile_picture_url?: string | null;
          avatar_source?: InfluencerPlatformAccountRow["avatar_source"];
          avatar_last_synced_at?: string | null;
          follower_count?: number | null;
          following_count?: number | null;
          engagement_rate?: number | null;
          avg_views?: number | null;
          audience_country?: string | null;
          audience_gender_split?: Record<string, unknown>;
          is_verified?: boolean;
          is_primary?: boolean;
          sync_status?: InfluencerPlatformAccountRow["sync_status"];
          sync_source?: string | null;
          last_synced_at?: string | null;
          sync_error?: string | null;
          metrics_source?: InfluencerPlatformAccountRow["metrics_source"];
          metrics_last_synced_at?: string | null;
          metrics_is_manual_override?: boolean;
          metadata?: Record<string, unknown>;
          posts_count?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          recent_publications?: InfluencerPlatformAccountRow["recent_publications"];
          hashtags?: string[] | null;
          mentions?: string[] | null;
          interest_categories?: string[] | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contact_links?: string[] | null;
          last_enriched_at?: string | null;
          enrichment_status?: CreatorEnrichmentStatus;
          apify_run_id?: string | null;
          profile_data_version?: number;
          field_sources?: Record<string, EnrichmentFieldSource>;
        };
        Update: Partial<
          Database["public"]["Tables"]["influencer_platform_accounts"]["Insert"]
        >;
        Relationships: [];
      };
      creator_enrichment_runs: {
        Row: CreatorEnrichmentRunRow;
        Insert: {
          id?: string;
          influencer_id?: string | null;
          platform_account_id?: string | null;
          discovered_profile_id?: string | null;
          trigger: string;
          priority: number;
          status?: string;
          source?: string | null;
          apify_run_id?: string | null;
          forced?: boolean;
          skipped_reason?: string | null;
          fields_updated?: string[];
          attempt?: number;
          error_message?: string | null;
          job_id?: string | null;
          requested_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["creator_enrichment_runs"]["Insert"]
        >;
        Relationships: [];
      };
      campaign_influencers: {
        Row: {
          id: string;
          campaign_id: string;
          campaign_header_id: string | null;
          campaign_line_id: string | null;
          influencer_id: string;
          status: string;
          agreed_fee: number;
          currency: string;
          deliverable_count: number;
          cost_before_vat: number;
          cost_vat_percent: number;
          cost_vat_amount: number;
          cost_after_vat: number;
          invited_at: string | null;
          confirmed_at: string | null;
          vendor_payment_status: string;
          vendor_paid_at: string | null;
          payment_batch_id: string | null;
          shortlist_assignment_status: CampaignShortlistAssignmentStatus | null;
          source_shortlist_id: string | null;
          source_shortlist_item_id: string | null;
          returned_to_shortlist_at: string | null;
        };
        Insert: {
          campaign_id: string;
          campaign_header_id?: string | null;
          campaign_line_id?: string | null;
          influencer_id: string;
          status?: string;
          agreed_fee?: number;
          currency?: string;
          deliverable_count?: number;
          cost_before_vat?: number;
          cost_vat_percent?: number;
          cost_vat_amount?: number;
          cost_after_vat?: number;
          invited_at?: string | null;
          confirmed_at?: string | null;
          vendor_payment_status?: string;
          vendor_paid_at?: string | null;
          payment_batch_id?: string | null;
          created_by?: string | null;
          shortlist_assignment_status?: CampaignShortlistAssignmentStatus | null;
          source_shortlist_id?: string | null;
          source_shortlist_item_id?: string | null;
          returned_to_shortlist_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_influencers"]["Insert"]
        >;
        Relationships: [];
      };
      client_documents: {
        Row: ClientDocumentRow;
        Insert: {
          id?: string;
          client_id: string;
          document_type: ClientDocumentType;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          expires_at?: string | null;
          notes?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_documents"]["Insert"]
        >;
        Relationships: [];
      };
      influencer_documents: {
        Row: InfluencerDocumentRow;
        Insert: {
          id?: string;
          influencer_id: string;
          document_type: InfluencerDocumentType;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          expires_at?: string | null;
          notes?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["influencer_documents"]["Insert"]
        >;
        Relationships: [];
      };
      discovered_profiles: {
        Row: {
          id: string;
          platform: string;
          username: string;
          profile_url: string;
          display_name: string | null;
          bio: string | null;
          profile_image_url: string | null;
          email_in_bio: string | null;
          country_code: string | null;
          city: string | null;
          language_codes: string[];
          category_tags: string[];
          stage: string;
          refresh_tier: string;
          authenticity_score: number | null;
          thinkway_score: number | null;
          source_confidence: number | null;
          influencer_id: string | null;
          search_vector: string | null;
          metadata: Record<string, unknown>;
          first_discovered_at: string;
          last_enriched_at: string | null;
          next_refresh_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          username: string;
          profile_url: string;
          display_name?: string | null;
          bio?: string | null;
          profile_image_url?: string | null;
          email_in_bio?: string | null;
          country_code?: string | null;
          city?: string | null;
          language_codes?: string[];
          category_tags?: string[];
          stage?: string;
          refresh_tier?: string;
          authenticity_score?: number | null;
          thinkway_score?: number | null;
          source_confidence?: number | null;
          influencer_id?: string | null;
          metadata?: Record<string, unknown>;
          first_discovered_at?: string;
          last_enriched_at?: string | null;
          next_refresh_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["discovered_profiles"]["Insert"]>;
        Relationships: [];
      };
      profile_metrics: {
        Row: {
          id: string;
          profile_id: string;
          followers: number;
          following: number;
          posts_count: number;
          avg_likes: number | null;
          avg_comments: number | null;
          engagement_rate: number | null;
          avg_views: number | null;
          posting_frequency_per_week: number | null;
          reels_views_avg: number | null;
          captured_at: string;
          source: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          profile_id: string;
          followers?: number;
          following?: number;
          posts_count?: number;
          avg_likes?: number | null;
          avg_comments?: number | null;
          engagement_rate?: number | null;
          avg_views?: number | null;
          posting_frequency_per_week?: number | null;
          reels_views_avg?: number | null;
          captured_at?: string;
          source?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["profile_metrics"]["Insert"]>;
        Relationships: [];
      };
      profile_ai_scores: {
        Row: {
          id: string;
          profile_id: string;
          category: string | null;
          niche: string | null;
          audience_type: string | null;
          content_quality_score: number | null;
          luxury_level_score: number | null;
          brand_fit_score: number | null;
          professionalism_score: number | null;
          influencer_summary: string | null;
          audience_persona: string | null;
          content_style: string | null;
          model_version: string;
          scored_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          profile_id: string;
          category?: string | null;
          niche?: string | null;
          audience_type?: string | null;
          content_quality_score?: number | null;
          luxury_level_score?: number | null;
          brand_fit_score?: number | null;
          professionalism_score?: number | null;
          influencer_summary?: string | null;
          audience_persona?: string | null;
          content_style?: string | null;
          model_version?: string;
          scored_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["profile_ai_scores"]["Insert"]>;
        Relationships: [];
      };
      discovery_jobs: {
        Row: {
          id: string;
          job_type: string;
          method: string | null;
          status: string;
          payload: Record<string, unknown>;
          result: Record<string, unknown>;
          profiles_discovered: number;
          profiles_enriched: number;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_type: string;
          method?: string | null;
          status?: string;
          payload?: Record<string, unknown>;
          result?: Record<string, unknown>;
          profiles_discovered?: number;
          profiles_enriched?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["discovery_jobs"]["Insert"]>;
        Relationships: [];
      };
      discovery_search_analytics: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          query: string | null;
          intent_mode: string | null;
          confidence: number | null;
          latency_ms: number | null;
          results_count: number | null;
          creator_unified_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: string;
          query?: string | null;
          intent_mode?: string | null;
          confidence?: number | null;
          latency_ms?: number | null;
          results_count?: number | null;
          creator_unified_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["discovery_search_analytics"]["Insert"]>;
        Relationships: [];
      };
      discovery_shortlists: {
        Row: {
          id: string;
          serial_number: string | null;
          name: string;
          /** URL slug — migration `20260722100000_entity_url_slugs`. */
          slug: string | null;
          description: string | null;
          status: ShortlistStatus;
          visibility: ShortlistVisibilityV2;
          client_id: string | null;
          brand_id: string | null;
          owner_id: string | null;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          submitted_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          is_archived: boolean;
          client_visible: boolean;
          client_shared_at: string | null;
          client_shared_by: string | null;
          campaign_header_id: string | null;
          quotation_id: string | null;
          /** Display / commercial currency — migration `20260723120000_shortlist_display_currency`. */
          currency: string;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          serial_number?: string | null;
          name: string;
          slug?: string | null;
          description?: string | null;
          status?: ShortlistStatus;
          visibility?: ShortlistVisibilityV2;
          client_id?: string | null;
          brand_id?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          submitted_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          is_archived?: boolean;
          client_visible?: boolean;
          client_shared_at?: string | null;
          client_shared_by?: string | null;
          campaign_header_id?: string | null;
          quotation_id?: string | null;
          currency?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["discovery_shortlists"]["Insert"]>;
        Relationships: [];
      };
      creator_movements: {
        Row: {
          id: string;
          creator_id: string | null;
          influencer_id: string | null;
          discovered_profile_id: string | null;
          unified_id: string | null;
          source_type: string;
          source_id: string | null;
          destination_type: string;
          destination_id: string | null;
          action: CreatorMovementAction;
          performed_by: string | null;
          performed_at: string;
          notes: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          creator_id?: string | null;
          influencer_id?: string | null;
          discovered_profile_id?: string | null;
          unified_id?: string | null;
          source_type: string;
          source_id?: string | null;
          destination_type: string;
          destination_id?: string | null;
          action: CreatorMovementAction;
          performed_by?: string | null;
          performed_at?: string;
          notes?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["creator_movements"]["Insert"]>;
        Relationships: [];
      };
      shortlist_notifications: {
        Row: {
          id: string;
          shortlist_id: string;
          recipient_id: string | null;
          event: string;
          title: string;
          body: string | null;
          is_read: boolean;
          created_by: string | null;
          created_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          shortlist_id: string;
          recipient_id?: string | null;
          event: string;
          title: string;
          body?: string | null;
          is_read?: boolean;
          created_by?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["shortlist_notifications"]["Insert"]>;
        Relationships: [];
      };
      discovery_shortlist_items: {
        Row: {
          id: string;
          shortlist_id: string;
          profile_id: string | null;
          influencer_id: string | null;
          unified_id: string | null;
          notes: string | null;
          match_score: number | null;
          sort_order: number;
          added_by: string | null;
          added_at: string;
          commercial_input_mode: CommercialInputMode;
          cost: number | null;
          cost_currency: string | null;
          gp_pct: number | null;
          gp_value: number | null;
          revenue: number | null;
          fx_rate_to_egp: number | null;
          cost_egp: number | null;
          revenue_egp: number | null;
          gp_value_egp: number | null;
          deliverables: Json;
          commercial_updated_at: string | null;
          item_status: ShortlistItemStatus;
          platform_account_ids: string[];
          option_number: number | null;
          service_description: string | null;
          collapse_group_id: string | null;
          collapse_label: string | null;
        };
        Insert: {
          id?: string;
          shortlist_id: string;
          profile_id?: string | null;
          influencer_id?: string | null;
          unified_id?: string | null;
          platform_account_ids?: string[];
          notes?: string | null;
          match_score?: number | null;
          sort_order?: number;
          added_by?: string | null;
          item_status?: ShortlistItemStatus;
          collapse_group_id?: string | null;
          collapse_label?: string | null;
          commercial_input_mode?: CommercialInputMode;
          cost?: number | null;
          cost_currency?: string | null;
          gp_pct?: number | null;
          gp_value?: number | null;
          revenue?: number | null;
          fx_rate_to_egp?: number | null;
          cost_egp?: number | null;
          revenue_egp?: number | null;
          gp_value_egp?: number | null;
          deliverables?: Json;
          commercial_updated_at?: string | null;
          option_number?: number | null;
          service_description?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["discovery_shortlist_items"]["Insert"]
        >;
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          serial_number: string | null;
          name: string;
          status: QuotationStatus;
          shortlist_id: string | null;
          client_id: string | null;
          brand_id: string | null;
          campaign_header_id: string | null;
          owner_id: string | null;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          currency: string;
          total_cost_egp: number;
          total_revenue_egp: number;
          total_gp_value_egp: number;
          total_gp_pct: number;
          total_af_egp: number;
          total_agency_margin_egp: number;
          notes: string | null;
          terms: string | null;
          prepared_by_name: string | null;
          prepared_by_signature: string | null;
          client_signature_name: string | null;
          client_signed_at: string | null;
          issue_date: string;
          validity_date: string | null;
          version: string;
          department: string | null;
          reviewed_by_name: string | null;
          reviewed_by: string | null;
          gp_target_pct: number;
          shared_with_client: boolean;
          change_summary: string | null;
          client_visible: boolean;
          client_shared_at: string | null;
          client_shared_by: string | null;
          client_approval_status: string | null;
          client_comment: string | null;
          is_archived: boolean;
          metadata: Json;
          parent_quotation_id: string | null;
          version_number: number;
          revision_notes: string | null;
          is_temporary_client: boolean;
          is_temporary_brand: boolean;
          temporary_client_name: string | null;
          temporary_brand_name: string | null;
          campaign_object_id: string | null;
          source_campaign_object_version: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          serial_number?: string | null;
          name: string;
          status?: QuotationStatus;
          shortlist_id?: string | null;
          client_id?: string | null;
          brand_id?: string | null;
          campaign_header_id?: string | null;
          campaign_object_id?: string | null;
          source_campaign_object_version?: number | null;
          owner_id?: string | null;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          currency?: string;
          total_cost_egp?: number;
          total_revenue_egp?: number;
          total_gp_value_egp?: number;
          total_gp_pct?: number;
          total_af_egp?: number;
          total_agency_margin_egp?: number;
          notes?: string | null;
          terms?: string | null;
          prepared_by_name?: string | null;
          prepared_by_signature?: string | null;
          client_signature_name?: string | null;
          client_signed_at?: string | null;
          issue_date?: string;
          validity_date?: string | null;
          version?: string;
          department?: string | null;
          reviewed_by_name?: string | null;
          reviewed_by?: string | null;
          gp_target_pct?: number;
          shared_with_client?: boolean;
          change_summary?: string | null;
          client_visible?: boolean;
          client_shared_at?: string | null;
          client_shared_by?: string | null;
          client_approval_status?: string | null;
          client_comment?: string | null;
          is_archived?: boolean;
          metadata?: Json;
          parent_quotation_id?: string | null;
          version_number?: number;
          revision_notes?: string | null;
          is_temporary_client?: boolean;
          is_temporary_brand?: boolean;
          temporary_client_name?: string | null;
          temporary_brand_name?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quotations"]["Insert"]>;
        Relationships: [];
      };
      quotation_version_history: {
        Row: {
          id: string;
          quotation_id: string;
          parent_quotation_id: string | null;
          version_number: number;
          serial_number: string;
          revision_notes: string | null;
          created_by: string | null;
          created_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          parent_quotation_id?: string | null;
          version_number: number;
          serial_number: string;
          revision_notes?: string | null;
          created_by?: string | null;
          metadata?: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["quotation_version_history"]["Insert"]
        >;
        Relationships: [];
      };
      quotation_revisions: {
        Row: {
          id: string;
          quotation_id: string;
          version: string;
          updated_by: string | null;
          updated_by_name: string | null;
          change_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          version: string;
          updated_by?: string | null;
          updated_by_name?: string | null;
          change_summary?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotation_revisions"]["Insert"]>;
        Relationships: [];
      };
      quotation_items: {
        Row: {
          id: string;
          quotation_id: string;
          influencer_id: string | null;
          profile_id: string | null;
          unified_id: string | null;
          source_shortlist_item_id: string | null;
          creator_name: string | null;
          platform: string | null;
          handle: string | null;
          followers: number | null;
          engagement_rate: number | null;
          country_code: string | null;
          deliverables: Json;
          commercial_input_mode: CommercialInputMode;
          cost: number;
          cost_currency: string;
          revenue: number;
          gp_pct: number;
          gp_value: number;
          fx_rate_to_egp: number;
          cost_egp: number;
          revenue_egp: number;
          gp_value_egp: number;
          af_pct: number;
          af_value: number;
          af_value_egp: number;
          sort_order: number;
          option_number: number | null;
          service_description: string | null;
          profile_image_url: string | null;
          profile_url: string | null;
          collapse_group_id: string | null;
          collapse_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          influencer_id?: string | null;
          profile_id?: string | null;
          unified_id?: string | null;
          source_shortlist_item_id?: string | null;
          collapse_group_id?: string | null;
          collapse_label?: string | null;
          creator_name?: string | null;
          platform?: string | null;
          handle?: string | null;
          followers?: number | null;
          engagement_rate?: number | null;
          country_code?: string | null;
          deliverables?: Json;
          commercial_input_mode?: CommercialInputMode;
          cost?: number;
          cost_currency?: string;
          revenue?: number;
          gp_pct?: number;
          gp_value?: number;
          fx_rate_to_egp?: number;
          cost_egp?: number;
          revenue_egp?: number;
          gp_value_egp?: number;
          af_pct?: number;
          af_value?: number;
          af_value_egp?: number;
          sort_order?: number;
          option_number?: number | null;
          service_description?: string | null;
          profile_image_url?: string | null;
          profile_url?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["quotation_items"]["Insert"]
        >;
        Relationships: [];
      };
      discovery_saved_filters: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          scope: string;
          filters: Json;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          scope?: string;
          filters?: Json;
          is_pinned?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["discovery_saved_filters"]["Insert"]
        >;
        Relationships: [];
      };
      discovery_recent_searches: {
        Row: {
          id: string;
          owner_id: string;
          query: string | null;
          filters: Json;
          searched_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          query?: string | null;
          filters?: Json;
          searched_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["discovery_recent_searches"]["Insert"]
        >;
        Relationships: [];
      };
      discovery_campaign_matches: {
        Row: {
          id: string;
          campaign_header_id: string | null;
          brief_text: string;
          profile_id: string;
          match_score: number;
          predicted_performance: Record<string, unknown>;
          rationale: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_header_id?: string | null;
          brief_text: string;
          profile_id: string;
          match_score: number;
          predicted_performance?: Record<string, unknown>;
          rationale?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["discovery_campaign_matches"]["Insert"]
        >;
        Relationships: [];
      };
      creator_import_files: {
        Row: {
          id: string;
          filename: string;
          source_name: string | null;
          file_type: string;
          storage_path: string | null;
          uploaded_by: string | null;
          status: string;
          total_creators: number;
          imported_creators: number;
          updated_creators: number;
          duplicate_creators: number;
          failed_creators: number;
          extracted_text_length: number | null;
          parser_strategy: string | null;
          extraction_method: string | null;
          warning_message: string | null;
          processing_log: Record<string, unknown>;
          metadata: Record<string, unknown>;
          processing_started_at: string | null;
          processing_completed_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          filename: string;
          source_name?: string | null;
          file_type: string;
          storage_path?: string | null;
          uploaded_by?: string | null;
          status?: string;
          total_creators?: number;
          imported_creators?: number;
          updated_creators?: number;
          duplicate_creators?: number;
          failed_creators?: number;
          extracted_text_length?: number | null;
          parser_strategy?: string | null;
          extraction_method?: string | null;
          warning_message?: string | null;
          processing_log?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_import_files"]["Insert"]>;
        Relationships: [];
      };
      creator_sources: {
        Row: {
          id: string;
          influencer_id: string;
          source_name: string;
          source_file_id: string | null;
          imported_at: string;
        };
        Insert: {
          id?: string;
          influencer_id: string;
          source_name: string;
          source_file_id?: string | null;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creator_sources"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      resolve_effective_exchange_rate: {
        Args: {
          p_from_currency: string;
          p_to_currency: string;
          p_as_of?: string;
        };
        Returns: number;
      };
      sync_campaign_header_po_consumption: {
        Args: { p_header_id: string };
        Returns: undefined;
      };
      list_public_table_columns: {
        Args: { p_table: string };
        Returns: { column_name: string }[];
      };
      get_discovery_database_stats: {
        Args: {
          category_limit?: number;
        };
        Returns: {
          total_creators: number;
          categorized_creators: number;
          category_label: string;
          category_count: number;
        }[];
      };
      get_discovery_search_taxonomy: {
        Args: Record<string, never>;
        Returns: {
          term: string;
        }[];
      };
      browse_influencer_ids_by_recency: {
        Args: {
          p_country?: string | null;
          p_language?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          total_count: number;
        }[];
      };
      browse_influencer_ids_for_categories: {
        Args: {
          p_categories?: string[];
          p_country?: string | null;
          p_language?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          total_count: number;
        }[];
      };
      vendor_list_total_count: {
        Args: {
          p_search?: string | null;
          p_status?: string | null;
          p_platform?: string | null;
        };
        Returns: number;
      };
    };
    Enums: {
      client_status: ClientStatus;
      campaign_status: CampaignStatus;
      campaign_object_lifecycle_status: CampaignObjectLifecycleStatus;
      influencer_status: InfluencerStatus;
      po_status: PoStatus;
      assignment_pricing_mode: AssignmentPricingMode;
      business_function: BusinessFunction;
    };
  };
  intelligence: {
    Tables: {
      historical_campaigns_raw: {
        Row: import("@/types/intelligence").HistoricalCampaignsRawRow;
        Insert: Partial<import("@/types/intelligence").HistoricalCampaignsRawRow>;
        Update: Partial<import("@/types/intelligence").HistoricalCampaignsRawRow>;
        Relationships: [];
      };
      historical_influencers_raw: {
        Row: import("@/types/intelligence").HistoricalInfluencersRawRow;
        Insert: Partial<import("@/types/intelligence").HistoricalInfluencersRawRow>;
        Update: Partial<import("@/types/intelligence").HistoricalInfluencersRawRow>;
        Relationships: [];
      };
      int_clients: {
        Row: import("@/types/intelligence").IntClientRow;
        Insert: Partial<import("@/types/intelligence").IntClientRow>;
        Update: Partial<import("@/types/intelligence").IntClientRow>;
        Relationships: [];
      };
      int_brands: {
        Row: import("@/types/intelligence").IntBrandRow;
        Insert: Partial<import("@/types/intelligence").IntBrandRow>;
        Update: Partial<import("@/types/intelligence").IntBrandRow>;
        Relationships: [];
      };
      int_influencers: {
        Row: import("@/types/intelligence").IntInfluencerRow;
        Insert: Partial<import("@/types/intelligence").IntInfluencerRow>;
        Update: Partial<import("@/types/intelligence").IntInfluencerRow>;
        Relationships: [];
      };
      int_campaigns: {
        Row: import("@/types/intelligence").IntCampaignRow;
        Insert: Partial<import("@/types/intelligence").IntCampaignRow>;
        Update: Partial<import("@/types/intelligence").IntCampaignRow>;
        Relationships: [];
      };
      int_pricing_history: {
        Row: import("@/types/intelligence").IntPricingHistoryRow;
        Insert: Partial<import("@/types/intelligence").IntPricingHistoryRow>;
        Update: Partial<import("@/types/intelligence").IntPricingHistoryRow>;
        Relationships: [];
      };
      int_margin_history: {
        Row: import("@/types/intelligence").IntMarginHistoryRow;
        Insert: Partial<import("@/types/intelligence").IntMarginHistoryRow>;
        Update: Partial<import("@/types/intelligence").IntMarginHistoryRow>;
        Relationships: [];
      };
      int_benchmarks: {
        Row: import("@/types/intelligence").IntBenchmarkRow;
        Insert: Partial<import("@/types/intelligence").IntBenchmarkRow>;
        Update: Partial<import("@/types/intelligence").IntBenchmarkRow>;
        Relationships: [];
      };
      entity_resolution_overrides: {
        Row: {
          id: string;
          entity_type: string;
          source_key: string;
          resolved_id: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          entity_type: string;
          source_key: string;
          resolved_id: string;
          notes: string | null;
          created_by: string | null;
        }>;
        Update: Partial<{
          entity_type: string;
          source_key: string;
          resolved_id: string;
          notes: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_workspace_counts: {
        Args: Record<string, never>;
        Returns: {
          campaigns: number;
          influencers: number;
          benchmarks: number;
        }[];
      };
      get_campaign_financial_totals: {
        Args: Record<string, never>;
        Returns: {
          total_revenue_usd: number;
          total_cost_usd: number;
          total_gp_usd: number;
        }[];
      };
      get_margin_median: {
        Args: Record<string, never>;
        Returns: {
          median_margin_pct: number | null;
        }[];
      };
      get_top_influencers: {
        Args: {
          row_limit?: number;
        };
        Returns: {
          id: string;
          display_name_raw: string;
          username: string | null;
          platform: string | null;
          country: string | null;
          tier: string | null;
          line_count: number;
          total_cost_usd: number;
          median_cost_usd: number;
          median_margin_pct: number | null;
          match_confidence: number;
        }[];
      };
      get_low_margin_line_count: {
        Args: Record<string, never>;
        Returns: {
          low_margin_line_count: number;
        }[];
      };
      get_margin_alerts: {
        Args: {
          row_limit?: number;
        };
        Returns: {
          id: string;
          source_line_id: string;
          margin_pct: number | null;
          revenue_usd: number | null;
          cost_usd: number | null;
          market_entity: string | null;
          channel: string | null;
          period_year: number | null;
          campaign_name: string | null;
          brand_name_raw: string | null;
          influencer_name_raw: string | null;
          client_type_report: string | null;
        }[];
      };
      search_influencers_fts: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: {
          influencer_id: string;
          rank: number;
        }[];
      };
      search_discovered_profiles_fts: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: {
          profile_id: string;
          rank: number;
        }[];
      };
      search_creators: {
        Args: {
          p_query: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          source_type: string;
          creator_id: string;
          rank: number;
          has_more: boolean;
        }[];
      };
      search_creators_count: {
        Args: {
          p_query: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
};
