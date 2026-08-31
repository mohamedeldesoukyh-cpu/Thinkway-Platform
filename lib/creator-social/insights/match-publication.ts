import { detectPublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";

import type {
  PublicationMatchCandidate,
  PublicationMatchResult,
  NormalizedSocialInsight,
} from "./types";

function normalizeUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = "";
    url.search = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hostname = host;
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${host}${path}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function matchPublicationInsight(input: {
  ownerInfluencerId: string;
  insight: Pick<
    NormalizedSocialInsight,
    "provider" | "canonicalUrl" | "externalContentId"
  >;
  publications: readonly PublicationMatchCandidate[];
}): PublicationMatchResult {
  const owned = input.publications.filter(
    (row) => row.influencerId === input.ownerInfluencerId
  );
  if (owned.length === 0) {
    return { publicationId: null, matchStatus: "unmatched" };
  }

  const insightUrl = normalizeUrl(input.insight.canonicalUrl);
  const insightMediaId = input.insight.externalContentId?.trim() || null;
  const exact: string[] = [];
  const uncertain: string[] = [];

  for (const publication of owned) {
    const detected = detectPublicationPlatform({
      id: publication.id,
      campaign_header_id: "",
      platform: publication.platform ?? "",
      content_url: publication.contentUrl,
      external_media_id: publication.externalMediaId,
      publication_type: "",
    });
    if (detected.platform !== "unknown" && detected.platform !== input.insight.provider) {
      continue;
    }

    const pubUrl = normalizeUrl(detected.canonicalUrl ?? publication.contentUrl);
    const pubMediaId =
      detected.mediaId?.trim() || publication.externalMediaId?.trim() || null;
    const mediaMatch = Boolean(
      insightMediaId && pubMediaId && insightMediaId === pubMediaId
    );
    const urlMatch = Boolean(insightUrl && pubUrl && insightUrl === pubUrl);

    if (mediaMatch || urlMatch) {
      exact.push(publication.id);
      continue;
    }
    if (
      insightUrl &&
      pubUrl &&
      (insightUrl.includes(pubUrl) || pubUrl.includes(insightUrl))
    ) {
      uncertain.push(publication.id);
    }
  }

  if (exact.length === 1) {
    return { publicationId: exact[0] ?? null, matchStatus: "matched" };
  }
  if (exact.length > 1 || uncertain.length > 0) {
    return { publicationId: null, matchStatus: "uncertain" };
  }
  return { publicationId: null, matchStatus: "unmatched" };
}
