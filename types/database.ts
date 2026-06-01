export type ClientStatus = "prospect" | "active" | "inactive" | "archived";

export type CampaignStatus =
  | "draft"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type InfluencerStatus = "prospect" | "active" | "inactive" | "blacklisted";

export type AgencyOrDirect = "agency" | "direct" | "hybrid";

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
  currency_code: string;
  base_currency: string;
  fx_rate: number;
  revenue_base: number;
  cost_base: number;
  profit_base: number;
  start_date: string | null;
  end_date: string | null;
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
  | "rate_card";

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
  follower_count: number;
  engagement_rate: number | null;
  avg_views: number;
  audience_country: string | null;
  audience_gender_split: Record<string, unknown>;
  is_verified: boolean;
  is_primary: boolean;
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
};

export type ClientRow = {
  id: string;
  document_number: string;
  group_id: string | null;
  name: string;
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
  client_category: string | null;
  client_subcategory: string | null;
  agency_or_direct: string | null;
  trade_license_expiry: string | null;
  currency: string;
  account_manager_id: string | null;
  notes: string | null;
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
          client_category?: string | null;
          client_subcategory?: string | null;
          agency_or_direct?: string | null;
          trade_license_expiry?: string | null;
          currency?: string;
          account_manager_id?: string | null;
          notes?: string | null;
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
          po_amount?: number;
          po_consumed?: number;
          billing_status?: string;
          assignment_status?: string;
          revenue_locked?: boolean;
          cost_locked?: boolean;
          vendor_assignment_locked?: boolean;
          invoice_id?: string | null;
          finance_override_until?: string | null;
          billing_moved_at?: string | null;
          billing_invoiced_at?: string | null;
          currency_code?: string;
          base_currency?: string;
          fx_rate?: number;
          start_date?: string | null;
          end_date?: string | null;
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
        Row: { code: string; name: string; symbol: string | null; is_active: boolean };
        Insert: { code: string; name: string };
        Update: Partial<{ name: string; symbol: string | null; is_active: boolean }>;
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
          notes?: string | null;
          created_by?: string | null;
          regeneration_status?: string;
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
          sort_order: number;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
        Insert: {
          invoice_id: string;
          campaign_line_id?: string | null;
          campaign_header_id?: string | null;
          campaign_id?: string | null;
          sort_order?: number;
          description: string;
          quantity?: number;
          unit_price: number;
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
          new_data?: Record<string, unknown> | null;
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
          follower_count?: number;
          engagement_rate?: number | null;
          avg_views?: number;
          audience_country?: string | null;
          audience_gender_split?: Record<string, unknown>;
          is_verified?: boolean;
          is_primary?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      client_status: ClientStatus;
      campaign_status: CampaignStatus;
      influencer_status: InfluencerStatus;
    };
  };
};
