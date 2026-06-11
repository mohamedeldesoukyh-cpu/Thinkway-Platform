import OpenAI from "openai";

import { config } from "../config.js";
import { discoverUsernamesFromHashtagPage } from "../crawlers/platform-crawler.js";
import type { DiscoveryPlatform } from "../crawlers/types.js";
import { upsertDiscoveredProfile } from "../db/profiles.js";

async function classifyLocation(
  bio: string | undefined,
  queries: string[]
): Promise<{ countryCode?: string; city?: string; languageCodes: string[] }> {
  if (!config.openAiApiKey || !bio) {
    return { languageCodes: [] };
  }

  const openai = new OpenAI({ apiKey: config.openAiApiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Classify creator location from public bio. Return JSON: country_code (ISO2), city, language_codes array, country_probability 0-1.",
      },
      {
        role: "user",
        content: `Bio: ${bio}\nHints: ${queries.join(", ")}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      country_code?: string;
      city?: string;
      language_codes?: string[];
    };
    return {
      countryCode: parsed.country_code?.toUpperCase().slice(0, 2),
      city: parsed.city,
      languageCodes: parsed.language_codes ?? [],
    };
  } catch {
    return { languageCodes: [] };
  }
}

export async function runLocationDiscovery(input: {
  platform: DiscoveryPlatform;
  countryCode: string;
  locationQuery: string;
  limit?: number;
}): Promise<{ discovered: number }> {
  const usernames = await discoverUsernamesFromHashtagPage(
    input.platform,
    input.locationQuery,
    input.limit ?? 25
  );

  let discovered = 0;
  for (const username of usernames) {
    const location = await classifyLocation(undefined, [input.locationQuery]);
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
      `${input.countryCode}:${input.locationQuery}`
    );

    if (location.countryCode || location.city) {
      await upsertDiscoveredProfile(
        {
          platform: input.platform,
          username,
          profileUrl: `https://${input.platform}.com/${username}`,
        },
        "location",
        input.locationQuery
      );
    }
    discovered += 1;
  }

  return { discovered };
}
