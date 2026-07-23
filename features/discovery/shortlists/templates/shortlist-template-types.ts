export type ShortlistTemplateFlags = {
  showcaseCreators: boolean;
  pitchCreators: boolean;
  includeInternalFields: boolean;
};

export type ShortlistTemplatePayload = {
  flags: ShortlistTemplateFlags;
  shortlist: {
    number: string;
    title: string;
    client: string;
    brand: string;
    owner: string;
    generatedDate: string;
    status: string;
    visibility: string;
  };
  cover: {
    kicker: string;
    subtitle: string;
    stat3: { label: string; value: string; valueShort: string };
  };
  roster: {
    sectionNo: string;
    note: string;
  };
  campaign: {
    creatorCount: string;
    tierSummary: string;
    totalReach: string;
    totalReachShort: string;
    avgEngagement: string;
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
    estReach: string;
    reachShare: string;
    avgER: string;
    creators: Array<{
      handle: string;
      platform: string;
      followers: string;
      category: string;
      er: string;
      estReach: string;
    }>;
  }>;
  totals: {
    creatorCount: string;
    followers: string;
    estReach: string;
    avgER: string;
  };
  insight: {
    narrative: string;
    categoryMix: string;
    tierMix: string;
    scale: string;
  };
  showcaseCreators: Array<{
    sectionNo: string;
    index: number;
    initials: string;
    name: string;
    handle: string;
    avatarSrc?: string | null;
    profileUrl?: string | null;
    isVerified: boolean;
    followers: string;
    engagement: string;
    tier: string;
    categories: string;
    platforms: string;
    country: string;
    matchScore: string;
    brandSafety: string;
    status: string;
    notes: string;
    publications: string[];
  }>;
  rosterRows: Array<{
    rank: number;
    handle: string;
    creator: string;
    platform: string;
    followers: string;
    er: string;
    country: string;
    interests?: string;
    brandSafety?: string;
    status?: string;
    notes?: string;
    matchScore?: string;
    tier?: string;
    categories?: string;
    avatarInitials?: string;
  }>;
  company: {
    legalLine: string;
    address: string;
  };
  footer: {
    left: string;
  };
};
