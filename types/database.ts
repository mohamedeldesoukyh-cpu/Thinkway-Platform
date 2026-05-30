/**
 * Supabase database type definitions — manually maintained to match supabase/schema.sql.
 * Once a live Supabase project is connected, replace with:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Enum mirrors (exported for use in repository layer) ─────────────────────
export type UserRoleDb          = 'admin' | 'director' | 'manager' | 'account_manager' | 'finance' | 'data_entry'
export type UserStatusDb        = 'active' | 'inactive' | 'suspended' | 'pending_invitation'
export type CampaignStatusDb    = 'draft' | 'planning' | 'active' | 'paused' | 'completed' | 'cancelled'
export type CampaignTypeDb      = 'fixed' | 'hard_roi' | 'performance'
export type CiStatusDb          = 'invited' | 'confirmed' | 'active' | 'completed' | 'declined' | 'removed'
export type ClientStatusDb      = 'active' | 'inactive' | 'prospect' | 'churned' | 'on_hold'
export type ClientTierDb        = 'standard' | 'premium' | 'enterprise' | 'strategic'
export type VendorStatusDb      = 'active' | 'inactive' | 'pending_onboarding' | 'blacklisted' | 'under_review'
export type InfluencerTierDb    = 'nano' | 'micro' | 'mid' | 'macro' | 'mega'
export type PlatformTypeDb      = 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'linkedin' | 'snapchat' | 'pinterest' | 'threads'
export type CurrencyTypeDb      = 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR' | 'QAR' | 'KWD'
export type DeliverableTypeDb   = 'instagram_post' | 'instagram_story' | 'instagram_reel' | 'instagram_carousel' | 'tiktok_video' | 'youtube_video' | 'youtube_short' | 'twitter_post' | 'facebook_post' | 'facebook_reel' | 'linkedin_post' | 'blog_post' | 'podcast_mention' | 'live_stream' | 'other'
export type DeliverableStatusDb = 'not_started' | 'in_progress' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'scheduled' | 'published' | 'live' | 'rejected' | 'cancelled'
export type RevisionStatusDb    = 'pending' | 'approved' | 'rejected' | 'revision_requested'
export type InvoiceStatusDb     = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'void'
export type PaymentStatusDb     = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
export type ApprovalStatusDb    = 'pending' | 'in_review' | 'approved' | 'rejected' | 'revision_requested' | 'expired'
export type ApprovalPriorityDb  = 'low' | 'medium' | 'high' | 'urgent'
export type LegalEntityDb       = 'uae' | 'ksa' | 'kwt'
export type PaymentMethodDb     = 'bank_transfer' | 'paypal' | 'stripe' | 'wise' | 'other'

// ─── Database ─────────────────────────────────────────────────────────────────
export type Database = {
  public: {
    Tables: {

      profiles: {
        Row: {
          id:               string
          email:            string
          full_name:        string
          first_name:       string | null
          last_name:        string | null
          avatar_url:       string | null
          role:             UserRoleDb
          team:             string | null
          reports_to_id:    string | null
          status:           UserStatusDb
          organization_id:  string | null
          created_at:       string
          updated_at:       string
        }
        Insert: {
          id:               string
          email:            string
          full_name?:       string
          first_name?:      string | null
          last_name?:       string | null
          avatar_url?:      string | null
          role?:            UserRoleDb
          team?:            string | null
          reports_to_id?:   string | null
          status?:          UserStatusDb
          organization_id?: string | null
          created_at?:      string
          updated_at?:      string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }

      clients: {
        Row: {
          id:                  string
          client_code:         string | null
          name:                string
          trading_name:        string | null
          logo_url:            string | null
          industry:            string
          website:             string | null
          description:         string | null
          tier:                ClientTierDb
          status:              ClientStatusDb
          parent_group:        string | null
          tax_id:              string | null
          currency:            CurrencyTypeDb
          payment_terms_days:  number
          account_manager_id:  string | null
          notes:               string | null
          tags:                string[]
          address:             Json | null
          onboarded_at:        string | null
          deleted_at:          string | null
          created_at:          string
          updated_at:          string
          created_by:          string | null
          updated_by:          string | null
        }
        Insert: {
          id?:                 string
          client_code?:        string | null
          name:                string
          trading_name?:       string | null
          logo_url?:           string | null
          industry:            string
          website?:            string | null
          description?:        string | null
          tier?:               ClientTierDb
          status?:             ClientStatusDb
          parent_group?:       string | null
          tax_id?:             string | null
          currency?:           CurrencyTypeDb
          payment_terms_days?: number
          account_manager_id?: string | null
          notes?:              string | null
          tags?:               string[]
          address?:            Json | null
          onboarded_at?:       string | null
          deleted_at?:         string | null
          created_at?:         string
          updated_at?:         string
          created_by?:         string | null
          updated_by?:         string | null
        }
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
        Relationships: []
      }

      client_contacts: {
        Row: {
          id:           string
          client_id:    string
          name:         string
          email:        string
          phone:        string | null
          role:         string | null
          is_primary:   boolean
          linkedin_url: string | null
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id?:          string
          client_id:    string
          name:         string
          email:        string
          phone?:       string | null
          role?:        string | null
          is_primary?:  boolean
          linkedin_url?: string | null
          created_at?:  string
          updated_at?:  string
        }
        Update: Partial<Database['public']['Tables']['client_contacts']['Insert']>
        Relationships: []
      }

      vendors: {
        Row: {
          id:                       string
          vendor_code:              string | null
          first_name:               string
          last_name:                string
          display_name:             string | null
          email:                    string
          phone:                    string | null
          avatar_url:               string | null
          bio:                      string | null
          location:                 string
          country:                  string
          nationality:              string | null
          primary_language:         string
          languages:                string[]
          niche:                    string[]
          content_categories:       string[]
          tier:                     InfluencerTierDb
          status:                   VendorStatusDb
          total_followers:          number
          primary_platform:         PlatformTypeDb
          average_engagement_rate:  number
          default_rate:             number
          default_currency:         CurrencyTypeDb
          tax_id:                   string | null
          payment_details:          Json | null
          notes:                    string | null
          tags:                     string[]
          agent_name:               string | null
          agent_email:              string | null
          contract_signed_at:       string | null
          onboarded_at:             string | null
          last_campaign_at:         string | null
          total_campaigns:          number
          active_manager_id:        string | null
          deleted_at:               string | null
          created_at:               string
          updated_at:               string
          created_by:               string | null
          updated_by:               string | null
        }
        Insert: {
          id?:                      string
          vendor_code?:             string | null
          first_name:               string
          last_name:                string
          display_name?:            string | null
          email:                    string
          phone?:                   string | null
          avatar_url?:              string | null
          bio?:                     string | null
          location?:                string
          country?:                 string
          nationality?:             string | null
          primary_language?:        string
          languages?:               string[]
          niche?:                   string[]
          content_categories?:      string[]
          tier?:                    InfluencerTierDb
          status?:                  VendorStatusDb
          total_followers?:         number
          primary_platform?:        PlatformTypeDb
          average_engagement_rate?: number
          default_rate?:            number
          default_currency?:        CurrencyTypeDb
          tax_id?:                  string | null
          payment_details?:         Json | null
          notes?:                   string | null
          tags?:                    string[]
          agent_name?:              string | null
          agent_email?:             string | null
          contract_signed_at?:      string | null
          onboarded_at?:            string | null
          last_campaign_at?:        string | null
          total_campaigns?:         number
          active_manager_id?:       string | null
          deleted_at?:              string | null
          created_at?:              string
          updated_at?:              string
          created_by?:              string | null
          updated_by?:              string | null
        }
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
        Relationships: []
      }

      vendor_social_profiles: {
        Row: {
          id:              string
          vendor_id:       string
          platform:        PlatformTypeDb
          handle:          string
          profile_url:     string | null
          followers:       number
          following:       number | null
          avg_likes:       number | null
          avg_comments:    number | null
          engagement_rate: number
          is_verified:     boolean
          last_synced_at:  string | null
          created_at:      string
          updated_at:      string
        }
        Insert: {
          id?:             string
          vendor_id:       string
          platform:        PlatformTypeDb
          handle:          string
          profile_url?:    string | null
          followers?:      number
          following?:      number | null
          avg_likes?:      number | null
          avg_comments?:   number | null
          engagement_rate?: number
          is_verified?:    boolean
          last_synced_at?: string | null
          created_at?:     string
          updated_at?:     string
        }
        Update: Partial<Database['public']['Tables']['vendor_social_profiles']['Insert']>
        Relationships: []
      }

      campaigns: {
        Row: {
          id:                  string
          campaign_number:     string | null
          name:                string
          description:         string | null
          client_id:           string
          campaign_type:       CampaignTypeDb
          status:              CampaignStatusDb
          lifecycle_stage:     number
          start_date:          string
          end_date:            string
          budget_amount:       number
          budget_currency:     CurrencyTypeDb
          spent_amount:        number
          target_reach:        number | null
          target_impressions:  number | null
          target_engagements:  number | null
          target_clicks:       number | null
          target_conversions:  number | null
          brief_url:           string | null
          hashtags:            string[]
          mentions:            string[]
          goals:               string | null
          manager_id:          string | null
          team:                string | null
          tags:                string[]
          deleted_at:          string | null
          created_at:          string
          updated_at:          string
          created_by:          string | null
          updated_by:          string | null
        }
        Insert: {
          id?:                 string
          campaign_number?:    string | null
          name:                string
          description?:        string | null
          client_id:           string
          campaign_type?:      CampaignTypeDb
          status?:             CampaignStatusDb
          lifecycle_stage?:    number
          start_date:          string
          end_date:            string
          budget_amount?:      number
          budget_currency?:    CurrencyTypeDb
          spent_amount?:       number
          target_reach?:       number | null
          target_impressions?: number | null
          target_engagements?: number | null
          target_clicks?:      number | null
          target_conversions?: number | null
          brief_url?:          string | null
          hashtags?:           string[]
          mentions?:           string[]
          goals?:              string | null
          manager_id?:         string | null
          team?:               string | null
          tags?:               string[]
          deleted_at?:         string | null
          created_at?:         string
          updated_at?:         string
          created_by?:         string | null
          updated_by?:         string | null
        }
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
        Relationships: []
      }

      campaign_influencers: {
        Row: {
          id:           string
          campaign_id:  string
          vendor_id:    string
          status:       CiStatusDb
          agreed_rate:  number
          currency:     CurrencyTypeDb
          confirmed_at: string | null
          manager_id:   string | null
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id?:          string
          campaign_id:  string
          vendor_id:    string
          status?:      CiStatusDb
          agreed_rate?: number
          currency?:    CurrencyTypeDb
          confirmed_at?: string | null
          manager_id?:  string | null
          created_at?:  string
          updated_at?:  string
        }
        Update: Partial<Database['public']['Tables']['campaign_influencers']['Insert']>
        Relationships: []
      }

      deliverables: {
        Row: {
          id:                       string
          campaign_id:              string
          campaign_influencer_id:   string | null
          type:                     DeliverableTypeDb
          platform:                 PlatformTypeDb
          status:                   DeliverableStatusDb
          due_date:                 string
          submitted_at:             string | null
          approved_at:              string | null
          scheduled_at:             string | null
          published_at:             string | null
          published_url:            string | null
          content_url:              string | null
          description:              string | null
          caption:                  string | null
          hashtags:                 string[]
          mentions:                 string[]
          requirements:             string | null
          metrics:                  Json | null
          current_revision:         number
          is_usage_rights_granted:  boolean
          usage_rights_expiry:      string | null
          notes:                    string | null
          assigned_reviewer_id:     string | null
          deleted_at:               string | null
          created_at:               string
          updated_at:               string
          created_by:               string | null
          updated_by:               string | null
        }
        Insert: {
          id?:                       string
          campaign_id:               string
          campaign_influencer_id?:   string | null
          type:                      DeliverableTypeDb
          platform:                  PlatformTypeDb
          status?:                   DeliverableStatusDb
          due_date:                  string
          submitted_at?:             string | null
          approved_at?:              string | null
          scheduled_at?:             string | null
          published_at?:             string | null
          published_url?:            string | null
          content_url?:              string | null
          description?:              string | null
          caption?:                  string | null
          hashtags?:                 string[]
          mentions?:                 string[]
          requirements?:             string | null
          metrics?:                  Json | null
          current_revision?:         number
          is_usage_rights_granted?:  boolean
          usage_rights_expiry?:      string | null
          notes?:                    string | null
          assigned_reviewer_id?:     string | null
          deleted_at?:               string | null
          created_at?:               string
          updated_at?:               string
          created_by?:               string | null
          updated_by?:               string | null
        }
        Update: Partial<Database['public']['Tables']['deliverables']['Insert']>
        Relationships: []
      }

      deliverable_revisions: {
        Row: {
          id:             string
          deliverable_id: string
          round:          number
          submitted_at:   string
          content_url:    string | null
          notes:          string | null
          reviewer_id:    string | null
          feedback:       string | null
          reviewed_at:    string | null
          status:         RevisionStatusDb
          created_at:     string
        }
        Insert: {
          id?:            string
          deliverable_id: string
          round:          number
          submitted_at?:  string
          content_url?:   string | null
          notes?:         string | null
          reviewer_id?:   string | null
          feedback?:      string | null
          reviewed_at?:   string | null
          status?:        RevisionStatusDb
          created_at?:    string
        }
        Update: Partial<Database['public']['Tables']['deliverable_revisions']['Insert']>
        Relationships: []
      }

      invoices: {
        Row: {
          id:              string
          invoice_number:  string | null
          client_id:       string
          campaign_id:     string | null
          status:          InvoiceStatusDb
          issue_date:      string
          due_date:        string
          currency:        CurrencyTypeDb
          subtotal:        number
          tax_rate:        number
          tax_amount:      number
          total_amount:    number
          paid_amount:     number
          notes:           string | null
          terms:           string | null
          po_number:       string | null
          legal_entity:    LegalEntityDb | null
          sent_at:         string | null
          viewed_at:       string | null
          paid_at:         string | null
          voided_at:       string | null
          void_reason:     string | null
          deleted_at:      string | null
          created_at:      string
          updated_at:      string
          created_by:      string | null
          updated_by:      string | null
        }
        Insert: {
          id?:             string
          invoice_number?: string | null
          client_id:       string
          campaign_id?:    string | null
          status?:         InvoiceStatusDb
          issue_date?:     string
          due_date:        string
          currency?:       CurrencyTypeDb
          subtotal?:       number
          tax_rate?:       number
          tax_amount?:     number
          total_amount?:   number
          paid_amount?:    number
          notes?:          string | null
          terms?:          string | null
          po_number?:      string | null
          legal_entity?:   LegalEntityDb | null
          sent_at?:        string | null
          viewed_at?:      string | null
          paid_at?:        string | null
          voided_at?:      string | null
          void_reason?:    string | null
          deleted_at?:     string | null
          created_at?:     string
          updated_at?:     string
          created_by?:     string | null
          updated_by?:     string | null
        }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
        Relationships: []
      }

      invoice_line_items: {
        Row: {
          id:             string
          invoice_id:     string
          description:    string
          campaign_id:    string | null
          vendor_id:      string | null
          deliverable_id: string | null
          quantity:       number
          unit_price:     number
          discount_pct:   number
          amount:         number
          sort_order:     number
          created_at:     string
          updated_at:     string
        }
        Insert: {
          id?:            string
          invoice_id:     string
          description:    string
          campaign_id?:   string | null
          vendor_id?:     string | null
          deliverable_id?: string | null
          quantity?:      number
          unit_price?:    number
          discount_pct?:  number
          amount?:        number
          sort_order?:    number
          created_at?:    string
          updated_at?:    string
        }
        Update: Partial<Database['public']['Tables']['invoice_line_items']['Insert']>
        Relationships: []
      }

      payments: {
        Row: {
          id:             string
          payment_number: string | null
          vendor_id:      string
          campaign_id:    string | null
          deliverable_id: string | null
          status:         PaymentStatusDb
          amount:         number
          currency:       CurrencyTypeDb
          payment_method: PaymentMethodDb
          reference:      string | null
          notes:          string | null
          due_date:       string | null
          paid_at:        string | null
          deleted_at:     string | null
          created_at:     string
          updated_at:     string
          created_by:     string | null
          updated_by:     string | null
        }
        Insert: {
          id?:             string
          payment_number?: string | null
          vendor_id:       string
          campaign_id?:    string | null
          deliverable_id?: string | null
          status?:         PaymentStatusDb
          amount:          number
          currency?:       CurrencyTypeDb
          payment_method?: PaymentMethodDb
          reference?:      string | null
          notes?:          string | null
          due_date?:       string | null
          paid_at?:        string | null
          deleted_at?:     string | null
          created_at?:     string
          updated_at?:     string
          created_by?:     string | null
          updated_by?:     string | null
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
        Relationships: []
      }

      approvals: {
        Row: {
          id:                       string
          deliverable_id:           string
          revision_round:           number
          status:                   ApprovalStatusDb
          priority:                 ApprovalPriorityDb
          deadline:                 string | null
          assigned_reviewer_id:     string | null
          submitted_at:             string
          reviewed_at:              string | null
          reviewer_id:              string | null
          content_url:              string | null
          caption:                  string | null
          internal_notes:           string | null
          requires_client_approval: boolean
          client_approved_at:       string | null
          client_reviewer_id:       string | null
          created_at:               string
          updated_at:               string
          created_by:               string | null
          updated_by:               string | null
        }
        Insert: {
          id?:                       string
          deliverable_id:            string
          revision_round?:           number
          status?:                   ApprovalStatusDb
          priority?:                 ApprovalPriorityDb
          deadline?:                 string | null
          assigned_reviewer_id?:     string | null
          submitted_at?:             string
          reviewed_at?:              string | null
          reviewer_id?:              string | null
          content_url?:              string | null
          caption?:                  string | null
          internal_notes?:           string | null
          requires_client_approval?: boolean
          client_approved_at?:       string | null
          client_reviewer_id?:       string | null
          created_at?:               string
          updated_at?:               string
          created_by?:               string | null
          updated_by?:               string | null
        }
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>
        Relationships: []
      }

      approval_comments: {
        Row: {
          id:          string
          approval_id: string
          author_id:   string
          content:     string
          is_internal: boolean
          attachments: string[]
          is_edited:   boolean
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id?:          string
          approval_id:  string
          author_id:    string
          content:      string
          is_internal?: boolean
          attachments?: string[]
          is_edited?:   boolean
          created_at?:  string
          updated_at?:  string
        }
        Update: Partial<Database['public']['Tables']['approval_comments']['Insert']>
        Relationships: []
      }

      audit_logs: {
        Row: {
          id:             string
          actor_id:       string | null
          actor_email:    string
          actor_role:     string
          action:         string
          resource_type:  string
          resource_id:    string | null
          resource_name:  string | null
          changes:        Json | null
          ip_address:     string | null
          user_agent:     string | null
          created_at:     string
        }
        Insert: {
          id?:            string
          actor_id?:      string | null
          actor_email:    string
          actor_role:     string
          action:         string
          resource_type:  string
          resource_id?:   string | null
          resource_name?: string | null
          changes?:       Json | null
          ip_address?:    string | null
          user_agent?:    string | null
          created_at?:    string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
        Relationships: []
      }

      sequences: {
        Row:    { key: string; last_value: number }
        Insert: { key: string; last_value?: number }
        Update: Partial<{ key: string; last_value: number }>
        Relationships: []
      }

    }
    Views: Record<string, never>
    Functions: {
      get_my_role:            { Args: Record<string, never>; Returns: string }
      next_sequence_value:    { Args: { seq_key: string }; Returns: number }
    }
    Enums: Record<string, never>
  }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
