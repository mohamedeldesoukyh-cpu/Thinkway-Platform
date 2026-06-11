import { crawlPublicProfile } from "../crawlers/platform-crawler.js";
import type { DiscoveryPlatform } from "../crawlers/types.js";
import {
  saveRelationships,
  upsertDiscoveredProfile,
} from "../db/profiles.js";

export async function runCompetitorDiscovery(input: {
  platform: DiscoveryPlatform;
  seedUsername: string;
  limit?: number;
}): Promise<{ discovered: number; relationships: number }> {
  const crawl = await crawlPublicProfile(input.platform, input.seedUsername);
  const sourceId = await upsertDiscoveredProfile(crawl.profile, "competitor", input.seedUsername);

  let discovered = 1;
  const relationships = crawl.relationships.slice(0, input.limit ?? 20);

  for (const rel of relationships) {
    await upsertDiscoveredProfile(
      {
        platform: input.platform,
        username: rel.targetUsername,
        profileUrl: crawl.profile.profileUrl.replace(
          crawl.profile.username,
          rel.targetUsername
        ),
      },
      "competitor",
      `seed:${input.seedUsername}`
    );
    discovered += 1;
  }

  await saveRelationships(sourceId, input.platform, relationships);

  return { discovered, relationships: relationships.length };
}
