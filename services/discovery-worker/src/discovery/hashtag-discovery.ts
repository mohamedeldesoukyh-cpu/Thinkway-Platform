import { discoverUsernamesFromHashtagPage } from "../crawlers/platform-crawler.js";
import type { DiscoveryPlatform } from "../crawlers/types.js";
import { upsertDiscoveredProfile } from "../db/profiles.js";

export async function runHashtagDiscovery(input: {
  platform: DiscoveryPlatform;
  hashtag: string;
  limit?: number;
}): Promise<{ discovered: number; usernames: string[] }> {
  const usernames = await discoverUsernamesFromHashtagPage(
    input.platform,
    input.hashtag,
    input.limit ?? 30
  );

  let discovered = 0;
  for (const username of usernames) {
    const profileId = await upsertDiscoveredProfile(
      {
        platform: input.platform,
        username,
        profileUrl: `https://${input.platform}.com/${username}`,
      },
      "hashtag",
      input.hashtag
    );
    if (profileId) discovered += 1;
  }

  return { discovered, usernames };
}
