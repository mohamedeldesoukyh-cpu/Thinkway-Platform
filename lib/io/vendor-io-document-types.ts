export type VendorIoDeliverableRow = {
  platform: string;
  deliverableType: string;
  quantity: number;
  handle: string;
  scheduledDates: string;
  unitCost: number;
  totalCost: number;
};

export type VendorIoDocumentData = {
  vendorIoId: string;
  documentNumber: string;
  revisionNumber: number;
  issuedAt: string;
  issuedCountry: string;
  currencyCode: string;
  status: string;
  amount: number;
  usageRights: string | null;
  influencer: {
    id: string;
    displayName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    address: string | null;
    nationalId: string | null;
    categories: string[];
    countryCode: string | null;
    languages: string[];
    paymentDetails: Record<string, unknown>;
  };
  campaign: {
    id: string;
    documentNumber: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    clientName: string;
    brandName: string;
    channels: string;
    usagePeriod: string | null;
  };
  influencerMetrics: {
    handle: string;
    platforms: string;
    followerCount: string;
    niche: string;
    audience: string;
    engagementRate: string;
  };
  deliverables: VendorIoDeliverableRow[];
  pricing: {
    contentCreationFee: number;
    platformDistributionFee: number;
    usageRightsFee: number;
    vatAmount: number;
    vatPercent: number;
    totalDue: number;
  };
  assignmentLineNames: string[];
  assignmentDocumentNumbers: string[];
};
