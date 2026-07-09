import { discoverUsernamesFromHashtagPage } from "../crawlers/platform-crawler.js";
import type { DiscoveryPlatform } from "../crawlers/types.js";
import { upsertDiscoveredProfile } from "../db/profiles.js";

export async function runLocationDiscovery(input: {
  platform: DiscoveryPlatform;
  countryCode: string;
  locationQuery: string;
  limit?: number;
  categoryTags?: string[];
}): Promise<{ discovered: number }> {
  const usernames = await discoverUsernamesFromHashtagPage(
    input.platform,
    input.locationQuery,
    input.limit ?? 25
  );

  let discovered = 0;
  for (const username of usernames) {
    await upsertDiscoveredProfile(
      {
        platform: input.platform,
        username,
        profileUrl: `https://${input.platform}.com/${username}`,
        metadata: {
          location_query: input.locationQuery,
          country_hint: input.countryCode,
        },
      },
      "location",
      `${input.countryCode}:${input.locationQuery}`,
      {
        countryCode: input.countryCode,
        categoryTags: input.categoryTags,
      }
    );
    discovered += 1;
  }

  return { discovered };
}
