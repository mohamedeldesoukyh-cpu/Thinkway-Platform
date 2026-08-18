import type { ClientBrandMention, ClientReviewSourceSnapshot } from "./types";
import { brandDomainGuess } from "./brand-mentions";

const MAX_BYTES = 400_000;
const MIN_BYTES = 64;

function logoSources(mention: ClientBrandMention): string[] {
  const domain = brandDomainGuess(mention.name, mention.handle);
  const handle = (mention.handle || mention.name).replace(/^@/, "").trim().toLowerCase().replace(/[^a-z0-9._]+/g, "");
  const urls = [
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`,
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${encodeURIComponent(domain)}&size=128`,
    `https://unavatar.io/${encodeURIComponent(domain)}?fallback=false`,
  ];
  if (handle && !handle.includes(".")) {
    urls.push(`https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`);
  }
  return urls;
}

export function reviewBrandMentionAllowed(
  snapshot: ClientReviewSourceSnapshot | null | undefined,
  name: string
): ClientBrandMention | null {
  const key = name.trim().toLowerCase();
  if (!key || !snapshot) return null;
  for (const creator of snapshot.creators) {
    for (const mention of creator.brandMentions ?? []) {
      if (mention.name.trim().toLowerCase() === key) return mention;
    }
  }
  return null;
}

export function clientReviewBrandLogoPath(token: string, name: string): string {
  const params = new URLSearchParams();
  params.set("sign", token);
  params.set("name", name);
  return `/api/review/brand-logo?${params.toString()}`;
}

export async function fetchBrandLogoImage(
  mention: ClientBrandMention
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  for (const url of logoSources(mention)) {
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
