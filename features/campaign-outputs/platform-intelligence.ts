/**
 * Dynamic per-platform intelligence — driven by quotation allocation, never hardcoded IG/TikTok only.
 */

import { mergePlatformAllocation } from "./platform-allocation";

export type PlatformIntelligenceEntry = {
  platform: string;
  count: number;
  percentage: number;
  role: string;
  audienceFit: string;
  formatStrength: string;
  complementNote?: string;
};

type PlatformProfile = {
  role: string;
  audienceFit: string;
  formatStrength: string;
  complements: Partial<Record<string, string>>;
};

function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase().replace(/\s+/g, "");
}

function profileKey(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (key.includes("tiktok") || key === "tt") return "tiktok";
  if (key.includes("instagram") || key === "ig") return "instagram";
  if (key.includes("youtube") || key === "yt") return "youtube";
  if (key.includes("facebook") || key === "fb") return "facebook";
  if (key.includes("snap")) return "snapchat";
  if (key.includes("twitter") || key === "x") return "twitter";
  if (key.includes("linkedin")) return "linkedin";
  if (key.includes("pinterest")) return "pinterest";
  if (key.includes("twitch")) return "twitch";
  return key || "general";
}

const PLATFORM_PROFILES: Record<string, PlatformProfile> = {
  tiktok: {
    role: "trend velocity and algorithmic reach",
    audienceFit: "entertainment-first scroll sessions and youth-native discovery",
    formatStrength: "short-form hooks, audio-led formats, and participation mechanics",
    complements: {
      instagram: "adds polished Reels credibility while TikTok drives cultural velocity",
      youtube: "extends reach from snackable clips into longer consideration content",
      facebook: "amplifies cross-generational sharing beyond Gen-Z scroll habits",
    },
  },
  instagram: {
    role: "brand credibility and visual storytelling",
    audienceFit: "lifestyle discovery through Reels, feed, and daily Stories touchpoints",
    formatStrength: "Reels for reach, Stories for intimacy, and feed posts for brand permanence",
    complements: {
      tiktok: "captures audiences who discover on TikTok but validate brands on Instagram",
      youtube: "pairs short Reels hooks with deeper YouTube narrative arcs",
      facebook: "extends Meta ecosystem reach to family and community audiences",
    },
  },
  youtube: {
    role: "depth, search discovery, and consideration",
    audienceFit: "intent-driven viewers seeking tutorials, reviews, and longer narratives",
    formatStrength: "integrations, Shorts, and dedicated videos that compound in search",
    complements: {
      tiktok: "converts viral curiosity into substantiated product understanding",
      instagram: "repurposes Reels energy into searchable, evergreen content",
      facebook: "shares long-form proof points across community groups",
    },
  },
  facebook: {
    role: "community reach and cross-post amplification",
    audienceFit: "broad demographic sharing, group discovery, and family-network distribution",
    formatStrength: "mirrored video, community posts, and event-style launch announcements",
    complements: {
      instagram: "extends Meta inventory to audiences less active on Instagram Reels",
      youtube: "distributes long-form highlights to community and group contexts",
      tiktok: "repurposes trend-native clips for shareable feed and group posts",
    },
  },
  snapchat: {
    role: "youth intimacy and ephemeral engagement",
    audienceFit: "in-the-moment, camera-first consumption among younger demographics",
    formatStrength: "Stories, Spotlight, and AR-native lenses with low-friction creation",
    complements: {
      tiktok: "pairs trend velocity with private, friend-network storytelling",
      instagram: "complements polished feed presence with raw, ephemeral Snaps",
    },
  },
  twitter: {
    role: "real-time conversation and cultural commentary",
    audienceFit: "news-aware, opinion-led audiences in fast-moving discourse",
    formatStrength: "clip-led posts, threads, and trend-reactive commentary",
    complements: {
      youtube: "distills long-form takeaways into conversation-starting clips",
      tiktok: "bridges viral moments into real-time cultural commentary",
    },
  },
  linkedin: {
    role: "professional credibility and B2B consideration",
    audienceFit: "decision-makers seeking authority-led, business-relevant narratives",
    formatStrength: "thought-leadership posts, founder stories, and product-in-context demos",
    complements: {
      youtube: "extends educational content into professional network distribution",
      instagram: "elevates lifestyle brand stories for workplace-relevant audiences",
    },
  },
  pinterest: {
    role: "inspiration and save-driven discovery",
    audienceFit: "planning-oriented audiences seeking visual inspiration and product ideas",
    formatStrength: "aesthetic pins, idea boards, and how-to visual guides",
    complements: {
      instagram: "converts aspirational Reels into save-worthy planning content",
      youtube: "pairs tutorial depth with pin-friendly visual summaries",
    },
  },
  twitch: {
    role: "live community and authentic engagement",
    audienceFit: "gaming and live-audience communities seeking real-time interaction",
    formatStrength: "live integrations, stream takeovers, and chat-driven participation",
    complements: {
      youtube: "repurposes live moments into VOD and Shorts highlights",
      tiktok: "clips live highlights into trend-native short-form distribution",
    },
  },
  general: {
    role: "creator-led brand storytelling",
    audienceFit: "audiences active on this channel for native creator content",
    formatStrength: "platform-native formats aligned to how this audience consumes content",
    complements: {},
  },
};

function profileForPlatform(platform: string): PlatformProfile {
  return PLATFORM_PROFILES[profileKey(platform)] ?? PLATFORM_PROFILES.general!;
}

export function sortedPlatformIntelligence(
  platformAllocation: Record<string, number>
): PlatformIntelligenceEntry[] {
  const entries = Object.entries(mergePlatformAllocation(platformAllocation)).filter(
    ([, count]) => count > 0
  );
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const ranked = entries
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

  const dominantKey = ranked[0] ? profileKey(ranked[0].platform) : "";

  return ranked.map((entry, index) => {
    const profile = profileForPlatform(entry.platform);
    const entryKey = profileKey(entry.platform);
    let complementNote: string | undefined;

    if (index > 0 && dominantKey && dominantKey !== entryKey) {
      const dominantProfile = PLATFORM_PROFILES[dominantKey];
      complementNote =
        dominantProfile?.complements[entryKey] ??
        profile.complements[dominantKey] ??
        `complements the primary channel with ${profile.role}`;
    }

    return {
      ...entry,
      role: profile.role,
      audienceFit: profile.audienceFit,
      formatStrength: profile.formatStrength,
      complementNote,
    };
  });
}

function entrySentence(entry: PlatformIntelligenceEntry, audience?: string): string {
  const audienceNote = audience?.trim() ? ` among ${audience.trim()}` : "";
  const slotNote =
    entry.count === 1
      ? "1 quoted deliverable"
      : `${entry.count} quoted deliverables (${entry.percentage}%)`;

  return `${entry.platform} — ${slotNote}: selected for ${entry.role}, reaching${audienceNote} ${entry.audienceFit}. Strengths: ${entry.formatStrength}.`;
}

/** Platform allocation rationale covering every quotation platform with role, audience, and complementarity. */
export function buildPlatformIntelligenceNarrative(input: {
  platformAllocation: Record<string, number>;
  briefText?: string;
  audience?: string;
  platforms?: string[];
}): string {
  const entries = sortedPlatformIntelligence(input.platformAllocation);

  if (!entries.length) {
    const fallback = input.platforms?.length ? input.platforms.join(", ") : "the primary platforms";
    return `Creator content is distributed across ${fallback}, aligned to where the target audience discovers and engages with brand stories.`;
  }

  if (entries.length === 1) {
    const entry = entries[0]!;
    const sentence = entrySentence(entry, input.audience);
    return sentence.replace(/\.$/, "") + ".";
  }

  const parts: string[] = [];
  const dominant = entries[0]!;

  parts.push(
    `The ${entries.length}-platform mix is quotation-driven — ${dominant.platform} leads at ${dominant.percentage}% (${dominant.count} deliverable${dominant.count === 1 ? "" : "s"}).`
  );

  for (const entry of entries) {
    let line = entrySentence(entry, input.audience);
    if (entry.complementNote && entry.platform !== dominant.platform) {
      line += ` Relative to ${dominant.platform}, ${entry.platform} ${entry.complementNote}.`;
    }
    parts.push(line);
  }

  return parts.join(" ");
}
