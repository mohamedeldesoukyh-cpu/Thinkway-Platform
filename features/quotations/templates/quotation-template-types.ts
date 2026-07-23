export type QuotationTemplatePricingMode = "itemized" | "lump_sum" | "none";

export type QuotationTemplateFlags = {
  showcaseCreators: boolean;
  pitchCreators: boolean;
  showCommercialSummary: boolean;
  pricing: QuotationTemplatePricingMode;
  itemizedPricing: boolean;
  showFees: boolean;
  includeTerms: boolean;
  includeAcceptance: boolean;
};

export type QuotationTemplatePayload = {
  flags: QuotationTemplateFlags;
  quotation: {
    number: string;
    title: string;
    client: string;
    brand: string;
    preparedBy: string;
    issueDate: string;
    validUntil: string;
    version: string;
    status: string;
  };
  cover: {
    kicker: string;
    subtitle: string;
    stat3: { label: string; value: string; valueShort: string };
  };
  campaign: {
    creatorCount: string;
    tierSummary: string;
    estEngagement: string;
  };
  categories: Array<{
    name: string;
    count: string;
    countLabel: string;
    share: string;
  }>;
  tiers: Array<{
    name: string;
    slug: string;
    profileCount: string;
    followers: string;
    avgER: string;
    creators: Array<{
      handle: string;
      platform: string;
      followers: string;
      category: string;
      er: string;
    }>;
  }>;
  totals: {
    creatorCount: string;
    followers: string;
    avgER: string;
  };
  insight: {
    categoryMix: string;
    tierMix: string;
    scale: string;
  };
  commercial: {
    sectionNo: string;
    headlineLabel: string;
    headlineValue: string;
    subtotalLabel: string;
    subtotalValue: string;
    agencyFee: string;
    totalInclAF: string;
    lumpSumNote: string;
  };
  feeLines: Array<{
    creator: string;
    avatarGroupKey: string;
    tier: string;
    platform: string;
    deliverable: string;
    grossFee?: string;
    avatarSrc?: string | null;
    avatarInitials?: string;
  }>;
  showcaseCreators: Array<{
    sectionNo: string;
    index: number;
    initials: string;
    name: string;
    handle: string;
    avatarSrc?: string | null;
    profileUrl?: string | null;
    followers: string;
    engagement: string;
    tier: string;
    categories: string;
    platforms: string;
    publications: string[];
    deliverables: Array<{
      option: string;
      service: string;
      platform: string;
      type: string;
      grossFee?: string;
    }>;
  }>;
  roster: {
    sectionNo: string;
    rows: Array<{
      handle: string;
      followers: string;
      er: string;
      tier: string;
      categories: string;
      platforms: string;
    }>;
  };
  terms: {
    sectionNo: string;
    items: Array<{ heading: string; body: string }>;
  };
  acceptance: {
    sectionNo: string;
    revision: string;
    preparedByName: string;
  };
  company: {
    legalLine: string;
    address: string;
  };
  footer: {
    left: string;
  };
};
