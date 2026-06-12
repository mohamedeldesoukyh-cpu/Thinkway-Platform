export type ClientIoDeliverableRow = {
  influencerName: string;
  platform: string;
  deliverableType: string;
  quantity: number;
  handle: string;
  scheduledDates: string;
};

export type ClientIoAssignmentPricing = {
  lineId: string;
  lineDocumentNumber: string | null;
  lineName: string;
  influencerName: string;
  revenueBeforeVat: number;
  usageRightsAmount: number;
  agencyFeeAmount: number;
};

export type ClientIoCampaignPricing = {
  currencyCode: string;
  vatPercent: number;
  vatExempt: boolean;
  assignmentLines: ClientIoAssignmentPricing[];
  revenueTotal: number;
  usageRightsTotal: number;
  agencyFeeTotal: number;
  subtotal: number;
  vatAmount: number;
  total: number;
};

export type ClientIoDocumentData = {
  clientIoId: string;
  documentNumber: string;
  issuedAt: string;
  issuedCountry: string;
  currencyCode: string;
  status: string;
  paymentSchedule: string | null;
  client: {
    id: string;
    name: string;
    legalName: string | null;
    tradeLicense: string | null;
    address: string | null;
    contactPerson: string | null;
    email: string | null;
  };
  campaign: {
    id: string;
    documentNumber: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    brandName: string;
    channels: string;
    targetMarket: string;
    businessObjective: string | null;
    usagePeriod: string | null;
  };
  deliverables: ClientIoDeliverableRow[];
  pricing: ClientIoCampaignPricing;
};
