"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { HydratedVendor } from "../services/creator-hydration-mapper";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

const CreatorHydrationFixtureContext = createContext<readonly HydratedVendor[] | null>(null);

/**
 * Dev-only adapter boundary for a Studio fixture that deliberately uses
 * deterministic, non-persisted creator ids. Production has no provider, so
 * normal Creator DNA and unified-creator hydration remain the only source.
 */
export function CreatorHydrationFixtureProvider({
  vendors,
  children,
}: {
  vendors: readonly HydratedVendor[];
  children: ReactNode;
}) {
  return (
    <CreatorHydrationFixtureContext.Provider value={vendors}>
      {children}
    </CreatorHydrationFixtureContext.Provider>
  );
}

export function useCreatorHydrationFixture(): readonly HydratedVendor[] | null {
  return useContext(CreatorHydrationFixtureContext);
}

function normalizedId(id: string): string {
  return id.replace(/^inf:/, "").replace(/^dis:/, "");
}

/** Resolves only fixture ids, preserving the requested campaign order. */
export function resolveFixtureHydratedVendors(
  creatorIds: readonly string[],
  fixtureVendors: readonly HydratedVendor[]
): HydratedVendor[] {
  const byId = new Map(fixtureVendors.map((vendor) => [normalizedId(vendor.id), vendor]));
  return creatorIds.flatMap((id) => {
    const vendor = byId.get(normalizedId(id));
    return vendor ? [vendor] : [];
  });
}

/**
 * The canonical detail pack requires a UnifiedCreatorResult. This adapter is
 * deliberately limited to the local fixture provider; production callers
 * still resolve that record through unified Creator DNA.
 */
export function resolveFixtureCreatorDetail(
  creatorId: string,
  fixtureVendors: readonly HydratedVendor[] | null
): UnifiedCreatorResult | null {
  const vendor = fixtureVendors?.find((candidate) => normalizedId(candidate.id) === normalizedId(creatorId));
  if (!vendor) return null;

  const followers = vendor.followers ?? null;
  const engagementRate = vendor.engagementRate ?? null;
  return {
    unified_id: vendor.id,
    source_type: "internal",
    influencer_id: null,
    discovered_profile_id: null,
    document_number: null,
    display_name: vendor.displayName,
    status: "fixture",
    country_code: vendor.countryCode ?? "EG",
    country_codes: vendor.countryCode ? [vendor.countryCode] : ["EG"],
    estimated_country: vendor.country ?? "Egypt",
    city: null,
    categories: vendor.categories ?? [],
    language_codes: [],
    profile_image_url: vendor.avatarUrl ?? null,
    primaryAvatarUrl: vendor.avatarUrl ?? null,
    default_metrics_platform_account_id: `fixture-platform-${vendor.id}`,
    bio: null,
    role: vendor.tier ?? null,
    metrics: {
      followers: { value: followers, confidence: "estimated" },
      engagement_rate: { value: engagementRate, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: vendor.thinkwayScore ?? 0,
    source_confidence: 0,
    brand_fit_score: vendor.brandFit ?? null,
    is_platform_verified: false,
    platforms: [
      {
        id: `fixture-platform-${vendor.id}`,
        platform: vendor.platform,
        handle: vendor.handle.replace(/^@/, ""),
        profile_url: vendor.profileUrl ?? null,
        follower_count: followers,
        engagement_rate: engagementRate,
        audience_country: vendor.countryCode ?? "EG",
        profile_picture_url: vendor.avatarUrl ?? null,
      },
    ],
    enrichment_status: "never",
  };
}
