import { deliverableTypeLines } from "@/lib/quotations/quotation-deliverable-types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";
import {
  resolveExportGroupEngagementRate,
  resolveExportGroupFollowers,
  resolveExportGroupPlatform,
} from "@/features/quotations/export/quotation-export-utils";
import { groupQuotationExportItems } from "@/features/quotations/export/quotation-export-utils";

import { profileToForecastCreatorInput } from "./hydration/profile-to-forecast-input";
import { buildCreatorForecastProfile } from "./profile/profile-builder";
import type { CreatorForecastProfile } from "./profile/types";
import type { CampaignForecastCreatorInput, CampaignForecastDeliverableInput } from "./types";

function deliverablesFromQuotationItems(
  items: QuotationItemRow[]
): CampaignForecastDeliverableInput[] {
  const deliverables: CampaignForecastDeliverableInput[] = [];

  for (const item of items) {
    for (const deliverable of item.deliverables ?? []) {
      const typeLines = deliverableTypeLines(deliverable);
      for (const line of typeLines) {
        if (!line.type.trim()) continue;
        deliverables.push({
          contentType: line.type,
          platform: deliverable.platform ?? item.platform,
          quantity: line.quantity,
        });
      }
    }
  }

  return deliverables;
}

/** Build normalized forecast profiles for quotation roster groups. */
export function quotationItemsToForecastProfiles(
  items: QuotationItemRow[]
): CreatorForecastProfile[] {
  const groups = groupQuotationExportItems(items);

  return groups.map((group) => {
    const header = group.items[0]!;
    const creatorKey = quotationCreatorDuplicateKey(header);
    const followers = resolveExportGroupFollowers(group.items);
    const platform = resolveExportGroupPlatform(group.items);
    const engagementRate = resolveExportGroupEngagementRate(group.items, followers);

    return buildCreatorForecastProfile({
      creatorKeyOverride: creatorKey,
      manualSnapshot: {
        creatorKey,
        displayName: header.creator_name,
        handle: header.handle,
        followers,
        primaryPlatform: platform,
        engagementRate,
      },
      deliverables: deliverablesFromQuotationItems(group.items),
    });
  });
}

export function quotationItemsToForecastCreators(
  items: QuotationItemRow[]
): CampaignForecastCreatorInput[] {
  const groups = groupQuotationExportItems(items);

  return quotationItemsToForecastProfiles(items).map((profile, index) => {
    const deliverables = deliverablesFromQuotationItems(groups[index]!.items);
    return profileToForecastCreatorInput(
      profile,
      deliverables.length ? deliverables : undefined
    );
  });
}

export function shortlistGroupsToForecastProfiles(
  groups: Array<{
    creatorKey: string;
    creator: string;
    handle: string;
    followersNumeric: number | null;
    engagementRateNumeric: number | null;
    platformLinks: Array<{ platform: string }>;
  }>
): CreatorForecastProfile[] {
  return groups.map((group) =>
    buildCreatorForecastProfile({
      creatorKeyOverride: group.creatorKey,
      manualSnapshot: {
        creatorKey: group.creatorKey,
        displayName: group.creator,
        handle: group.handle,
        followers: group.followersNumeric,
        primaryPlatform: group.platformLinks[0]?.platform ?? null,
        engagementRate: group.engagementRateNumeric,
      },
    })
  );
}

export function shortlistGroupsToForecastCreators(
  groups: Array<{
    creatorKey: string;
    creator: string;
    handle: string;
    followersNumeric: number | null;
    engagementRateNumeric: number | null;
    platformLinks: Array<{ platform: string }>;
  }>
): CampaignForecastCreatorInput[] {
  return shortlistGroupsToForecastProfiles(groups).map((profile) =>
    profileToForecastCreatorInput(profile)
  );
}

export type RosterForecastCreatorInput = {
  creatorKey: string;
  displayName?: string | null;
  handle?: string | null;
  followers?: number | null;
  platform?: string | null;
  engagementRate?: number | null;
  deliverables?: CampaignForecastDeliverableInput[];
};

export function rosterToForecastProfiles(
  creators: RosterForecastCreatorInput[]
): CreatorForecastProfile[] {
  return creators.map((creator) =>
    buildCreatorForecastProfile({
      creatorKeyOverride: creator.creatorKey,
      manualSnapshot: {
        creatorKey: creator.creatorKey,
        displayName: creator.displayName,
        handle: creator.handle,
        followers: creator.followers,
        primaryPlatform: creator.platform,
        engagementRate: creator.engagementRate,
      },
      deliverables: creator.deliverables,
    })
  );
}

export function rosterToForecastCreators(
  creators: RosterForecastCreatorInput[]
): CampaignForecastCreatorInput[] {
  return rosterToForecastProfiles(creators).map((profile, index) =>
    profileToForecastCreatorInput(profile, creators[index]?.deliverables)
  );
}
