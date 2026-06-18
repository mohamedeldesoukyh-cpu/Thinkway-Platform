export type ClientStatus = "prospect" | "active" | "inactive" | "archived";

export type CampaignStatus =
  | "draft"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type InfluencerStatus = "prospect" | "active" | "inactive" | "blacklisted" | "archived";

export type AgencyOrDirect = "agency" | "direct" | "hybrid";

export type BusinessFunction = "ops" | "sales";

export type GroupDocumentType =
  | "nda"
  | "agreement"
  | "tax_document"
  | "group_contract";

export type GroupRow = {
  id: string;
  document_number: string;
  name: string;
  name_normalized: string;
  region: string | null;
  account_director_id: string | null;
  status: ClientStatus;
  notes: string | null;
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
  group_id: string;
  name: string;
  name_normalized: string;
  status: ClientStatus;
  category_id: string | null;
  subcategory_id: string | null;
  vr_rate_id: string | null;
  currency_code: string;
  country_code: string | null;
  notes: string | null;
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
  name: string;
  description: string | null;
  brief: string | null;
  status: CampaignStatus;
  group_id: string;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  profile_id: string | null;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  status: InfluencerStatus;
  country_code: string | null;
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
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
    "id" | "platform" | "handle" | "follower_count" | "is_primary"
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
};

export type ClientRow = {
  id: string;
  document_number: string;
  group_id: string | null;
  name: string;
  name_ar: string | null;
  name_normalized: string;
  legal_name: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  status: ClientStatus;
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
  vr_rate_id: string | null;
  agency_or_direct: string | null;
  trade_license_expiry: string | null;
  currency: string;
  account_manager_id: string | null;
  notes: string | null;
  client_io_terms_text: string | null;
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
          vr_rate_id?: string | null;
          agency_or_direct?: string | null;
          trade_license_expiry?: string | null;
          currency?: string;
          account_manager_id?: string | null;
          notes?: string | null;
          client_io_terms_text?: string | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
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
          brand_id: string;
          group_id?: string;
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
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_headers"]["Insert"]
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
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_lines"]["Insert"]
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
          notes: string | null;
          detected_by: string | null;
          auto_detected: boolean;
          detection_source: string | null;
          external_media_id: string | null;
          matched_hashtag: string | null;
          api_sync_status: string | null;
          last_synced_at: string | null;
          engagement_views: number | null;
          engagement_likes: number | null;
          engagement_comments: number | null;
          engagement_shares: number | null;
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
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_publications"]["Insert"]
        >;
        Relationships: [];
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
          new_data: Record<string, unknown> | null;
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
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["influencers"]["Insert"]>;
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
        };
        Update: Partial<
          Database["public"]["Tables"]["influencer_platform_accounts"]["Insert"]
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
      discovery_shortlists: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          campaign_header_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          campaign_header_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["discovery_shortlists"]["Insert"]>;
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
        };
        Insert: {
          id?: string;
          shortlist_id: string;
          profile_id?: string | null;
          influencer_id?: string | null;
          unified_id?: string | null;
          notes?: string | null;
          match_score?: number | null;
          sort_order?: number;
          added_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["discovery_shortlist_items"]["Insert"]
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
    };
    Enums: {
      client_status: ClientStatus;
      campaign_status: CampaignStatus;
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
    };
    Enums: Record<string, never>;
  };
};
