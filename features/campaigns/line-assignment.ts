import { isUuid } from "@/lib/validation/uuid";

import { DELIVERABLE_TYPE_OPTIONS, PLATFORM_OPTIONS } from "./constants";
import {
  PLATFORM_DELIVERABLE_CODES,
  deliverableTypeLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import type {
  LineInfluencerAssignment,
  LinePlatformSelection,
} from "@/lib/domains/campaign/types";
import type { AssignmentPricingMode } from "@/lib/domains/commercial/types";

export type { AssignmentPricingMode } from "@/lib/domains/commercial/types";
export type {
  LineInfluencerAssignment,
  LinePlatformSelection,
} from "@/lib/domains/campaign/types";

export const LINE_ASSIGNMENT_META_KEY = "influencer_assignment";

/** @deprecated Use getDeliverableTypeCodesForPlatform from deliverable-taxonomy */
export const PLATFORM_DELIVERABLES = PLATFORM_DELIVERABLE_CODES;

export function deliverableLabel(value: string): string {
  const fromTaxonomy = deliverableTypeLabel(value);
  if (fromTaxonomy !== value.replace(/_/g, " ")) return fromTaxonomy;
  return (
    DELIVERABLE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function platformLabel(platform: string): string {
  return (
    PLATFORM_OPTIONS.find((o) => o.value === platform)?.label ??
    platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

export function buildLineTitle(
  influencerName: string,
  platforms: LinePlatformSelection[]
): string {
  if (platforms.length === 0) {
    return influencerName;
  }
  if (platforms.length === 1) {
    const p = platforms[0];
    const deliverableLabels = p.deliverables.map(deliverableLabel);
    if (deliverableLabels.length === 1) {
      return `${influencerName} — ${deliverableLabels[0]}`;
    }
    if (deliverableLabels.length > 1) {
      return `${influencerName} — ${platformLabel(p.platform)} Package`;
    }
    return `${influencerName} — ${platformLabel(p.platform)}`;
  }
  return `${influencerName} — Multi-Platform Package`;
}

export function deriveLinePlatformField(
  platforms: LinePlatformSelection[]
): string | null {
  if (platforms.length === 0) return null;
  if (platforms.length === 1) return platforms[0].platform;
  return "multi";
}

export function parseLineAssignment(
  metadata: Record<string, unknown> | null | undefined
): LineInfluencerAssignment | null {
  const raw = metadata?.[LINE_ASSIGNMENT_META_KEY];
  if (!raw || typeof raw !== "object") return null;
  const a = raw as LineInfluencerAssignment;
  if (!a.influencer_id || !a.influencer_name || !isUuid(a.influencer_id)) return null;
  return {
    ...a,
    platforms: Array.isArray(a.platforms)
      ? a.platforms.map((platform) => ({
          ...platform,
          deliverables: Array.isArray(platform.deliverables)
            ? platform.deliverables
            : [],
        }))
      : [],
  };
}

export function countLineDeliverables(platforms: LinePlatformSelection[]): number {
  return platforms.reduce((sum, p) => sum + p.deliverables.length, 0);
}

export function suggestCostFromRateCard(
  rateCard: Record<string, unknown>,
  platforms: LinePlatformSelection[]
): number {
  const base = Number(rateCard?.default_fee ?? rateCard?.base_rate ?? 0);
  if (base > 0) return base;
  const deliverableCount = Math.max(1, countLineDeliverables(platforms));
  return deliverableCount * 500;
}

export function suggestCurrencyFromPaymentDetails(
  paymentDetails: Record<string, unknown>,
  fallback: string
): string {
  const c = paymentDetails?.currency;
  return typeof c === "string" && c.length === 3 ? c : fallback;
}

export function assignmentStatusFromBilling(
  billingStatus: string
): import("./types").CampaignLineAssignmentStatus | null {
  switch (billingStatus) {
    case "invoiced":
    case "partially_paid":
      return "invoiced";
    case "paid":
      return "paid";
    case "closed":
      return "closed";
    default:
      return null;
  }
}
