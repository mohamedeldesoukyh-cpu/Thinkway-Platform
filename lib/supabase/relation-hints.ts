/**
 * Explicit PostgREST relationship hints for tables with multiple FKs to the same target.
 * Use in `.select()` embeds: `campaign:${REL.campaignInfluencers.campaignHeader}(...)`
 */
export const REL = {
  campaignInfluencers: {
    campaignHeader:
      "campaign_headers!campaign_influencers_campaign_header_id_fkey",
    campaignLine: "campaign_lines!campaign_influencers_campaign_line_id_fkey",
  },
  campaignLines: {
    campaignHeader: "campaign_headers!campaign_lines_campaign_header_id_fkey",
  },
  invoices: {
    campaignHeader: "campaign_headers!invoices_campaign_header_id_fkey",
  },
  invoiceLineItems: {
    campaignLine: "campaign_lines!invoice_line_items_campaign_line_id_fkey",
  },
  campaignIntelligenceProfiles: {
    campaignHeader:
      "campaign_headers!campaign_intelligence_profiles_campaign_header_id_fkey",
  },
} as const;
