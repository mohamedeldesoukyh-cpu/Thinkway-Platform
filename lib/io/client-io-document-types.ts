import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";
import type { ClientIoTerm } from "@/lib/io/client-io-terms";

export type ClientIoAgencyContact = {
  fullName: string;
  title: string | null;
  email: string | null;
};

export type ClientIoDeliverableRow = {
  influencerName: string;
  platform: string;
  deliverableType: string;
  quantity: number;
  handle: string;
  scheduledDates: string;
};

/** Per-influencer commercial notes shown below the roster table. */
export type ClientIoInfluencerNoteRow = {
  influencerName: string;
  fullDescription: string | null;
  usagePeriod: string | null;
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
  /** Release 2.2 — configured billing milestones (schedule only). */
  billingMilestones: ClientIoMilestoneDraft[];
  agencyContact: ClientIoAgencyContact;
  terms: ClientIoTerm[];
  client: {
    id: string;
    name: string;
    legalName: string | null;
    tradeLicense: string | null;
    address: string | null;
    contactPerson: string | null;
    email: string | null;
    /** Legal-entity commercial relationship — drives Parties left header. */
    agencyOrDirect: "agency" | "direct" | "hybrid" | null;
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
  };
  /** Per-platform / per-deliverable rows (child level). */
  deliverables: ClientIoDeliverableRow[];
  /** One row per campaign assignment line (main line only). */
  mainAssignmentDeliverables: ClientIoDeliverableRow[];
  /** Full Description + usage period by influencer (below roster). */
  influencerNotes: ClientIoInfluencerNoteRow[];
  pricing: ClientIoCampaignPricing;
};
