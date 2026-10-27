import type { QuotationDeliverable, QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";
import type { LinePlatformSelection } from "@/lib/campaigns/line-assignment";

export const OTHER_SERVICE_TYPE = "other_service";

export function isOtherService(item: { deliverables?: unknown; platform?: string | null }): boolean {
  return Array.isArray(item.deliverables) && item.deliverables.some((entry: QuotationDeliverable) =>
    entry?.type === OTHER_SERVICE_TYPE || entry?.type_lines?.some(line => line?.type === OTHER_SERVICE_TYPE));
}

/** A supplier service has no social account. The empty account is intentional. */
export function otherServicePlatforms(vendorName: string, quantity = 1): LinePlatformSelection[] {
  return [{ account_id: "", platform: "other", handle: vendorName, profile_url: null,
    follower_count: null, engagement_rate: null, audience_country: null,
    deliverables: Array.from({ length: Math.max(1, Math.floor(quantity)) }, () => OTHER_SERVICE_TYPE) }];
}

export type OtherServiceInput = {
  vendorId: string;
  title: string;
  description: string;
  cost: number;
  revenue: number;
  currency: string;
  agencyFeePercent: number;
};

export function otherServiceSeed(input: OtherServiceInput, vendorName: string): QuotationItemSeed {
  const description = [input.title.trim(), input.description.trim()].filter(Boolean).join(" — ");
  return {
    influencer_id: input.vendorId, unified_id: `inf:${input.vendorId}`, creator_name: vendorName,
    platform: "other", service_description: description,
    cost: input.cost, revenue: input.revenue, cost_currency: input.currency,
    commercial_input_mode: "cost_revenue", af_pct: input.agencyFeePercent,
    deliverables: [{ platform: "other", type: OTHER_SERVICE_TYPE,
      type_lines: [{ type: OTHER_SERVICE_TYPE, quantity: 1 }], quantity: 1,
      service_description: description, commercial_input_mode: "cost_revenue",
      cost: input.cost, revenue: input.revenue, cost_currency: input.currency,
      af_pct: input.agencyFeePercent }],
  };
}
