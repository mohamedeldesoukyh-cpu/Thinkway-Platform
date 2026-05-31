export type ClientStatus = "prospect" | "active" | "inactive" | "archived";

export type CampaignStatus =
  | "draft"
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

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

export type CampaignListItem = CampaignRow & {
  client: { id: string; name: string; document_number: string } | null;
  account_manager: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
};

export type InfluencerStatus = "prospect" | "active" | "inactive" | "blacklisted";

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
  profile_url: string | null;
  follower_count: number;
  engagement_rate: number | null;
  is_verified: boolean;
  is_primary: boolean;
  metadata: Record<string, unknown>;
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
};

export type ClientRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  status: ClientStatus;
  billing_email: string | null;
  billing_phone: string | null;
  billing_address: Record<string, unknown>;
  tax_id: string | null;
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
          currency?: string;
          account_manager_id?: string | null;
          notes?: string | null;
          metadata?: Record<string, unknown>;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: CampaignRow;
        Insert: {
          id?: string;
          document_number?: string;
          client_id: string;
          name: string;
          description?: string | null;
          brief?: string | null;
          status?: CampaignStatus;
          budget?: number;
          spent?: number;
          currency?: string;
          start_date?: string | null;
          end_date?: string | null;
          account_manager_id?: string | null;
          objectives?: unknown[];
          metadata?: Record<string, unknown>;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
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
          categories?: string[];
          rate_card?: Record<string, unknown>;
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
          follower_count?: number;
          is_primary?: boolean;
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
          influencer_id: string;
          status: string;
          agreed_fee: number;
          currency: string;
          invited_at: string | null;
          confirmed_at: string | null;
        };
        Insert: {
          campaign_id: string;
          influencer_id: string;
          status?: string;
          agreed_fee?: number;
          currency?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_influencers"]["Insert"]
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
