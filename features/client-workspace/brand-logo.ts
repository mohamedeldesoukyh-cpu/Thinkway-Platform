import type { ClientBrandMention, ClientReviewSourceSnapshot } from "./types";
import {
  brandDomainGuess,
  brandFaviconUrl,
  brandSocialHandle,
  isKnownBrandDomain,
} from "./brand-mentions";

const MAX_BYTES = 400_000;
const MIN_BYTES = 64;
const FETCH_TIMEOUT_MS = 2_500;

export function brandMentionKey(mention: Pick<ClientBrandMention, "name" | "handle">): string {
  return (
    brandSocialHandle(mention) ||
    mention.name.trim().toLowerCase()
  );
}

/** Proxy + browser waterfall. Instagram first — these mentions are tagged accounts. */
export function brandLogoClientSources(mention: ClientBrandMention, token: string): string[] {
  const handle = brandSocialHandle(mention);
  const sources: string[] = [];
  if (handle) {
    sources.push(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`);
    sources.push(`https://unavatar.io/tiktok/${encodeURIComponent(handle)}?fallback=false`);
  }
  sources.push(clientReviewBrandLogoPath(token, mention.name, mention.handle));
  if (isKnownBrandDomain(mention.name, mention.handle)) {
    sources.push(brandFaviconUrl(mention));
  }
  return sources;
}

export function brandLogoServerSources(mention: ClientBrandMention): string[] {
  const handle = brandSocialHandle(mention);
  const sources: string[] = [];
  if (handle) {
    sources.push(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`);
    sources.push(`https://unavatar.io/tiktok/${encodeURIComponent(handle)}?fallback=false`);
  }
  if (isKnownBrandDomain(mention.name, mention.handle)) {
    const domain = brandDomainGuess(mention.name, mention.handle);
    sources.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
    sources.push(`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`);
    sources.push(
      `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${encodeURIComponent(domain)}&size=128`
    );
  }
  return sources;
}

export function reviewBrandMentionAllowed(
  snapshot: ClientReviewSourceSnapshot | null | undefined,
  name: string,
  handle?: string | null
): ClientBrandMention | null {
  if (!snapshot) return null;
  const wanted = brandMentionKey({ name, handle: handle?.trim() || undefined });
  if (!wanted) return null;
  for (const creator of snapshot.creators) {
    for (const mention of creator.brandMentions ?? []) {
      if (brandMentionKey(mention) === wanted) return mention;
      if (mention.name.trim().toLowerCase() === name.trim().toLowerCase()) return mention;
    }
  }
  return null;
}

export function clientReviewBrandLogoPath(token: string, name: string, handle?: string): string {
  const params = new URLSearchParams();
  params.set("sign", token);
  params.set("name", name);
  const social = handle?.replace(/^@/, "").trim();
  if (social) params.set("handle", social);
  return `/api/review/brand-logo?${params.toString()}`;
}

export async function fetchBrandLogoImage(
  mention: ClientBrandMention
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  for (const url of brandLogoServerSources(mention)) {
    const result = await fetchLogo(url);
    if (result) return result;
  }
  return null;
}

async function fetchLogo(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 Thinkway Client Review",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < MIN_BYTES || buffer.byteLength > MAX_BYTES) return null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}
